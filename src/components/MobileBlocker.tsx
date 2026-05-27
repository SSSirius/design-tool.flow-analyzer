import { useState } from 'react';
import { Monitor, Copy, Check, ArrowRight } from 'lucide-react';

interface Props {
  language: 'zh' | 'en';
  onBypass: () => void;
}

const COPY = {
  zh: {
    badge: '建议在桌面端使用',
    title: '请在桌面浏览器打开',
    desc: 'Earl · UX Flow Analyzer 依赖较大的画布空间来展示流程图、缩略图和侧边面板。当前屏幕过小，体验会受限——建议复制链接到桌面浏览器使用。',
    urlLabel: '当前链接',
    copy: '复制链接',
    copied: '已复制',
    bypass: '继续在小屏访问（不推荐）',
    tipTitle: '为什么需要桌面端？',
    tips: [
      '流程图布局需要横向空间，移动端无法展开多分支',
      '缩略图、聚焦面包屑、AI 设置入口都依赖角落控件',
      '阅读检查清单和异常路径在窄屏上会非常零散',
    ],
  },
  en: {
    badge: 'Best on desktop',
    title: 'Open this on a desktop browser',
    desc: 'Earl · UX Flow Analyzer relies on a wide canvas to show flow diagrams, the minimap, and side panels. Your current screen is too narrow for that — please copy the link and open it on a desktop browser.',
    urlLabel: 'Current URL',
    copy: 'Copy link',
    copied: 'Copied',
    bypass: 'Continue on small screen anyway',
    tipTitle: 'Why desktop?',
    tips: [
      'Horizontal flow layouts need width that mobile cannot provide',
      'Minimap, focus breadcrumb, and AI settings live in screen corners',
      'Reading checklists and edge-case paths is hard to scan on narrow screens',
    ],
  },
} as const;

export default function MobileBlocker({ language, onBypass }: Props) {
  const t = COPY[language];
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback: select an input — but on tap blockers, just no-op silently
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0c0c0c] px-5 py-8 text-stone-100">
      <div className="w-full max-w-md flex flex-col items-stretch gap-5">
        <div className="self-center inline-flex items-center gap-1.5 rounded-full border border-[#2a2a2a] bg-[#161616] px-2.5 py-1 text-[11px] text-stone-400">
          <Monitor size={12} />
          {t.badge}
        </div>

        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2a2a2a] bg-[#161616]">
            <Monitor size={26} className="text-stone-300" />
          </div>
          <h1 className="text-lg font-semibold leading-tight">{t.title}</h1>
          <p className="text-[13px] leading-relaxed text-stone-400">{t.desc}</p>
        </div>

        <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-3 flex flex-col gap-2">
          <div className="text-[11px] uppercase tracking-wider text-stone-500">
            {t.urlLabel}
          </div>
          <div className="break-all rounded-lg border border-[#262626] bg-[#0c0c0c] px-3 py-2 text-[12px] text-stone-200 font-mono">
            {url}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#2a2a2a] bg-[#1c1c1c] px-3 py-2 text-[12px] font-medium text-stone-100 hover:bg-[#222] active:scale-[0.99] transition"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? t.copied : t.copy}
          </button>
        </div>

        <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-3 flex flex-col gap-1.5">
          <div className="text-[11px] uppercase tracking-wider text-stone-500">
            {t.tipTitle}
          </div>
          <ul className="text-[12px] leading-relaxed text-stone-300 list-disc list-inside marker:text-stone-600 space-y-1">
            {t.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={onBypass}
          className="self-center inline-flex items-center gap-1 text-[12px] text-stone-500 hover:text-stone-300 transition underline-offset-4 hover:underline"
        >
          {t.bypass}
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
