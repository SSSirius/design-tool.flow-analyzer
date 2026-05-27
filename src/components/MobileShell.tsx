import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Image as ImageIcon,
  Loader2,
  Settings2,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Languages,
  AlertTriangle,
} from 'lucide-react';
import { analyzeFlow, getStoredAiSettings, storeAiSettings } from '../services/ai';
import type { AiSettings, AnalysisResult } from '../types';
import MobileResultView from './MobileResultView';

interface Props {
  language: 'zh' | 'en';
  onToggleLanguage: () => void;
}

const COPY = {
  zh: {
    brand: 'Earl · UX Flow Analyzer',
    badge: '小屏阅读模式',
    contextLabel: '上下文与目标',
    contextPlaceholder: '例如：用户想要更新他们的个人资料图片，请帮我分析这个流程。',
    images: 'UI 截图（可选，最多 6 张）',
    pickImages: '上传或拍照',
    aiSettings: 'AI 设置',
    provider: '提供方',
    apiKey: 'API Key',
    baseUrl: 'Base URL',
    analysisModel: '分析模型',
    nodeModel: '节点模型',
    save: '保存设置',
    saved: '已保存',
    analyze: '开始分析',
    analyzing: '正在分析…',
    again: '重新分析',
    needContext: '请先填写上下文与目标',
    error: '分析失败',
    notice: '小屏不展示流程图，仅以文本/列表形式呈现分析结果',
  },
  en: {
    brand: 'Earl · UX Flow Analyzer',
    badge: 'Mobile reading mode',
    contextLabel: 'Context & Goal',
    contextPlaceholder: 'e.g. The user wants to update their profile picture. Please analyse this flow.',
    images: 'UI screenshots (optional, up to 6)',
    pickImages: 'Upload or take a photo',
    aiSettings: 'AI Settings',
    provider: 'Provider',
    apiKey: 'API Key',
    baseUrl: 'Base URL',
    analysisModel: 'Analysis model',
    nodeModel: 'Node model',
    save: 'Save settings',
    saved: 'Saved',
    analyze: 'Analyse',
    analyzing: 'Analysing…',
    again: 'Re-analyse',
    needContext: 'Please fill in the context first',
    error: 'Analysis failed',
    notice: 'Flow diagrams are not rendered on small screens; results are shown as plain text.',
  },
} as const;

const PROVIDERS: AiSettings['provider'][] = ['gemini', 'openai-compatible', 'z-ai-coding'];

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MobileShell({ language, onToggleLanguage }: Props) {
  const t = COPY[language];

  const [context, setContext] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => getStoredAiSettings());
  const [savedFlash, setSavedFlash] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 滚动到结果顶部，避免分析完后还停在表单区
  const resultAnchorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (result && resultAnchorRef.current) {
      resultAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [result]);

  const canAnalyze = useMemo(
    () => context.trim().length > 0 && !isAnalyzing,
    [context, isAnalyzing],
  );

  const handlePickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const next: string[] = [...images];
    for (const f of files) {
      if (next.length >= 6) break;
      try {
        next.push(await fileToBase64(f));
      } catch {
        /* skip */
      }
    }
    setImages(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      if (!context.trim()) setError(t.needContext);
      return;
    }
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await analyzeFlow(context.trim(), images, aiSettings);
      setResult(res);
    } catch (err: any) {
      setError(err?.message ? `${t.error}: ${err.message}` : t.error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveSettings = () => {
    storeAiSettings(aiSettings);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-[#0c0c0c] text-stone-100 overflow-y-auto">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[#1d1d1d] bg-[#0c0c0c]/90 backdrop-blur px-4 py-3">
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold leading-tight">{t.brand}</span>
          <span className="text-[10px] uppercase tracking-wider text-stone-500">{t.badge}</span>
        </div>
        <button
          type="button"
          onClick={onToggleLanguage}
          className="inline-flex items-center gap-1 rounded-full border border-[#262626] bg-[#161616] px-2.5 py-1 text-[11px] text-stone-300 active:scale-[0.98]"
        >
          <Languages size={12} />
          {language === 'zh' ? 'EN' : '中'}
        </button>
      </header>

      <div className="flex flex-col gap-4 px-4 py-4 pb-12">
        <p className="rounded-lg border border-[#222] bg-[#141414] px-3 py-2 text-[11px] leading-relaxed text-stone-400">
          {t.notice}
        </p>

        {/* Context */}
        <section className="flex flex-col gap-2">
          <label className="text-[12px] font-medium text-stone-300">
            {t.contextLabel}
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder={t.contextPlaceholder}
            className="min-h-[120px] resize-y rounded-lg border border-[#262626] bg-[#0e0e0e] px-3 py-2.5 text-[13px] text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-[#3a3a3a]"
          />
        </section>

        {/* Images */}
        <section className="flex flex-col gap-2">
          <label className="text-[12px] font-medium text-stone-300">{t.images}</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePickImages}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={images.length >= 6}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#2c2c2c] bg-[#101010] px-3 py-3 text-[12px] text-stone-300 active:scale-[0.99] disabled:opacity-50"
          >
            <ImageIcon size={14} />
            {t.pickImages}（{images.length}/6）
          </button>
          {images.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {images.map((src, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded-md border border-[#222] bg-[#0a0a0a]"
                >
                  <img
                    src={src}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setImages((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* AI settings collapsed */}
        <section className="rounded-lg border border-[#222] bg-[#0f0f0f]">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-[12px] text-stone-300"
          >
            <span className="inline-flex items-center gap-1.5">
              <Settings2 size={13} />
              {t.aiSettings}
            </span>
            {settingsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {settingsOpen && (
            <div className="flex flex-col gap-3 border-t border-[#1d1d1d] px-3 py-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-stone-500">{t.provider}</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {PROVIDERS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAiSettings((s) => ({ ...s, provider: p }))}
                      className={`rounded-md border px-2 py-1.5 text-[11px] ${
                        aiSettings.provider === p
                          ? 'border-stone-300 bg-stone-200 text-stone-900'
                          : 'border-[#262626] bg-[#141414] text-stone-300'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <LabelledInput
                label={t.apiKey}
                value={aiSettings.apiKey}
                onChange={(v) => setAiSettings((s) => ({ ...s, apiKey: v }))}
                type="password"
              />
              <LabelledInput
                label={t.baseUrl}
                value={aiSettings.baseUrl}
                onChange={(v) => setAiSettings((s) => ({ ...s, baseUrl: v }))}
              />
              <LabelledInput
                label={t.analysisModel}
                value={aiSettings.analysisModel}
                onChange={(v) => setAiSettings((s) => ({ ...s, analysisModel: v }))}
              />
              <LabelledInput
                label={t.nodeModel}
                value={aiSettings.nodeModel}
                onChange={(v) => setAiSettings((s) => ({ ...s, nodeModel: v }))}
              />

              <button
                type="button"
                onClick={handleSaveSettings}
                className="self-end rounded-md border border-[#262626] bg-[#1c1c1c] px-3 py-1.5 text-[11px] text-stone-200 active:scale-[0.99]"
              >
                {savedFlash ? t.saved : t.save}
              </button>
            </div>
          )}
        </section>

        {/* Action */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-stone-100 px-4 py-3 text-[13px] font-semibold text-stone-900 active:scale-[0.99] disabled:opacity-50"
          >
            {isAnalyzing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t.analyzing}
              </>
            ) : (
              <>
                <Sparkles size={14} />
                {result ? t.again : t.analyze}
              </>
            )}
          </button>
          {result && (
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setError(null);
              }}
              className="inline-flex items-center justify-center rounded-lg border border-[#262626] bg-[#141414] px-3 py-3 text-[12px] text-stone-300 active:scale-[0.99]"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-[#3a1f1f] bg-[#1d0e0e] px-3 py-2 text-[12px] text-red-300">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Result */}
        <div ref={resultAnchorRef} />
        {result && <MobileResultView result={result} language={language} />}
      </div>
    </div>
  );
}

function LabelledInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'password';
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-stone-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-[#262626] bg-[#0e0e0e] px-2.5 py-2 text-[12px] text-stone-100 focus:outline-none focus:border-[#3a3a3a]"
      />
    </label>
  );
}
