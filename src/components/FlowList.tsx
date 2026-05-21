import { X, GitBranch, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FlowPath } from '../types';

interface FlowListProps {
  isOpen: boolean;
  onClose: () => void;
  flows: FlowPath[];
  language: 'zh' | 'en';
  activeFlowId: string | null;
  onSelectFlow: (id: string | null) => void;
}

export default function FlowList({ isOpen, onClose, flows, language, activeFlowId, onSelectFlow }: FlowListProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-96 bg-stone-900 border-l border-stone-800 z-50 shadow-2xl flex flex-col"
          >
            <div className="p-4 border-b border-stone-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="text-stone-400" size={20} />
                <h2 className="type-lg font-bold text-stone-100">
                  {language === 'zh' ? '流程场景' : 'User Flows'}
                </h2>
              </div>
              <button 
                onClick={onClose}
                className="p-1 hover:bg-stone-800 rounded-full text-stone-400 hover:text-stone-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {flows.length === 0 ? (
                <div className="text-center py-12 text-stone-500 type-sm">
                  {language === 'zh' ? '暂无流程数据' : 'No flow scenarios available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {/* "All" option */}
                  <button
                    onClick={() => onSelectFlow(null)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      activeFlowId === null
                        ? 'bg-indigo-900/30 border-indigo-500/50 text-indigo-200'
                        : 'bg-stone-800/50 border-stone-700/50 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                    }`}
                  >
                    <span className="type-base font-bold">
                      {language === 'zh' ? '显示全部' : 'Show All'}
                    </span>
                  </button>

                  {flows.map((flow) => {
                    const name = language === 'zh' ? (flow.name_zh || flow.name) : (flow.name_en || flow.name);
                    const description = language === 'zh' ? (flow.description_zh || flow.description) : (flow.description_en || flow.description);
                    const isActive = activeFlowId === flow.id;

                    return (
                      <button
                        key={flow.id}
                        onClick={() => onSelectFlow(isActive ? null : flow.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all group ${
                          isActive
                            ? 'bg-indigo-900/30 border-indigo-500/50'
                            : 'bg-stone-800/50 border-stone-700/50 hover:bg-stone-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h3 className={`type-base font-bold ${isActive ? 'text-indigo-200' : 'text-stone-200 group-hover:text-white'}`}>
                            {name}
                          </h3>
                          {isActive && <ArrowRight size={14} className="text-indigo-400" />}
                        </div>
                        
                        <p className={`type-sm leading-tight ${isActive ? 'text-indigo-300/70' : 'text-stone-500 group-hover:text-stone-400'}`}>
                          {description}
                        </p>
                        
                        <div className="mt-2 flex items-center gap-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            isActive ? 'bg-indigo-900/50 text-indigo-300' : 'bg-stone-900 text-stone-500'
                          }`}>
                            {flow.nodeIds.length} {language === 'zh' ? '步骤' : 'Steps'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-stone-800 bg-stone-900 text-[10px] text-stone-500 text-center">
               {language === 'zh' ? '点击高亮特定流程路径' : 'Click to highlight specific flow path'}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
