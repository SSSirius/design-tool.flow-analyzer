import { X, FileStack } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PageSuggestion } from '../types';

interface PageSuggestionListProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: PageSuggestion[];
  language: 'zh' | 'en';
}

export default function PageSuggestionList({ isOpen, onClose, suggestions, language }: PageSuggestionListProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/45 backdrop-blur-xl z-40"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="glass-panel fixed right-3 top-3 bottom-3 w-96 rounded-xl z-50 flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-[#303030] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileStack className="text-[#b8bcc7]" size={20} />
                <h2 className="type-lg font-bold text-white">
                  {language === 'zh' ? '建议页面' : 'Suggested Pages'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-[#242424] rounded-md text-[#9da3af] hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-[#303030] bg-[#181818]">
              <div className="type-xs text-[#9da3af] leading-relaxed">
                {language === 'zh'
                  ? <>这个意图大约涉及 <span className="font-bold text-white">{suggestions.length}</span> 个独立路由页面（不含同页面的不同状态）</>
                  : <>This goal involves around <span className="font-bold text-white">{suggestions.length}</span> distinct routed pages (excluding in-page states)</>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {suggestions.length === 0 ? (
                <div className="text-center py-12 text-[#777777] type-sm">
                  {language === 'zh' ? '暂无页面建议' : 'No page suggestions yet'}
                </div>
              ) : (
                suggestions.map((item, index) => {
                  const name = language === 'zh' ? (item.name_zh || item.name) : (item.name_en || item.name);
                  const description = language === 'zh' ? (item.description_zh || item.description) : (item.description_en || item.description);

                  return (
                    <div key={index} className="glass-card rounded-lg p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-[#242424] border border-[#303030] flex items-center justify-center font-mono type-xs text-[#d8d8d8]">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="type-sm font-bold text-white mb-1">{name}</h3>
                          <p className="type-sm text-[#ababab] leading-relaxed">
                            {description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
