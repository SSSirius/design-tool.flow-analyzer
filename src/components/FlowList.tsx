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
            className="fixed inset-0 bg-black/45 backdrop-blur-xl z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="glass-panel fixed right-3 top-3 bottom-3 w-96 rounded-xl z-50 flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-[#303030] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="text-[#b8bcc7]" size={20} />
                <h2 className="type-lg font-bold text-white">
                  {language === 'zh' ? '流程场景' : 'User Flows'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-[#242424] rounded-md text-[#9da3af] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {flows.length === 0 ? (
                <div className="text-center py-12 text-[#777777] type-sm">
                  {language === 'zh' ? '暂无流程数据' : 'No flow scenarios available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {/* "All" option */}
                  <button
                    onClick={() => {
                      onSelectFlow(null);
                      onClose();
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${activeFlowId === null
                        ? 'bg-[#303030] border-[#565656] text-white'
                        : 'bg-[#1a1a1a] border-[#303030] text-[#9da3af] hover:bg-[#242424] hover:text-white'
                      }`}
                  >
                    <span className="type-sm font-bold">
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
                        onClick={() => {
                          onSelectFlow(isActive ? null : flow.id);
                          onClose();
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-all group ${isActive
                            ? 'bg-[#303030] border-[#565656]'
                            : 'bg-[#1a1a1a] border-[#303030] hover:bg-[#242424]'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <h3 className={`type-sm font-bold ${isActive ? 'text-white' : 'text-[#d7d9df] group-hover:text-white'}`}>
                            {name}
                          </h3>
                          {isActive && <ArrowRight size={14} className="text-[#d8d8d8]" />}
                        </div>

                        <p className={`type-sm leading-tight ${isActive ? 'text-[#d0d0d0]' : 'text-[#8a8a8a] group-hover:text-[#ababab]'}`}>
                          {description}
                        </p>

                        <div className="mt-2 flex items-center gap-1.5">
                          <span className={`type-xs px-1.5 py-0.5 rounded ${isActive ? 'bg-[#404040] text-white' : 'bg-[#242424] text-[#8a8a8a]'
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

            <div className="p-4 border-t border-[#303030] bg-[#181818] type-xs text-[#777777] text-center">
              {language === 'zh' ? '点击高亮特定流程路径' : 'Click to highlight specific flow path'}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
