// 图像预处理：解决"长截图被模型视觉编码器下采样导致细节丢失"的问题。
//
// 背景：Gemini 等多模态模型有"每张图最大 tile 数"的硬约束（典型每图 ≈ 3072 视觉 token）。
// 一张 750×8000 的长截图被丢进去时，模型会先做一次下采样以塞进 tile 上限，结果就是
// 模块密度高的长图反而比短图"看不清"。前端在发送前主动切片 + 限尺，比交给模型黑盒
// 处理可控得多。
//
// 策略：
//   1) 短边 ≤ MAX_LONG_SIDE 且宽高比 ≤ MAX_ASPECT 的图 → 不动
//   2) 宽高比 > MAX_ASPECT 的"长图" → 按纵向切片（每片宽高比 ≈ TARGET_SLICE_ASPECT）
//   3) 切片或单图的最长边 > MAX_LONG_SIDE → 等比下采样到 MAX_LONG_SIDE
//
// 切片之间留 SLICE_OVERLAP 的像素重叠，避免被切到一半的模块两边都看不全。

const MAX_LONG_SIDE = 2048;          // 单张/单片的最长边像素上限
const MAX_ASPECT = 2.2;              // 宽高比超过这个就开始切（高 / 宽）
const TARGET_SLICE_ASPECT = 1.6;     // 切片目标宽高比（接近黄金比，模型处理友好）
const SLICE_OVERLAP = 80;            // 切片之间的像素重叠，避免边界模块被截断
const JPEG_QUALITY = 0.92;           // 压缩为 JPEG 时的质量

export interface PreprocessedImage {
  /** 处理后的 dataURL（image/jpeg） */
  src: string;
  /** 原图分组 id：来自同一原图的所有切片共享同一 groupId */
  groupId: string;
  /** 在所属分组内的切片索引（0-based）；未切片时为 0 */
  sliceIndex: number;
  /** 所属分组的总切片数；未切片时为 1 */
  sliceTotal: number;
  /** 原图在用户上传序列里的次序（用于 prompt 描述） */
  originalOrder: number;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const drawToDataURL = (
  source: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  targetW: number,
  targetH: number
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, targetW, targetH);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
};

/**
 * 对一张原图做预处理；返回 1 个或多个切片。
 * @param src 原图 dataURL
 * @param originalOrder 该图在用户上传序列里的次序（从 0 起）
 */
export async function preprocessImage(
  src: string,
  originalOrder: number
): Promise<PreprocessedImage[]> {
  const img = await loadImage(src);
  const { naturalWidth: W, naturalHeight: H } = img;
  if (!W || !H) {
    return [{ src, groupId: `g${originalOrder}`, sliceIndex: 0, sliceTotal: 1, originalOrder }];
  }

  const aspect = H / W;
  const groupId = `g${originalOrder}`;

  // 情况 A：长截图 → 纵向切片
  if (aspect > MAX_ASPECT) {
    // 切片数：让每片的宽高比接近 TARGET_SLICE_ASPECT
    const sliceCount = Math.max(2, Math.ceil(aspect / TARGET_SLICE_ASPECT));
    // 每片在原图坐标中的高度（不含重叠）
    const baseSliceH = Math.ceil(H / sliceCount);
    const out: PreprocessedImage[] = [];

    for (let i = 0; i < sliceCount; i++) {
      const sy = i === 0 ? 0 : Math.max(0, i * baseSliceH - SLICE_OVERLAP);
      const syEnd = i === sliceCount - 1 ? H : Math.min(H, (i + 1) * baseSliceH + SLICE_OVERLAP);
      const sh = syEnd - sy;
      const sw = W;

      // 切片输出尺寸：长边不超 MAX_LONG_SIDE
      const longSide = Math.max(sw, sh);
      const scale = longSide > MAX_LONG_SIDE ? MAX_LONG_SIDE / longSide : 1;
      const targetW = Math.round(sw * scale);
      const targetH = Math.round(sh * scale);

      out.push({
        src: drawToDataURL(img, 0, sy, sw, sh, targetW, targetH),
        groupId,
        sliceIndex: i,
        sliceTotal: sliceCount,
        originalOrder,
      });
    }
    return out;
  }

  // 情况 B：普通图，但长边超限 → 等比下采样
  const longSide = Math.max(W, H);
  if (longSide > MAX_LONG_SIDE) {
    const scale = MAX_LONG_SIDE / longSide;
    const targetW = Math.round(W * scale);
    const targetH = Math.round(H * scale);
    return [{
      src: drawToDataURL(img, 0, 0, W, H, targetW, targetH),
      groupId,
      sliceIndex: 0,
      sliceTotal: 1,
      originalOrder,
    }];
  }

  // 情况 C：尺寸合规 → 原样
  return [{ src, groupId, sliceIndex: 0, sliceTotal: 1, originalOrder }];
}

/**
 * 批量预处理；保留原始顺序，长图展开为多个切片。
 */
export async function preprocessImages(srcs: string[]): Promise<PreprocessedImage[]> {
  const groups = await Promise.all(srcs.map((src, i) => preprocessImage(src, i)));
  return groups.flat();
}

/**
 * 给 prompt 用的简短描述，告诉模型"这一批 N 张图实际上来自 M 张原图，其中第 X 张被切成了 K 片"。
 * 让模型不要把切片当独立页面，而是当"同一长页的连续部分"。
 */
export function describeSliceLayout(items: PreprocessedImage[]): string {
  if (items.length === 0) return '';
  // 按 originalOrder 聚合
  const groups = new Map<number, PreprocessedImage[]>();
  for (const it of items) {
    const arr = groups.get(it.originalOrder) ?? [];
    arr.push(it);
    groups.set(it.originalOrder, arr);
  }
  const totalSlices = items.length;
  const totalOriginals = groups.size;
  if (totalSlices === totalOriginals) return '';

  const lines: string[] = [];
  lines.push(`图像切片说明：本次共发送 ${totalSlices} 张图给你，但它们实际来自 ${totalOriginals} 张原图。`);
  Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([origIdx, arr]) => {
      arr.sort((a, b) => a.sliceIndex - b.sliceIndex);
      if (arr.length > 1) {
        lines.push(`- 第 ${origIdx + 1} 张原图（长截图）被纵向切成 ${arr.length} 片，按从上到下的顺序依次发送，请把它们当作同一页面的连续部分处理（模块和导航是连续的，不要重复列）。`);
      } else {
        lines.push(`- 第 ${origIdx + 1} 张原图未切片，独立成图。`);
      }
    });
  lines.push('解读规则：来自同一原图的多片，应被识别为同一个页面/视图——里面所有可见模块都属于这一个页面；不同原图之间才是不同页面/视图。');
  return lines.join('\n');
}
