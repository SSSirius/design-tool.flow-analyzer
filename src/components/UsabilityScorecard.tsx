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
                <ClipboardCheck className="text-stone-400" size={20} />
                <h2 className="type-lg font-bold text-stone-100">
                  {language === 'zh' ? '可用性评分' : 'Usability Scorecard'}
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
              {scores.length === 0 ? (
                <div className="text-center py-12 text-stone-500 type-sm">
                  {language === 'zh' ? '暂无评分数据' : 'No score data available'}
                </div>
              ) : (
                scores.map((item, index) => {
                  const category = language === 'zh' ? (item.category_zh || item.category) : (item.category_en || item.category);
                  const reason = language === 'zh' ? (item.reason_zh || item.reason) : (item.reason_en || item.reason);
                  
                  return (
                    <div key={index} className="bg-stone-800/50 border border-stone-700/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="type-base font-bold text-stone-200 flex-1 mr-2">{category}</h3>
                        <div className="flex items-center bg-stone-900 px-2 py-1 rounded border border-stone-700">
                          <Star size={12} className="text-amber-400 mr-1 fill-amber-400" />
                          <span className="font-mono font-bold text-stone-200">{item.score}</span>
                          <span className="text-stone-500 text-[10px] ml-0.5">/10</span>
                        </div>
                      </div>
                      
                      <p className="type-sm text-stone-400 leading-relaxed">
                        {reason}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="p-4 border-t border-stone-800 bg-stone-900 text-[10px] text-stone-500 text-center">
               {language === 'zh' ? '基于尼尔森十大可用性原则' : 'Based on Nielsen\'s Heuristics'}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
