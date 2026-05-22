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
        <div className="flow-minimap-toolbar nodrag nopan nowheel">

          <button
            type="button"
            onClick={handleResetView}
            className="flow-toolbar-btn flow-toolbar-btn--momentary"
            title="重置居中"
            aria-label="重置居中"
          >
            <Focus size={19} strokeWidth={2.1} />
            <span className="flow-toolbar-tooltip">重置居中</span>
          </button>
          <button
            type="button"
            onClick={() => setIsLocked((locked) => !locked)}
            className={isLocked ? 'flow-toolbar-btn flow-toolbar-btn--active' : 'flow-toolbar-btn'}
            title={isLocked ? '解锁编辑' : '锁定编辑'}
            aria-label={isLocked ? '解锁编辑' : '锁定编辑'}
            aria-pressed={isLocked}
          >
            {isLocked ? <Lock size={18} strokeWidth={2.1} /> : <Unlock size={18} strokeWidth={2.1} />}
            <span className="flow-toolbar-tooltip">{isLocked ? '已锁定，点击解锁' : '锁定节点编辑'}</span>
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
            <div className="zoom-slider-tooltip">
              放大/缩小画布 · {formatZoomLabel(zoomFraction)}
            </div>
          </div>
          <span className="w-12 text-right font-mono type-xs text-[#d0d0d0]">{formatZoomLabel(zoomFraction)}</span>
        </div>
        <Background gap={GRID_SIZE} size={1} color="rgba(255,255,255,0.16)" />
      </ReactFlow>
    </div>
  );
}
