import { memo, useMemo } from 'react';
import type { CSSProperties } from 'react';
import {
  EdgeProps,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  useStore,
} from 'reactflow';

function isHorizontalSide(pos: Position) {
  return pos === Position.Left || pos === Position.Right;
}

// 把同一节点同侧的若干端点在中段 30% 区域均匀分布：
//   n=1 → [0.5]；n=2 → [0.35, 0.65]；n=3 → [0.35, 0.5, 0.65]；以此类推
function ratioForIndex(index: number, total: number): number {
  if (total <= 1) return 0.5;
  const start = 0.35;
  const end = 0.65;
  return start + (index / (total - 1)) * (end - start);
}

// 反向位置：top↔bottom，left↔right —— 用于回环边的端点翻边
function oppositeSide(pos: Position): Position {
  switch (pos) {
    case Position.Left: return Position.Right;
    case Position.Right: return Position.Left;
    case Position.Top: return Position.Bottom;
    case Position.Bottom: return Position.Top;
  }
}

const LabeledEdge = memo((props: EdgeProps) => {
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    label,
    style,
    markerEnd,
    data,
  } = props;

  const isDimmed = !!(data as any)?.dimmed;
  const isStatic = !!(data as any)?.static;

  const sourceNode = useStore((s) => s.nodeInternals.get(source));
  const targetNode = useStore((s) => s.nodeInternals.get(target));
  const edges = useStore((s) => s.edges);
  const nodeInternals = useStore((s) => s.nodeInternals);

  const isHorizontalLayout = isHorizontalSide(sourcePosition);

  // ─────────────────────────────────────────────────────────
  // 1. 工具：给一条 edge 计算出 source 端点落在哪一侧 / target 端点落在哪一侧。
  //    回环边（target 在反方向）会把两端都翻到节点的相对侧，避免大圈绕弯。
  // ─────────────────────────────────────────────────────────
  const computeSidesForEdge = (e: { source: string; target: string }) => {
    const sN = nodeInternals.get(e.source);
    const tN = nodeInternals.get(e.target);
    if (!sN || !tN) {
      return { sSide: sourcePosition, tSide: targetPosition, isLoop: false };
    }
    const sCenter = isHorizontalLayout
      ? (sN.positionAbsolute?.x ?? sN.position.x) + (sN.width ?? 0) / 2
      : (sN.positionAbsolute?.y ?? sN.position.y) + (sN.height ?? 0) / 2;
    const tCenter = isHorizontalLayout
      ? (tN.positionAbsolute?.x ?? tN.position.x) + (tN.width ?? 0) / 2
      : (tN.positionAbsolute?.y ?? tN.position.y) + (tN.height ?? 0) / 2;
    const isLoop = tCenter < sCenter;
    return {
      sSide: isLoop ? oppositeSide(sourcePosition) : sourcePosition,
      tSide: isLoop ? oppositeSide(targetPosition) : targetPosition,
      isLoop,
    };
  };

  const { sSide: effectiveSourcePos, tSide: effectiveTargetPos, isLoop: isLoopback } =
    computeSidesForEdge({ source, target });

  // ─────────────────────────────────────────────────────────
  // 2. 端点初始坐标：ReactFlow 给的是按 sourcePosition / targetPosition 决定的
  //    节点边缘中心；如果本边是回环，就把端点翻到对侧节点边缘中心。
  // ─────────────────────────────────────────────────────────
  let sx = sourceX;
  let sy = sourceY;
  let tx = targetX;
  let ty = targetY;
  if (isLoopback && sourceNode) {
    const w = sourceNode.width ?? 0;
    const h = sourceNode.height ?? 0;
    if (isHorizontalLayout) sx = sourceX - w;
    else sy = sourceY - h;
  }
  if (isLoopback && targetNode) {
    const w = targetNode.width ?? 0;
    const h = targetNode.height ?? 0;
    if (isHorizontalLayout) tx = targetX + w;
    else ty = targetY + h;
  }

  // ─────────────────────────────────────────────────────────
  // 3. 多点分布（核心修复）：
  //    - 对每个节点的每一侧（Top/Bottom/Left/Right），收集"所有挂在这一侧的端点"
  //      —— 不区分这个端点是 source-out 还是 target-in，都进同一个组。
  //    - 例如「创作者主页」的底部如果有 3 条正向出 + 3 条回环入，那就是 6 个端点
  //      在底部均匀分布；每个端点占一个位置。
  //    - 这样每个节点的每一侧分布都符合直觉：n 个连接 → n 个均匀位置。
  // ─────────────────────────────────────────────────────────
  const { sourceRatio, targetRatio } = useMemo(() => {
    // 收集：节点 nodeId 的 side 那一侧上所有端点的稳定 key（用 edgeId+role 构造）
    const collectEndpointsOnSide = (nodeId: string, side: Position): string[] => {
      const keys: string[] = [];
      for (const e of edges) {
        if (e.source !== nodeId && e.target !== nodeId) continue;
        const { sSide, tSide } = computeSidesForEdge(e);
        if (e.source === nodeId && sSide === side) {
          keys.push(`${e.id}::s`);
        }
        if (e.target === nodeId && tSide === side) {
          keys.push(`${e.id}::t`);
        }
      }
      keys.sort();
      return keys;
    };

    const sourceKeys = collectEndpointsOnSide(source, effectiveSourcePos);
    const targetKeys = collectEndpointsOnSide(target, effectiveTargetPos);

    const sIdx = sourceKeys.indexOf(`${id}::s`);
    const tIdx = targetKeys.indexOf(`${id}::t`);

    return {
      sourceRatio: ratioForIndex(sIdx >= 0 ? sIdx : 0, sourceKeys.length || 1),
      targetRatio: ratioForIndex(tIdx >= 0 ? tIdx : 0, targetKeys.length || 1),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, id, source, target, effectiveSourcePos, effectiveTargetPos, nodeInternals, isHorizontalLayout]);

  // 把端点按 ratio 在节点边缘上偏移
  if (sourceNode) {
    const w = sourceNode.width ?? 0;
    const h = sourceNode.height ?? 0;
    if (isHorizontalSide(effectiveSourcePos)) {
      sy = sy + (sourceRatio - 0.5) * h;
    } else {
      sx = sx + (sourceRatio - 0.5) * w;
    }
  }
  if (targetNode) {
    const w = targetNode.width ?? 0;
    const h = targetNode.height ?? 0;
    if (isHorizontalSide(effectiveTargetPos)) {
      ty = ty + (targetRatio - 0.5) * h;
    } else {
      tx = tx + (targetRatio - 0.5) * w;
    }
  }

  const [edgePath] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: effectiveSourcePos,
    targetX: tx,
    targetY: ty,
    targetPosition: effectiveTargetPos,
  });

  // label 放在路径 35% 处（沿 source→target 直线插值，避免线段中央叠在一起）
  const labelT = 0.35;
  const labelX = sx + (tx - sx) * labelT;
  const labelY = sy + (ty - sy) * labelT;

  // 光传输效果：底线（管道） + 5 层彗星拖尾。详见 index.css。
  // 注意：必须把 baseStyle 的 transition 强制设为 none —— 现代浏览器
  // 会对 SVG path 的 d 属性走 CSS transition，外部若误传 transition:'all'
  // 会让底线在拖动时延迟跟随节点移动。
  const baseStrokeColor = (style as CSSProperties)?.stroke as string | undefined;
  const baseStrokeWidth = (style as CSSProperties)?.strokeWidth as number | string | undefined;
  const baseStyle: CSSProperties = {
    ...style,
    fill: 'none',
    stroke: baseStrokeColor ?? 'rgba(255,255,255,0.22)',
    strokeWidth: baseStrokeWidth ?? 1.3,
    transition: 'none',
  };

  return (
    <>
      <path
        id={id}
        d={edgePath}
        className="react-flow__edge-path"
        style={baseStyle}
        markerEnd={markerEnd}
        pathLength={100}
      />
      {!isStatic && (
        <>
          <path d={edgePath} className="tap-edge-trail tap-edge-trail-5" pathLength={100} />
          <path d={edgePath} className="tap-edge-trail tap-edge-trail-4" pathLength={100} />
          <path d={edgePath} className="tap-edge-trail tap-edge-trail-3" pathLength={100} />
          <path d={edgePath} className="tap-edge-trail tap-edge-trail-2" pathLength={100} />
          <path d={edgePath} className="tap-edge-trail tap-edge-trail-1" pathLength={100} />
        </>
      )}
      {label != null && label !== '' && (
        <EdgeLabelRenderer>
          <div
            className={`labeled-edge-label nodrag nopan${isDimmed ? ' tap-edge-label-dimmed' : ''}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

LabeledEdge.displayName = 'LabeledEdge';

export default LabeledEdge;
