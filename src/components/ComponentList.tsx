import { X, Layers, MousePointer2, Download, Crosshair } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ComponentData } from '../types';

interface ComponentListProps {
  isOpen: boolean;
  onClose: () => void;
  components: ComponentData[];
  language: 'zh' | 'en';
  // 点击某个组件 → 在画布上聚焦它出现的节点。null 表示退出聚焦。
  // 当前正聚焦的组件 index（来自父级，受控）；undefined 表示父级不接管聚焦行为。
  activeComponentIndex?: number | null;
  onFocusComponent?: (index: number | null) => void;
}

type ComponentCategory =
  | 'input'
  | 'action'
  | 'navigation'
  | 'container'
  | 'overlay'
  | 'feedback'
  | 'media'
  | 'form'
  | 'other';

// 按"交互语义"把 AI 给出的 type 字符串映射到一个颜色组。
// 输入侧用关键字数组而不是穷举映射 —— LLM 会输出各种近义词（"卡片" / "Card" /
// "灵感卡片组件"），按子串匹配比硬编码全集稳。
const CATEGORY_KEYWORDS: { category: ComponentCategory; keywords: string[] }[] = [
  // 优先级：越具体的越靠前，最后兜底成 'other'
  { category: 'overlay', keywords: ['modal', 'dialog', 'drawer', 'popover', 'tooltip', 'dropdown', 'bottomsheet', 'sheet', 'menu', 'context', '弹窗', '浮层', '抽屉', '气泡', '下拉', '菜单', 'overlay'] },
  { category: 'feedback', keywords: ['toast', 'notification', 'alert', 'banner', 'progress', 'spinner', 'loader', 'loading', 'skeleton', 'empty', 'error', 'badge', 'tag', 'chip', '通知', '提示', '加载', '骨架', '空态', '错误', '徽章', '标签'] },
  { category: 'navigation', keywords: ['tab', 'breadcrumb', 'pagination', 'stepper', 'sidebar', 'navbar', 'navigation', 'nav', '导航', '标签页', '面包屑', '分页', '步骤'] },
  { category: 'container', keywords: ['card', 'list', 'listitem', 'item', 'table', 'grid', 'row', 'section', 'panel', 'accordion', 'collapse', '卡片', '列表', '表格', '面板', '容器', '折叠'] },
  { category: 'media', keywords: ['avatar', 'image', 'icon', 'video', 'chart', 'map', 'thumbnail', '头像', '图片', '图标', '视频', '图表', '地图', '缩略图'] },
  { category: 'form', keywords: ['form', 'field', 'label', 'upload', 'datepicker', 'date-picker', 'timepicker', 'colorpicker', '表单', '字段', '上传', '日期', '时间'] },
  { category: 'input', keywords: ['input', 'textarea', 'textfield', 'search', 'select', 'picker', 'switch', 'toggle', 'slider', 'checkbox', 'radio', 'rating', 'stepper-input', '输入', '搜索', '选择', '开关', '滑块', '复选', '单选', '评分'] },
  { category: 'action', keywords: ['button', 'btn', 'link', 'fab', 'iconbutton', '按钮', '链接'] },
];

const categorize = (type: string | undefined): ComponentCategory => {
  if (!type) return 'other';
  const t = type.toLowerCase();
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some(kw => t.includes(kw))) return category;
  }
  return 'other';
};

export default function ComponentList({ isOpen, onClose, components, language, activeComponentIndex, onFocusComponent }: ComponentListProps) {
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
                <Layers className="text-[#b8bcc7]" size={20} />
                <h2 className="type-lg font-bold text-white">
                  {language === 'zh' ? '组件列表' : 'Component List'}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleExport}
                  className="p-1 hover:bg-[#242424] rounded-md text-[#9da3af] hover:text-white transition-colors"
                  title={language === 'zh' ? '导出列表' : 'Export List'}
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-[#242424] rounded-md text-[#9da3af] hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {components.length === 0 ? (
                <div className="text-center py-12 text-[#777777] type-sm">
                  {language === 'zh' ? '暂无组件数据' : 'No component data available'}
                </div>
              ) : (
                components.map((comp, index) => {
                  const name = language === 'zh' ? (comp.name_zh || comp.name) : (comp.name_en || comp.name);
                  const states = language === 'zh' ? (comp.states_zh || comp.states) : (comp.states_en || comp.states);
                  const isFocused = activeComponentIndex === index;
                  // 没有 nodeIds 的组件无法聚焦（老数据 / AI 漏给）。这种情况下聚焦按钮禁用，
                  // 但仍然展示该卡片，避免数据不完整的组件直接消失。
                  const canFocus = !!onFocusComponent && !!comp.nodeIds && comp.nodeIds.length > 0;
                  const handleToggleFocus = () => {
                    if (!canFocus || !onFocusComponent) return;
                    onFocusComponent(isFocused ? null : index);
                  };

                  return (
                    <div
                      key={index}
                      className={`component-card${isFocused ? ' component-card--focused' : ''}`}
                    >
                      <div className="component-card-header">
                        <h3 className="component-card-title">{name}</h3>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="component-card-type"
                            data-category={categorize(comp.type)}
                          >
                            {comp.type}
                          </span>
                          {canFocus && (
                            <button
                              type="button"
                              onClick={handleToggleFocus}
                              className={`component-card-focus-btn${isFocused ? ' component-card-focus-btn--active' : ''}`}
                              title={
                                language === 'zh'
                                  ? (isFocused ? '退出聚焦' : `聚焦此组件出现的 ${comp.nodeIds!.length} 个节点`)
                                  : (isFocused ? 'Exit focus' : `Focus ${comp.nodeIds!.length} related nodes`)
                              }
                            >
                              {isFocused ? <X size={12} /> : <Crosshair size={12} />}
                            </button>
                          )}
                        </div>
                      </div>

                      {states && states.length > 0 && (
                        <div className="mt-2">
                          <div className="component-card-section-label">
                            <MousePointer2 size={12} className="text-[#777777]" />
                            {language === 'zh' ? '交互状态' : 'States'}
                          </div>
                          <div className="component-card-tag-group">
                            {states.map((state, idx) => (
                              <span key={idx} className="component-card-tag">
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

            <div className="list-empty-footer">
              {language === 'zh' ? '基于一致性原则识别的组件' : 'Components identified based on consistency'}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
