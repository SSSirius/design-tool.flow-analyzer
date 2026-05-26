import { useCallback, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import ReactFlow, {
  MiniMap,
  Background,
  Connection,
  Edge,
  Node,
  NodeChange,
  useOnViewportChange,
  useReactFlow,
} from 'reactflow';
import { Focus, Lock, Unlock } from 'lucide-react';
import CustomNode from './CustomNode';
import LabeledEdge from './LabeledEdge';

const nodeTypes = {
  custom: CustomNode,
};

const edgeTypes = {
  labeled: LabeledEdge,
};

interface FlowEditorProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: any) => void;
  onConnect: (connection: Connection) => void;
}

const GRID_SIZE = 20;

// 缩放区间：复杂流程图缩到 ~1% 才能看完整布局；上限放到 200% 让用户可以放大
// 查看节点细节。注意 ReactFlow 的 minZoom/maxZoom 单位是"倍率"，不是百分比，
// 所以 0.01 = 1%，2 = 200%。
const MIN_ZOOM = 0.01;
const MAX_ZOOM = 2;

// slider 与 zoom 倍率走线性映射：
//   - slider=0   ⇒ zoom=0.01（1%）
//   - slider=50  ⇒ zoom≈1.005（≈100%，恰好在 slider 中点）
//   - slider=100 ⇒ zoom=2（200%）
// 选线性而非对数：1% 和 200% 的算术中点正好就是 100%，直觉上"100% 在中间"
// 与 slider 视觉一致，避免对数映射下"100% 落在 slider 92% 位置"的不合理观感。
const sliderToZoom = (s: number): number =>
  MIN_ZOOM + (s / 100) * (MAX_ZOOM - MIN_ZOOM);
const zoomToSlider = (z: number): number => {
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  return ((clamped - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100;
};

// 显示文本：统一展示整数百分比（最低 1%，无需展示小数）
const formatZoomLabel = (z: number): string => `${Math.round(z * 100)}%`;

// 控件占位的安全 inset：onboarding 居中时要避开
//   - 顶部 FloatingActions 横排按钮（main 区域 top-0 + 固定高 70px）
//   - 右下角 MiniMap（约 220×160，留 24px 边距）
//   - 底部 zoom slider 区（约 56px）
// 把这些 inset 从 viewport 中切掉，得到的就是节点真正可以"被居中"的安全区。
const SAFE_INSETS = {
  top: 70,
  right: 260,
  bottom: 80,
  left: 24,
} as const;

// 首次挂载时画布的目标缩放：onboarding 的 4 个节点在 70% 下既能完整显示，
// 又留出足够的视觉呼吸；之后 AI 生成内容时业务有自己的居中逻辑，不受此影响。
const INITIAL_ZOOM = 0.7;

export default function FlowEditor({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect
}: FlowEditorProps) {
  // zoomFraction 直接存倍率（0.01~2），而不是百分比 —— 用倍率作为状态可以
  // 完整保留 ReactFlow 的 viewport 精度，避免在状态层做四舍五入丢失中间值。
  const [zoomFraction, setZoomFraction] = useState(INITIAL_ZOOM);
  const [isLocked, setIsLocked] = useState(false);
  const { fitView, zoomTo } = useReactFlow();
  const sliderValue = zoomToSlider(zoomFraction);
  const zoomProgress = sliderValue;
  // 标记 onInit 是否已经把 viewport 摆到"安全区居中"的初始状态。
  // 只在首次挂载触发一次，避免后续 AI 生成内容、用户拖拽时被强行 reset。
  const didInitialCenterRef = useRef(false);

  useOnViewportChange({
    onChange: ({ zoom }) => setZoomFraction(zoom),
  });

  const handleResetView = useCallback(() => {
    fitView({ padding: 0.35, maxZoom: 1, minZoom: MIN_ZOOM, duration: 260 });
  }, [fitView]);

  const handleSliderChange = useCallback((sliderVal: number) => {
    const z = sliderToZoom(sliderVal);
    setZoomFraction(z);
    zoomTo(z, { duration: 80 });
  }, [zoomTo]);

  // 首次挂载时把 onboarding 的 4 个节点放到「画布去掉控件占位后」的安全区中心。
  //
  // 不能用 fitView：fitView 总是按整张 viewport 的几何中心居中，会被右下角的
  // MiniMap、底部的 zoom slider 视觉性遮挡（用户截图就是这个状态）。
  //
  // 改用手算：
  //   1. 拿到所有节点的 bounding box（基于 flow 坐标系）。
  //   2. 算出"安全区"的中心 (cx, cy) —— 即去掉 SAFE_INSETS 后的 viewport 中点。
  //   3. setViewport({x, y, zoom: 0.7})，让 bbox 中心在屏幕上落在 (cx, cy)。
  //   ReactFlow 的 viewport 公式：screenX = nodeX * zoom + viewport.x，
  //   所以 viewport.x = cx - bboxCenterX * zoom。
  const handleInit = useCallback(
    (instance: any) => {
      if (didInitialCenterRef.current) return;
      didInitialCenterRef.current = true;

      const allNodes: any[] = instance.getNodes?.() ?? [];
      if (allNodes.length === 0) return;

      // 计算节点 bounding box（flow 坐标系，左上原点）
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of allNodes) {
        const w = n.width ?? 240;   // ReactFlow measure 之前可能没有，给个保守值
        const h = n.height ?? 100;
        const x = n.position?.x ?? 0;
        const y = n.position?.y ?? 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x + w > maxX) maxX = x + w;
        if (y + h > maxY) maxY = y + h;
      }
      const bboxCx = (minX + maxX) / 2;
      const bboxCy = (minY + maxY) / 2;

      // 画布坐标系（左侧 InputPanel 是 w-80 = 320px，画布的 x=0 落在
      // InputPanel 的右边沿，所以这里直接在「画布宽度」上算居中）。
      const SIDEBAR_W = 320;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const canvasW = vw - SIDEBAR_W;
      const safeCxInCanvas =
        SAFE_INSETS.left +
        (canvasW - SAFE_INSETS.left - SAFE_INSETS.right) / 2;
      const safeCy =
        SAFE_INSETS.top + (vh - SAFE_INSETS.top - SAFE_INSETS.bottom) / 2;

      const x = safeCxInCanvas - bboxCx * INITIAL_ZOOM;
      const y = safeCy - bboxCy * INITIAL_ZOOM;

      instance.setViewport?.({ x, y, zoom: INITIAL_ZOOM }, { duration: 0 });
    },
    [],
  );

  return (
    <div className="h-full w-full bg-transparent">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={handleInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid={true}
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        defaultViewport={{ x: 0, y: 0, zoom: INITIAL_ZOOM }}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        elementsSelectable={!isLocked}
        selectionKeyCode={null}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap
          pannable
          zoomable
          position="bottom-right"
          maskColor="rgba(7, 7, 7, 0.5)"
          maskStrokeColor="rgba(245,245,245,0.48)"
          maskStrokeWidth={2}
          nodeColor="#9b9b9b"
          nodeStrokeColor="#d0d0d0"
          nodeStrokeWidth={2}
          offsetScale={1}
          style={{ width: 248, height: 160, right: 0, bottom: 60 }}
        />
        <div className="flow-minimap-toolbar nodrag nopan nowheel absolute bottom-0 right-0 z-20 flex h-12 w-[248px] items-center justify-between gap-2 rounded-[16px] border border-[#303030] bg-[#202020] px-3 shadow-[0_14px_34px_rgba(0,0,0,0.32)]">

          <button
            type="button"
            onClick={handleResetView}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white transition-colors hover:bg-[#2a2a2a] active:bg-[#111111]"
            title="重置居中"
          >
            <Focus size={19} strokeWidth={2.1} />
          </button>
          <button
            type="button"
            onClick={() => setIsLocked((locked) => !locked)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl text-white transition-colors hover:bg-[#2a2a2a] ${isLocked ? 'bg-[#111111]' : ''
              }`}
            title={isLocked ? '解锁编辑' : '锁定编辑'}
          >
            {isLocked ? <Lock size={18} strokeWidth={2.1} /> : <Unlock size={18} strokeWidth={2.1} />}
          </button>
          <div className="zoom-slider-group group relative flex flex-1 items-center">
            <input
              className="flow-zoom-slider"
              aria-label="缩放"
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={sliderValue}
              style={{ '--zoom-progress': `${zoomProgress}%` } as CSSProperties}
              onChange={(event) => handleSliderChange(Number(event.target.value))}
            />
            <div className="zoom-slider-tooltip pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 whitespace-nowrap rounded-[16px] bg-[#2b2b2b] px-5 py-3 type-sm font-semibold text-white opacity-0 shadow-[0_12px_28px_rgba(0,0,0,0.34)] transition-opacity group-hover:opacity-100">
              放大/缩小画布
            </div>
          </div>
          <span className="w-12 text-right font-mono type-xs text-[var(--text-secondary)]">{formatZoomLabel(zoomFraction)}</span>
        </div>
        <Background gap={GRID_SIZE} size={1} color="rgba(255,255,255,0.16)" />
      </ReactFlow>
    </div>
  );
}
