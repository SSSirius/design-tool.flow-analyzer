import { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Edit2,
  Check,
  X,
  Sparkles,
  Loader2,
  Play,
  Route,
  GitFork,
  Plus,
} from 'lucide-react';
import { generateNodeDetails } from '../services/ai';

const CustomNode = ({ id, data }: NodeProps) => {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '');
  const [editDesc, setEditDesc] = useState(data.description || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [enhancedData, setEnhancedData] = useState<any>(null);
  const { setNodes, setEdges, getNode, getNodes } = useReactFlow();

  // Sync local state when data changes externally (e.g., language toggle)
  useEffect(() => {
    setEditLabel(data.label || '');
    setEditDesc(data.description || '');
  }, [data.label, data.description]);

  const hasContent = (data.edgeCases?.length > 0 || data.checklist?.length > 0 || data.questions?.length > 0);
  const description = data.description || '';
  const isLongDescription = description.length > 50;
  const canExpand = isLongDescription || hasContent;
  const NodeTypeIcon = data.type === 'decision'
    ? GitFork
    : data.type === 'start'
      ? Play
      : Route;

  const handleAIComplete = async () => {
    if (!editLabel) return;
    setIsGenerating(true);
    try {
      const details = await generateNodeDetails(editLabel);
      if (details.description) setEditDesc(details.description);
      setEnhancedData(details);
    } catch (error) {
      console.error("Failed to generate details:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: {
              ...node.data,
              label: editLabel,
              description: editDesc,
              edgeCases: enhancedData ? enhancedData.edgeCases : node.data.edgeCases,
              checklist: enhancedData ? enhancedData.checklist : node.data.checklist,
              questions: enhancedData ? enhancedData.questions : node.data.questions,
              // Update the language-specific fields as well so toggling doesn't revert it
              label_zh: editLabel,
              label_en: editLabel,
              description_zh: editDesc,
              description_en: editDesc,
            },
          };
        }
        return node;
      })
    );
    setIsEditing(false);
    setEnhancedData(null);
  };

  const handleCancel = () => {
    setEditLabel(data.label || '');
    setEditDesc(data.description || '');
    setEnhancedData(null);
    setIsEditing(false);
  };

  const isFlowLayout = data.layoutDirection === 'TB';
  const addDirections = isFlowLayout
    ? (['top', 'bottom'] as const)
    : (['left', 'right'] as const);
  const targetHandlePosition = isFlowLayout ? Position.Top : Position.Left;
  const sourceHandlePosition = isFlowLayout ? Position.Bottom : Position.Right;

  const handleAddAdjacentNode = (direction: 'left' | 'right' | 'top' | 'bottom') => {
    const sourceNode = getNode(id);
    if (!sourceNode) return;

    const NODE_W = 460;
    const NODE_H = 230;
    const newNodeId = Math.random().toString(36).slice(2, 11);
    const offset = {
      left: { x: -NODE_W, y: 0 },
      right: { x: NODE_W, y: 0 },
      top: { x: 0, y: -NODE_H },
      bottom: { x: 0, y: NODE_H },
    }[direction];
    const isOutgoing = direction === 'right' || direction === 'bottom';

    const targetPos = {
      x: sourceNode.position.x + offset.x,
      y: sourceNode.position.y + offset.y,
    };

    // 收集需要被推开的已有节点 —— 沿着 direction 方向递归扩散，
    // 这样 A → B 已存在时，从 A 新增节点，B 及 B 之后的链路会一起被推开
    const allNodes = getNodes();
    const axis: 'x' | 'y' = direction === 'left' || direction === 'right' ? 'x' : 'y';
    const sign = direction === 'right' || direction === 'bottom' ? 1 : -1;
    const shift = axis === 'x' ? NODE_W : NODE_H;

    const overlap = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.abs(a.x - b.x) < NODE_W && Math.abs(a.y - b.y) < NODE_H;

    const pushedPositions = new Map<string, { x: number; y: number }>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of allNodes) {
        if (node.id === id || pushedPositions.has(node.id)) continue;
        // 1) 与新节点（targetPos）重叠？
        let needPush = overlap(node.position, targetPos);
        // 2) 与某个已计划被推开节点（取它推开后的位置）重叠？
        if (!needPush) {
          for (const pushedPos of pushedPositions.values()) {
            if (overlap(node.position, pushedPos)) {
              needPush = true;
              break;
            }
          }
        }
        if (needPush) {
          pushedPositions.set(node.id, {
            x: axis === 'x' ? node.position.x + sign * shift : node.position.x,
            y: axis === 'y' ? node.position.y + sign * shift : node.position.y,
          });
          changed = true;
        }
      }
    }

    const newNode = {
      id: newNodeId,
      type: 'custom',
      position: targetPos,
      data: {
        label: '新步骤',
        label_zh: '新步骤',
        label_en: 'New Step',
        description: '双击开始编辑...',
        description_zh: '双击开始编辑...',
        description_en: 'Double click to edit...',
        type: 'action',
        layoutDirection: data.layoutDirection || 'LR',
      },
    };

    setNodes((nodes) =>
      nodes
        .map((n) => {
          const newPos = pushedPositions.get(n.id);
          return newPos ? { ...n, position: newPos } : n;
        })
        .concat(newNode),
    );
    setEdges((edges) => edges.concat({
      id: isOutgoing ? `${id}-${newNodeId}` : `${newNodeId}-${id}`,
      source: isOutgoing ? id : newNodeId,
      target: isOutgoing ? newNodeId : id,
      animated: false,
      style: { stroke: '#5a5a5a', strokeWidth: 1 },
    }));
  };

  return (
    <div className="tap-node-shell min-w-[360px] max-w-[520px] group">
      {!isEditing && (
        <>
          {addDirections.map((direction) => (
            <button
              key={direction}
              type="button"
              aria-label={`在${direction}添加节点`}
              onClick={(event) => {
                event.stopPropagation();
                handleAddAdjacentNode(direction);
              }}
              className={`nodrag nopan tap-node-add-zone tap-node-add-zone-${direction}`}
            >
              <span className="tap-node-add-button">
                <Plus size={27} strokeWidth={2.1} />
              </span>
            </button>
          ))}
        </>
      )}
      <div className="tap-node-card">
        <div className="tap-node-header">
          {!isEditing && (
            <div className="tap-node-type-icon">
              <NodeTypeIcon size={25} strokeWidth={1.8} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="tap-node-edit-form">
                <input
                  autoFocus
                  className="glass-input tap-node-edit-input"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="Step Name"
                />
                <div className="tap-node-edit-textarea-wrap">
                  <textarea
                    className="glass-input tap-node-edit-textarea"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Description"
                  />
                  <button
                    onClick={handleAIComplete}
                    disabled={!editLabel || isGenerating}
                    className="tap-node-ai-btn"
                    title="AI Auto-complete"
                  >
                    {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  </button>
                </div>
                <div className="tap-node-edit-actions">
                  <button
                    onClick={handleCancel}
                    className="tap-node-action-btn tap-node-action-btn--cancel"
                    title="Cancel"
                  >
                    <X size={14} />
                  </button>
                  <button
                    onClick={handleSave}
                    className="tap-node-action-btn tap-node-action-btn--save"
                    title="Save"
                  >
                    <Check size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                role={canExpand ? 'button' : undefined}
                tabIndex={canExpand ? 0 : undefined}
                onClick={() => {
                  if (canExpand) setExpanded((current) => !current);
                }}
                onKeyDown={(e) => {
                  if (!canExpand) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setExpanded((current) => !current);
                  }
                }}
                className={canExpand ? 'cursor-pointer' : ''}
              >
                <div className="tap-node-title-row">
                  <div className="tap-node-title">{data.label}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditing(true);
                    }}
                    className="tap-node-edit-btn"
                    title="Edit"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>

                <div className={`tap-node-description ${!expanded && isLongDescription ? 'tap-node-description--clamped' : ''}`}>
                  {description}
                </div>

                {canExpand && (
                  <div className="tap-node-toggle">
                    {expanded ? '收起' : '展开'}
                    {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {expanded && hasContent && !isEditing && (
          <div className="tap-node-detail animate-in fade-in duration-200">
            {data.edgeCases?.length > 0 && (
              <div className="tap-node-section">
                <div className="tap-node-section-title tap-node-section-title--warn">
                  <AlertTriangle size={16} className="mr-2" /> Edge Cases
                </div>
                <ul className="tap-node-section-list tap-node-section-list--warn">
                  {data.edgeCases.map((ec: string, i: number) => (
                    <li key={i} className="break-words">{ec}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.checklist?.length > 0 && (
              <div className="tap-node-section">
                <div className="tap-node-section-title tap-node-section-title--check">
                  <CheckCircle2 size={14} className="mr-2" /> Checklist
                </div>
                <ul className="tap-node-section-list tap-node-section-list--check">
                  {data.checklist.map((c: string, i: number) => (
                    <li key={i} className="break-words">{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {data.questions?.length > 0 && (
              <div className="tap-node-section">
                <div className="tap-node-section-title tap-node-section-title--question">
                  <HelpCircle size={14} className="mr-2" /> Robustness Questions
                </div>
                <ul className="tap-node-section-list tap-node-section-list--question">
                  {data.questions.map((q: string, i: number) => (
                    <li key={i} className="break-words">{q}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      </div>
      {/* 仅一对隐形 handle，挂在中央。具体进出位置（35/65、30/50/70 等）由 LabeledEdge
          根据该侧 edge 数量动态偏移端点完成 —— 这样无需为不同数量的连线创建多组 handle。 */}
      <Handle id="t" type="target" position={targetHandlePosition} className="tap-node-handle" />
      <Handle id="s" type="source" position={sourceHandlePosition} className="tap-node-handle" />
    </div>
  );
};

export default memo(CustomNode);
