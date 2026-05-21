import { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { CheckCircle2, AlertTriangle, FileText, ChevronDown, ChevronUp, HelpCircle, Edit2, Check, X, Sparkles, Loader2 } from 'lucide-react';
import { generateNodeDetails } from '../services/ai';

const CustomNode = ({ id, data }: NodeProps) => {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label || '');
  const [editDesc, setEditDesc] = useState(data.description || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [enhancedData, setEnhancedData] = useState<any>(null);
  const { setNodes } = useReactFlow();

  // Sync local state when data changes externally (e.g., language toggle)
  useEffect(() => {
    setEditLabel(data.label || '');
    setEditDesc(data.description || '');
  }, [data.label, data.description]);

  const hasContent = (data.edgeCases?.length > 0 || data.checklist?.length > 0 || data.questions?.length > 0);
  const description = data.description || '';
  const isLongDescription = description.length > 50;

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

  return (
    <div className="px-3 py-2 shadow-sm rounded bg-stone-800 border border-stone-700 min-w-[180px] max-w-[260px] transition-all group">
      <div className="flex items-start">
        <div className="rounded-full w-6 h-6 flex justify-center items-center bg-stone-700 text-stone-300 flex-shrink-0 mt-0.5">
          {data.type === 'decision' ? (
            <AlertTriangle size={12} />
          ) : (
            <FileText size={12} />
          )}
        </div>
        <div className="ml-2 flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2 mt-1">
              <input
                autoFocus
                className="w-full bg-stone-900 border border-stone-600 rounded px-2 py-1 type-sm text-stone-200 focus:outline-none focus:border-indigo-500"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="Step Name"
              />
              <div className="relative">
                <textarea
                  className="w-full bg-stone-900 border border-stone-600 rounded px-2 py-1 type-sm text-stone-200 focus:outline-none focus:border-indigo-500 resize-none h-20 pr-8"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Description"
                />
                <button
                  onClick={handleAIComplete}
                  disabled={!editLabel || isGenerating}
                  className="absolute bottom-2 right-2 p-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="AI Auto-complete"
                >
                  {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                </button>
              </div>
              <div className="flex justify-end gap-1">
                <button onClick={handleCancel} className="p-1 text-stone-400 hover:text-stone-200 hover:bg-stone-700 rounded">
                  <X size={14} />
                </button>
                <button onClick={handleSave} className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-stone-700 rounded">
                  <Check size={14} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="type-base font-bold text-stone-200 break-words">{data.label}</div>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-stone-500 hover:text-stone-300 transition-opacity"
                >
                  <Edit2 size={12} />
                </button>
              </div>
              
              <div className={`type-sm text-stone-500 leading-tight mt-1 ${!expanded && isLongDescription ? 'line-clamp-2' : ''}`}>
                {description}
              </div>
              
              {(isLongDescription || hasContent) && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(!expanded);
                  }}
                  className="text-[10px] text-stone-400 hover:text-stone-200 mt-1 flex items-center gap-1 cursor-pointer"
                >
                  {expanded ? (
                    <>
                      收起 <ChevronUp size={10} />
                    </>
                  ) : (
                    <>
                      查看全部 <ChevronDown size={10} />
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {expanded && hasContent && !isEditing && (
        <div className="mt-2 border-t border-stone-700 pt-2 animate-in fade-in duration-200">
          {data.edgeCases?.length > 0 && (
            <div className="mb-2">
              <div className="type-sm font-semibold text-amber-500 flex items-center mb-0.5">
                <AlertTriangle size={8} className="mr-1" /> Edge Cases
              </div>
              <ul className="list-disc list-inside type-sm text-stone-400 pl-1">
                {data.edgeCases.map((ec: string, i: number) => (
                  <li key={i} className="break-words">{ec}</li>
                ))}
              </ul>
            </div>
          )}
          
          {data.checklist?.length > 0 && (
            <div className="mb-2">
              <div className="type-sm font-semibold text-emerald-500 flex items-center mb-0.5">
                <CheckCircle2 size={8} className="mr-1" /> Checklist
              </div>
              <ul className="list-disc list-inside type-sm text-stone-400 pl-1">
                {data.checklist.map((c: string, i: number) => (
                  <li key={i} className="break-words">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {data.questions?.length > 0 && (
            <div>
              <div className="type-sm font-semibold text-blue-400 flex items-center mb-0.5">
                <HelpCircle size={8} className="mr-1" /> Robustness Questions
              </div>
              <ul className="list-disc list-inside type-sm text-stone-400 pl-1">
                {data.questions.map((q: string, i: number) => (
                  <li key={i} className="break-words">{q}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Handle type="target" position={Position.Top} className="w-12 !bg-stone-600" />
      <Handle type="source" position={Position.Bottom} className="w-12 !bg-stone-600" />
    </div>
  );
};

export default memo(CustomNode);
