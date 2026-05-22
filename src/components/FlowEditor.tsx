import { useCallback, useState } from 'react';
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

export default function FlowEditor({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect
}: FlowEditorProps) {
  // zoomFraction 直接存倍率（0.01~2），而不是百分比 —— 用倍率作为状态可以
  // 完整保留 ReactFlow 的 viewport 精度，避免在状态层做四舍五入丢失中间值。
  const [zoomFraction, setZoomFraction] = useState(1);
  const [isLocked, setIsLocked] = useState(false);
  const { fitView, zoomTo } = useReactFlow();
  const sliderValue = zoomToSlider(zoomFraction);
  const zoomProgress = sliderValue;

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

  return (
    <div className="h-full w-full bg-transparent">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid={true}
        snapGrid={[GRID_SIZE, GRID_SIZE]}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
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
          style={{ width: 248, height: 160, right: 1, bottom: 76 }}
        />
        <div className="flow-minimap-toolbar nodrag nopan nowheel absolute bottom-4 right-4 z-20 flex h-12 w-[248px] items-center justify-between gap-2 rounded-[16px] border border-[#303030] bg-[#202020] px-3 shadow-[0_14px_34px_rgba(0,0,0,0.32)]">

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
          <span className="w-12 text-right font-mono type-xs text-[#d0d0d0]">{formatZoomLabel(zoomFraction)}</span>
        </div>
        <Background gap={GRID_SIZE} size={1} color="rgba(255,255,255,0.16)" />
      </ReactFlow>
    </div>
  );
}
