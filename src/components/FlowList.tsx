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
            className="fixed inset-0 bg-black/45 z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="glass-panel fixed right-3 top-3 bottom-3 w-96 rounded-xl z-50 flex flex-col overflow-hidden"
          >
            <div className="p-4 ui-panel-header flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="ui-secondary" size={20} />
                <h2 className="type-lg font-bold text-white">
                  {language === 'zh' ? '流程场景' : 'User Flows'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md ui-icon-button"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {flows.length === 0 ? (
                <div className="text-center py-12 ui-muted type-sm">
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
                      ? 'ui-active-surface'
                      : 'bg-[var(--surface-panel)] border-[var(--border-default)] ui-secondary hover:bg-[var(--surface-control-hover)] hover:text-[var(--text-primary)]'
                      }`}
                  >
                    <span className="type-sm font-bold">
                      {language === 'zh' ? '显示全部' : 'Show All'}
                    </span>
                  </button>

                  {flows.map((flow, index) => {
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
                          ? 'bg-[var(--surface-control-active)] border-[var(--border-selected)]'
                          : 'bg-[var(--surface-panel)] border-[var(--border-default)] hover:bg-[var(--surface-control-hover)]'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <div className="flex min-w-0 items-start gap-2">
                            <span className={`sidebar-index-chip ds-chip ${isActive ? 'ds-chip--blue' : 'ds-chip--neutral'}`}>
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <h3 className={`type-sm font-bold ${isActive ? 'text-white' : 'text-[var(--text-primary)] group-hover:text-white'}`}>
                              {name}
                            </h3>
                          </div>
                          {isActive && <ArrowRight size={14} className="text-[var(--text-primary)]" />}
                        </div>

                        <p className={`type-sm leading-tight pl-[45px] ${isActive ? 'text-[var(--text-secondary)]' : 'ui-muted group-hover:ui-secondary'}`}>
                          {description}
                        </p>

                        <div className="mt-2 flex items-center gap-1.5 pl-[45px]">
                          <span className={`ds-chip ${isActive ? 'ds-chip--blue' : 'ds-chip--cyan'}`}>
                            {flow.nodeIds.length} {language === 'zh' ? '步骤' : 'Steps'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 ui-panel-footer type-xs ui-muted text-center">
              {language === 'zh' ? '点击高亮特定流程路径' : 'Click to highlight specific flow path'}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
