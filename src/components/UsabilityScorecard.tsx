import { X, ClipboardCheck, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UsabilityScore } from '../types';

interface UsabilityScorecardProps {
  isOpen: boolean;
  onClose: () => void;
  scores: UsabilityScore[];
  language: 'zh' | 'en';
}

export default function UsabilityScorecard({ isOpen, onClose, scores, language }: UsabilityScorecardProps) {
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
                <ClipboardCheck className="text-[#b8bcc7]" size={20} />
                <h2 className="type-lg font-bold text-white">
                  {language === 'zh' ? '可用性评分' : 'Usability Scorecard'}
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
              {scores.length === 0 ? (
                <div className="text-center py-12 text-[#777777] type-sm">
                  {language === 'zh' ? '暂无评分数据' : 'No score data available'}
                </div>
              ) : (
                scores.map((item, index) => {
                  const category = language === 'zh' ? (item.category_zh || item.category) : (item.category_en || item.category);
                  const reason = language === 'zh' ? (item.reason_zh || item.reason) : (item.reason_en || item.reason);

                  return (
                    <div key={index} className="glass-card rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="type-sm font-bold text-white flex-1 mr-2">{category}</h3>
                        <div className="flex items-center bg-[#242424] px-2 py-1 rounded-md border border-[#303030]">
                          <Star size={12} className="text-amber-400 mr-1 fill-amber-400" />
                          <span className="font-mono font-bold text-white">{item.score}</span>
                          <span className="text-[#777777] type-xs ml-0.5">/10</span>
                        </div>
                      </div>

                      <p className="type-sm text-[#ababab] leading-relaxed">
                        {reason}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-[#303030] bg-[#181818] type-xs text-[#777777] text-center">
              {language === 'zh' ? '基于尼尔森十大可用性原则' : 'Based on Nielsen\'s Heuristics'}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
