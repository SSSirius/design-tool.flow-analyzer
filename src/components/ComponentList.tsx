import { X, Layers, MousePointer2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ComponentData } from '../types';

interface ComponentListProps {
  isOpen: boolean;
  onClose: () => void;
  components: ComponentData[];
  language: 'zh' | 'en';
}

export default function ComponentList({ isOpen, onClose, components, language }: ComponentListProps) {
  const handleExport = () => {
    let content = `# Component List\n\n`;
    
    components.forEach(comp => {
      const name = language === 'zh' ? (comp.name_zh || comp.name) : (comp.name_en || comp.name);
      const states = language === 'zh' ? (comp.states_zh || comp.states) : (comp.states_en || comp.states);
      
      content += `## ${name} (${comp.type})\n`;
      if (states && states.length > 0) {
        content += `States: ${states.join(', ')}\n`;
      }
      content += `\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'components.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
                <Layers className="text-stone-400" size={20} />
                <h2 className="type-lg font-bold text-stone-100">
                  {language === 'zh' ? '组件列表' : 'Component List'}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleExport}
                  className="p-1 hover:bg-stone-800 rounded-full text-stone-400 hover:text-stone-200 transition-colors"
                  title={language === 'zh' ? '导出列表' : 'Export List'}
                >
                  <Download size={18} />
                </button>
                <button 
                  onClick={onClose}
                  className="p-1 hover:bg-stone-800 rounded-full text-stone-400 hover:text-stone-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {components.length === 0 ? (
                <div className="text-center py-12 text-stone-500 type-sm">
                  {language === 'zh' ? '暂无组件数据' : 'No component data available'}
                </div>
              ) : (
                components.map((comp, index) => {
                  const name = language === 'zh' ? (comp.name_zh || comp.name) : (comp.name_en || comp.name);
                  const states = language === 'zh' ? (comp.states_zh || comp.states) : (comp.states_en || comp.states);
                  
                  return (
                    <div key={index} className="bg-stone-800/50 border border-stone-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="type-base font-bold text-stone-200">{name}</h3>
                        <span className="text-[10px] uppercase tracking-wider font-mono bg-stone-800 px-1.5 py-0.5 rounded text-stone-500 border border-stone-700">
                          {comp.type}
                        </span>
                      </div>
                      
                      {states && states.length > 0 && (
                        <div className="mt-2">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <MousePointer2 size={12} className="text-stone-500" />
                            <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider">
                              {language === 'zh' ? '交互状态' : 'States'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {states.map((state, idx) => (
                              <span 
                                key={idx}
                                className="inline-flex items-center px-2 py-1 rounded bg-stone-800 border border-stone-700 text-stone-400 text-[11px]"
                              >
                                {state}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="p-4 border-t border-stone-800 bg-stone-900 text-[10px] text-stone-500 text-center">
               {language === 'zh' ? '基于一致性原则识别的组件' : 'Components identified based on consistency'}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
