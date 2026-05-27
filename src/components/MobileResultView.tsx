import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ListChecks,
  AlertCircle,
  HelpCircle,
  GitBranch,
  Layers,
  Gauge,
  FileStack,
  ScanSearch,
} from 'lucide-react';
import type { AnalysisResult, FlowNodeData } from '../types';

interface Props {
  result: AnalysisResult;
  language: 'zh' | 'en';
}

const COPY = {
  zh: {
    summary: '摘要',
    flows: '流程场景',
    nodes: '节点详情',
    components: '页面组件',
    scores: '可用性评分',
    suggestions: '页面级建议',
    nodeStart: '开始',
    nodeAction: '动作',
    nodeDecision: '判断',
    edgeCases: '异常情况',
    checklist: '检查清单',
    questions: '健壮性问题',
    states: '状态',
    pages: '出现页面',
    relatedNodes: '相关节点',
    noFlows: '未识别到独立流程场景',
    noComponents: '未识别到组件',
    noScores: '本次没有评分输出',
    noSuggestions: '本次没有页面级建议',
  },
  en: {
    summary: 'Summary',
    flows: 'Flow scenarios',
    nodes: 'Nodes',
    components: 'Components',
    scores: 'Usability scores',
    suggestions: 'Page suggestions',
    nodeStart: 'Start',
    nodeAction: 'Action',
    nodeDecision: 'Decision',
    edgeCases: 'Edge cases',
    checklist: 'Checklist',
    questions: 'Robustness questions',
    states: 'States',
    pages: 'Appears on',
    relatedNodes: 'Related nodes',
    noFlows: 'No standalone flow scenarios.',
    noComponents: 'No components detected.',
    noScores: 'No usability scores returned.',
    noSuggestions: 'No page-level suggestions.',
  },
} as const;

function pickLocalised(zh: string | undefined, en: string | undefined, fallback: string, lang: 'zh' | 'en') {
  if (lang === 'zh') return zh ?? fallback;
  return en ?? fallback;
}
function pickLocalisedArr(zh: string[] | undefined, en: string[] | undefined, fallback: string[] | undefined, lang: 'zh' | 'en') {
  if (lang === 'zh') return zh ?? fallback ?? [];
  return en ?? fallback ?? [];
}

function NodeBadge({ type, t }: { type?: FlowNodeData['type']; t: typeof COPY['zh'] }) {
  const map = {
    start: { text: t.nodeStart, cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
    action: { text: t.nodeAction, cls: 'bg-sky-500/15 text-sky-300 border-sky-500/25' },
    decision: { text: t.nodeDecision, cls: 'bg-amber-500/15 text-amber-300 border-amber-500/25' },
  } as const;
  const info = map[type ?? 'action'] ?? map.action;
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] ${info.cls}`}>
      {info.text}
    </span>
  );
}

export default function MobileResultView({ result, language }: Props) {
  const t = COPY[language];

  const summary = pickLocalised(result.summary_zh, result.summary_en, result.summary, language);

  // Build a node lookup so flow nodeIds can render labels in order.
  const nodeMap = useMemo(() => {
    const m = new Map<string, typeof result.nodes[number]>();
    for (const n of result.nodes) m.set(n.id, n);
    return m;
  }, [result.nodes]);

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      {summary && (
        <Section title={t.summary} icon={<ScanSearch size={14} />}>
          <p className="text-[13px] leading-relaxed text-stone-200 whitespace-pre-wrap">{summary}</p>
        </Section>
      )}

      {/* Flows */}
      <Section title={t.flows} icon={<GitBranch size={14} />}>
        {result.flows && result.flows.length > 0 ? (
          <div className="flex flex-col gap-2">
            {result.flows.map((f) => {
              const name = pickLocalised(f.name_zh, f.name_en, f.name, language);
              const desc = pickLocalised(f.description_zh, f.description_en, f.description, language);
              return (
                <Collapsible key={f.id} title={name} subtitle={desc}>
                  <ol className="list-decimal list-inside text-[12px] leading-relaxed text-stone-200 space-y-1 marker:text-stone-500">
                    {f.nodeIds.map((id, idx) => {
                      const n = nodeMap.get(id);
                      if (!n) return null;
                      const label = pickLocalised(n.data.label_zh, n.data.label_en, n.data.label, language);
                      // key 用 `${id}-${idx}`：同一节点在一条流程中可能被访问多次
                      // （例如枢纽页 → 子页 → 回到枢纽页），不能只拿 id 做 key
                      return <li key={`${id}-${idx}`}>{label}</li>;
                    })}
                  </ol>
                </Collapsible>
              );
            })}
          </div>
        ) : (
          <Empty text={t.noFlows} />
        )}
      </Section>

      {/* Nodes detail */}
      <Section title={t.nodes} icon={<Layers size={14} />}>
        <div className="flex flex-col gap-2">
          {result.nodes.map((n) => {
            const label = pickLocalised(n.data.label_zh, n.data.label_en, n.data.label, language);
            const desc = pickLocalised(n.data.description_zh, n.data.description_en, n.data.description ?? '', language);
            const edgeCases = pickLocalisedArr(n.data.edgeCases_zh, n.data.edgeCases_en, n.data.edgeCases, language);
            const checklist = pickLocalisedArr(n.data.checklist_zh, n.data.checklist_en, n.data.checklist, language);
            const questions = pickLocalisedArr(n.data.questions_zh, n.data.questions_en, n.data.questions, language);

            return (
              <Collapsible
                key={n.id}
                title={
                  <span className="inline-flex items-center gap-2">
                    <NodeBadge type={n.data.type} t={t} />
                    <span>{label}</span>
                  </span>
                }
                subtitle={desc}
              >
                <div className="flex flex-col gap-2.5">
                  {edgeCases.length > 0 && (
                    <BulletList icon={<AlertCircle size={12} />} title={t.edgeCases} items={edgeCases} tone="amber" />
                  )}
                  {checklist.length > 0 && (
                    <BulletList icon={<ListChecks size={12} />} title={t.checklist} items={checklist} tone="sky" />
                  )}
                  {questions.length > 0 && (
                    <BulletList icon={<HelpCircle size={12} />} title={t.questions} items={questions} tone="violet" />
                  )}
                </div>
              </Collapsible>
            );
          })}
        </div>
      </Section>

      {/* Components */}
      <Section title={t.components} icon={<FileStack size={14} />}>
        {result.components && result.components.length > 0 ? (
          <div className="flex flex-col gap-2">
            {result.components.map((c, i) => {
              const name = pickLocalised(c.name_zh, c.name_en, c.name, language);
              const states = pickLocalisedArr(c.states_zh, c.states_en, c.states, language);
              const pages = pickLocalisedArr(c.pages_zh, c.pages_en, c.pages, language);
              return (
                <div key={i} className="rounded-lg border border-[#1f1f1f] bg-[#111] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-stone-100">{name}</span>
                    <span className="rounded-full border border-[#262626] bg-[#1a1a1a] px-1.5 py-0.5 text-[10px] text-stone-400">
                      {c.type}
                    </span>
                  </div>
                  {states.length > 0 && (
                    <Inline title={t.states} items={states} />
                  )}
                  {pages.length > 0 && (
                    <Inline title={t.pages} items={pages} />
                  )}
                  {c.nodeIds && c.nodeIds.length > 0 && (
                    <Inline
                      title={t.relatedNodes}
                      items={c.nodeIds
                        .map((id) => {
                          const n = nodeMap.get(id);
                          if (!n) return null;
                          return pickLocalised(n.data.label_zh, n.data.label_en, n.data.label, language);
                        })
                        .filter((x): x is string => Boolean(x))}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text={t.noComponents} />
        )}
      </Section>

      {/* Scores */}
      <Section title={t.scores} icon={<Gauge size={14} />}>
        {result.usabilityScores && result.usabilityScores.length > 0 ? (
          <div className="flex flex-col gap-2">
            {result.usabilityScores.map((s, i) => {
              const cat = pickLocalised(s.category_zh, s.category_en, s.category, language);
              const reason = pickLocalised(s.reason_zh, s.reason_en, s.reason, language);
              const pct = Math.max(0, Math.min(100, s.score));
              return (
                <div key={i} className="rounded-lg border border-[#1f1f1f] bg-[#111] p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-stone-100">{cat}</span>
                    <span className="text-[12px] tabular-nums text-stone-300">{s.score}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1a1a1a]">
                    <div
                      className="h-full rounded-full bg-stone-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {reason && (
                    <p className="text-[11px] leading-relaxed text-stone-400">{reason}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text={t.noScores} />
        )}
      </Section>

      {/* Page suggestions */}
      <Section title={t.suggestions} icon={<ListChecks size={14} />}>
        {result.pageSuggestions && result.pageSuggestions.length > 0 ? (
          <div className="flex flex-col gap-2">
            {result.pageSuggestions.map((p, i) => {
              const name = pickLocalised(p.name_zh, p.name_en, p.name, language);
              const desc = pickLocalised(p.description_zh, p.description_en, p.description, language);
              return (
                <div key={i} className="rounded-lg border border-[#1f1f1f] bg-[#111] p-3">
                  <div className="text-[13px] font-medium text-stone-100">{name}</div>
                  {desc && (
                    <p className="mt-1 text-[12px] leading-relaxed text-stone-400">{desc}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Empty text={t.noSuggestions} />
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-stone-500">
        {icon}
        <span>{title}</span>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Collapsible({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-[#111] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left active:bg-[#161616]"
      >
        <span className="mt-0.5 text-stone-500">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="flex-1 flex flex-col gap-0.5">
          <span className="text-[13px] text-stone-100">{title}</span>
          {subtitle && (
            <span className="text-[11px] leading-relaxed text-stone-500">{subtitle}</span>
          )}
        </span>
      </button>
      {open && <div className="border-t border-[#1d1d1d] px-3 py-2.5">{children}</div>}
    </div>
  );
}

function BulletList({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: 'amber' | 'sky' | 'violet';
}) {
  const toneCls =
    tone === 'amber'
      ? 'text-amber-300'
      : tone === 'sky'
      ? 'text-sky-300'
      : 'text-violet-300';
  return (
    <div className="flex flex-col gap-1">
      <div className={`inline-flex items-center gap-1 text-[11px] ${toneCls}`}>
        {icon}
        <span>{title}</span>
      </div>
      <ul className="list-disc list-inside text-[12px] leading-relaxed text-stone-200 marker:text-stone-600 space-y-0.5">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

function Inline({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-1.5">
      <div className="text-[10px] uppercase tracking-wider text-stone-500">{title}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((s, i) => (
          <span
            key={i}
            className="rounded-full border border-[#262626] bg-[#161616] px-2 py-0.5 text-[11px] text-stone-300"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#262626] bg-[#0e0e0e] px-3 py-3 text-[12px] text-stone-500">
      {text}
    </div>
  );
}
