import { useState, useCallback, useEffect, useRef } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState, addEdge, Connection, Node, Edge, useReactFlow } from 'reactflow';
import InputPanel from './components/InputPanel';
import FlowEditor from './components/FlowEditor';
import ComponentList from './components/ComponentList';
import UsabilityScorecard from './components/UsabilityScorecard';
import PageSuggestionList from './components/PageSuggestionList';
import FlowList from './components/FlowList';
import { analyzeFlow } from './services/ai';
import { AiSettings, AnalysisResult, ComponentData, UsabilityScore, PageSuggestion, FlowPath } from './types';
import { Download, Languages, Layers, ClipboardCheck, ChevronDown, ChevronUp, GitBranch, Loader2, ScanSearch, BrainCircuit, Sparkles, FileStack, Network, Share2, X as CloseIcon } from 'lucide-react';
import { getLayoutedElements } from './utils/layout';
import { motion, AnimatePresence } from 'motion/react';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 80, y: 260 },
    data: {
      label: '开始',
      description: '先在设置项里接入 AI，然后上传 UI 截图，或输入你的流程背景。',
      type: 'start',
      label_zh: '开始',
      label_en: 'Start',
      description_zh: '先在设置项里接入 AI，然后上传 UI 截图，或输入你的流程背景。',
      description_en: 'Connect AI in Settings, then upload UI screenshots or describe your flow context.',
      variant: 'onboarding',
      onboardingStep: '准备',
      onboardingStep_zh: '准备',
      onboardingStep_en: 'Setup',
      layoutDirection: 'LR',
      uiLanguage: 'zh',
    },
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 620, y: 40 },
    data: {
      label: '流程拆解',
      description: '把页面、动作和路径整理成可检查的流程节点，先看清用户怎么走。',
      type: 'action',
      label_zh: '流程拆解',
      label_en: 'Flow Breakdown',
      description_zh: '把页面、动作和路径整理成可检查的流程节点，先看清用户怎么走。',
      description_en: 'Turn pages, actions, and paths into inspectable flow nodes so the user journey is clear.',
      variant: 'onboarding',
      onboardingStep: '功能 01',
      onboardingStep_zh: '功能 01',
      onboardingStep_en: 'Feature 01',
      layoutDirection: 'LR',
      uiLanguage: 'zh',
    },
  },
  {
    id: '3',
    type: 'custom',
    position: { x: 620, y: 260 },
    data: {
      label: '边界情况识别',
      description: '围绕每个节点提示空状态、失败反馈、权限限制、加载中断和异常路径。',
      type: 'decision',
      label_zh: '边界情况识别',
      label_en: 'Edge Case Discovery',
      description_zh: '围绕每个节点提示空状态、失败反馈、权限限制、加载中断和异常路径。',
      description_en: 'For each node, surface empty states, failure feedback, permission limits, loading breaks, and exception paths.',
      variant: 'onboarding',
      onboardingStep: '功能 02',
      onboardingStep_zh: '功能 02',
      onboardingStep_en: 'Feature 02',
      layoutDirection: 'LR',
      uiLanguage: 'zh',
    },
  },
  {
    id: '4',
    type: 'custom',
    position: { x: 620, y: 480 },
    data: {
      label: '检查清单生成',
      description: '把设计风险整理成可执行的检查项和健壮性问题，方便评审前逐项确认。',
      type: 'action',
      label_zh: '检查清单生成',
      label_en: 'Checklist Generation',
      description_zh: '把设计风险整理成可执行的检查项和健壮性问题，方便评审前逐项确认。',
      description_en: 'Convert design risks into actionable checklist items and robustness questions before review.',
      variant: 'onboarding',
      onboardingStep: '功能 03',
      onboardingStep_zh: '功能 03',
      onboardingStep_en: 'Feature 03',
      layoutDirection: 'LR',
      uiLanguage: 'zh',
    },
  },
];

const initialEdges: Edge[] = [
  {
    id: 'onboarding-1-2',
    source: '1',
    target: '2',
    type: 'labeled',
    animated: false,
    data: { static: true },
    style: { stroke: 'rgba(255,255,255,0.22)', strokeWidth: 1.2 },
  },
  {
    id: 'onboarding-1-3',
    source: '1',
    target: '3',
    type: 'labeled',
    animated: false,
    data: { static: true },
    style: { stroke: 'rgba(255,255,255,0.22)', strokeWidth: 1.2 },
  },
  {
    id: 'onboarding-1-4',
    source: '1',
    target: '4',
    type: 'labeled',
    animated: false,
    data: { static: true },
    style: { stroke: 'rgba(255,255,255,0.22)', strokeWidth: 1.2 },
  },
];

const LoadingOverlay = ({ language }: { language: 'zh' | 'en' }) => {
  const [step, setStep] = useState(0);

  const steps = language === 'zh' ? [
    { icon: ScanSearch, text: "正在扫描界面元素..." },
    { icon: BrainCircuit, text: "分析交互逻辑..." },
    { icon: GitBranch, text: "构建用户流程..." },
    { icon: Sparkles, text: "生成最终报告..." }
  ] : [
    { icon: ScanSearch, text: "Scanning UI elements..." },
    { icon: BrainCircuit, text: "Analyzing interaction logic..." },
    { icon: GitBranch, text: "Building user flows..." },
    { icon: Sparkles, text: "Generating final report..." }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep(s => (s < steps.length - 1 ? s + 1 : s));
    }, 2500); // Simulate progress every 2.5s
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex flex-col items-center justify-center"
    >
      <div className="loading-panel">
        <div className="loading-panel-header">
          <Loader2 size={34} className="loading-spinner" />
          <span className="ds-chip ds-chip--neutral">
            {language === 'zh' ? 'ANALYZING' : 'ANALYZING'}
          </span>
        </div>

        <div className="loading-step-list">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isCompleted = i < step;

            return (
              <div key={i} className={`loading-step ${isActive ? 'loading-step--active' : ''} ${isCompleted ? 'loading-step--done' : ''}`}>
                <div className="loading-step-icon">
                  <Icon size={15} />
                </div>
                <span>{s.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};

// Extracted FloatingActions component to use useReactFlow
const FloatingActions = ({
  language,
  setLanguage,
  flows,
  setShowFlowList,
  activeFlowId,
  usabilityScores,
  setShowUsabilityScorecard,
  pageSuggestions,
  setShowPageSuggestions,
  components,
  setShowComponentList,
  onLayout,
  setNodes,
  setEdges,
  setSummary,
  setFullResult,
  setComponents,
  setUsabilityScores,
  setPageSuggestions,
  setFlows,
  setActiveFlowId,
  setActiveComponentIndex,
  handleExportChecklist,
  layoutDirection,
  hasContent,
}: any) => {
  const { project, getViewport } = useReactFlow();

  const handleAddStep = () => {
    const id = Math.random().toString(36).substr(2, 9);

    // Calculate center of current viewport
    const { x, y, zoom } = getViewport();
    // The viewport center in screen coordinates is window.innerWidth / 2, window.innerHeight / 2
    // But we need to account for the sidebar (320px width)
    const screenCenterX = 320 + (window.innerWidth - 320) / 2;
    const screenCenterY = window.innerHeight / 2;

    // Project screen coordinates to flow coordinates
    const position = project({ x: screenCenterX, y: screenCenterY });

    // Add a little randomness so multiple clicks don't stack perfectly
    position.x += (Math.random() - 0.5) * 50;
    position.y += (Math.random() - 0.5) * 50;

    const newNode: Node = {
      id,
      type: 'custom',
      position,
      data: {
        label: language === 'zh' ? '新步骤' : 'New Step',
        label_zh: '新步骤',
        label_en: 'New Step',
        description: language === 'zh' ? '描述...' : 'Description...',
        description_zh: '描述...',
        description_en: 'Description...',
        type: 'action',
        variant: 'manual',
        layoutDirection,
        uiLanguage: language,
      },
    };

    setNodes((nds: Node[]) => nds.concat(newNode));

    if (activeFlowId) {
      setFlows((prevFlows: FlowPath[]) => prevFlows.map(f => {
        if (f.id === activeFlowId) {
          return {
            ...f,
            nodeIds: [...f.nodeIds, id]
          };
        }
        return f;
      }));
    }
  };

  return (
    <div className="floating-actions absolute top-0 right-0 flex gap-2">
      <button
        onClick={() => setLanguage((l: string) => l === 'zh' ? 'en' : 'zh')}
        className="glass-button text-[var(--text-primary)] px-3 py-1.5 rounded-md type-sm  transition-all flex items-center"
        title="Toggle Language"
      >
        <Languages size={14} className="mr-1.5" />
        {language === 'zh' ? 'EN' : '中文'}
      </button>
      <div className="w-px h-6 bg-white/15 mx-1 self-center"></div>

      {flows.length > 0 && (
        <button
          onClick={() => setShowFlowList(true)}
          className={`border shadow-sm px-3 py-1.5 rounded-md type-sm transition-all flex items-center ${activeFlowId
            ? 'ui-active-surface hover:bg-[#3a3a3a]'
            : 'glass-button text-[var(--text-primary)]'
            }`}
        >
          <GitBranch size={14} className="mr-1.5" />
          {language === 'zh' ? '流程场景' : 'Flows'}
        </button>
      )}

      {usabilityScores.length > 0 && (
        <button
          onClick={() => setShowUsabilityScorecard(true)}
          className="glass-button text-[var(--text-primary)] px-3 py-1.5 rounded-md type-sm  transition-all flex items-center"
        >
          <ClipboardCheck size={14} className="mr-1.5" />
          {language === 'zh' ? '可用性评分' : 'Scorecard'}
        </button>
      )}

      {usabilityScores.length === 0 && pageSuggestions.length > 0 && (
        <button
          onClick={() => setShowPageSuggestions(true)}
          className="glass-button text-[var(--text-primary)] px-3 py-1.5 rounded-md type-sm  transition-all flex items-center"
          title={language === 'zh' ? '至少需要的独立路由页面' : 'Minimum routed pages needed'}
        >
          <FileStack size={14} className="mr-1.5" />
          {language === 'zh' ? `建议页面 · ${pageSuggestions.length}` : `Pages · ${pageSuggestions.length}`}
        </button>
      )}

      {components.length > 0 && (
        <button
          onClick={() => setShowComponentList(true)}
          className="glass-button text-[var(--text-primary)] px-3 py-1.5 rounded-md type-sm  transition-all flex items-center"
        >
          <Layers size={14} className="mr-1.5" />
          {language === 'zh' ? '组件列表' : 'Components'}
        </button>
      )}

      <button
        onClick={() => onLayout('LR')}
        className="glass-button text-[var(--text-primary)] px-3 py-1.5 rounded-md type-sm  transition-all flex items-center"
        title={language === 'zh' ? '水平布局 (脑图)' : 'Horizontal Layout'}
      >
        <Share2 size={14} className="mr-1.5" />
        {language === 'zh' ? '脑图布局' : 'Map Layout'}
      </button>

      <button
        onClick={() => onLayout('TB')}
        className="glass-button text-[var(--text-primary)] px-3 py-1.5 rounded-md type-sm  transition-all flex items-center"
        title={language === 'zh' ? '垂直布局 (流程图)' : 'Vertical Layout'}
      >
        <Network size={14} className="mr-1.5" />
        {language === 'zh' ? '流程布局' : 'Flow Layout'}
      </button>

      <button
        onClick={handleAddStep}
        className="glass-button min-h-11 text-[var(--text-primary)] px-5 py-2 rounded-lg type-sm  transition-all"
      >
        + {language === 'zh' ? '添加步骤' : 'Add Step'}
      </button>
      <button
        onClick={() => {
          setNodes([]);
          setEdges([]);
          setSummary(null);
          setFullResult(null);
          setComponents([]);
          setUsabilityScores([]);
          setPageSuggestions([]);
          setFlows([]);
          setActiveFlowId(null);
          setActiveComponentIndex(null);
        }}
        className="glass-button text-[var(--text-primary)] px-3 py-1.5 rounded-md type-sm  transition-all"
      >
        {language === 'zh' ? '清空' : 'Clear'}
      </button>
      <button
        onClick={handleExportChecklist}
        disabled={!hasContent}
        title={
          hasContent
            ? (language === 'zh' ? '导出当前流程清单为 Markdown' : 'Export current checklist as Markdown')
            : (language === 'zh' ? '暂无可导出的清单内容' : 'No checklist content yet')
        }
        className={`glass-primary px-3 py-1.5 rounded-md type-sm  flex items-center transition-all ${hasContent ? '' : 'opacity-40 cursor-not-allowed'
          }`}
      >
        <Download size={14} className="mr-2" />
        {language === 'zh' ? '导出清单' : 'Export Checklist'}
      </button>
    </div>
  );
};

export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [fullResult, setFullResult] = useState<AnalysisResult | null>(null);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const [showComponentList, setShowComponentList] = useState(false);
  const [showUsabilityScorecard, setShowUsabilityScorecard] = useState(false);
  const [showPageSuggestions, setShowPageSuggestions] = useState(false);
  const [showFlowList, setShowFlowList] = useState(false);
  const [components, setComponents] = useState<ComponentData[]>([]);
  const [usabilityScores, setUsabilityScores] = useState<UsabilityScore[]>([]);
  const [pageSuggestions, setPageSuggestions] = useState<PageSuggestion[]>([]);
  const [flows, setFlows] = useState<FlowPath[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  // 聚焦某个组件 —— 高亮它出现的所有节点。和 activeFlowId 互斥（同一时刻最多
  // 聚焦一个东西，避免视觉上"两个高亮集合"叠加导致用户搞不清当前在看什么）。
  // 用 index 而不是 name，是因为 ComponentData 里没有稳定 id，AI 出来的 name
  // 可能重复或有空格变种，index 在当次会话里是稳定且 O(1) 的。
  const [activeComponentIndex, setActiveComponentIndex] = useState<number | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [layoutDirection, setLayoutDirection] = useState<'LR' | 'TB'>('LR');
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // Layout function
  const onLayout = useCallback((direction = 'LR') => {
    const normalizedDirection = direction === 'TB' ? 'TB' : 'LR';
    setLayoutDirection(normalizedDirection);
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodesRef.current.map((node) => ({
        ...node,
        data: {
          ...node.data,
          layoutDirection: normalizedDirection,
        },
      })),
      edgesRef.current,
      normalizedDirection
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [setNodes, setEdges]);

  // Handle Flow / Component Focus —— 两种聚焦走同一套高亮/淡出逻辑。
  // 聚焦源来自：activeFlowId（按 flow 高亮 nodeIds 序列） 或
  // activeComponentIndex（按组件出现的 nodeIds 高亮）。两者互斥。
  useEffect(() => {
    let activeNodeIds: Set<string> | null = null;

    if (activeFlowId) {
      const activeFlow = flows.find(f => f.id === activeFlowId);
      if (activeFlow) activeNodeIds = new Set(activeFlow.nodeIds);
    } else if (activeComponentIndex !== null) {
      const comp = components[activeComponentIndex];
      if (comp && comp.nodeIds && comp.nodeIds.length > 0) {
        activeNodeIds = new Set(comp.nodeIds);
      }
    }

    if (!activeNodeIds) {
      // 重置：所有节点全亮、所有 edge 走默认（带光）
      setNodes((nds) => nds.map(n => ({ ...n, style: { ...n.style, opacity: 1 } })));
      setEdges((eds) => eds.map(e => {
        const { stroke: _s, strokeWidth: _sw, opacity: _o, ...restStyle } = (e.style ?? {}) as any;
        const { dimmed: _d, ...restData } = (e.data ?? {}) as any;
        return {
          ...e,
          className: undefined,
          data: restData,
          style: { ...restStyle, transition: 'opacity 0.3s ease' },
          animated: false,
        };
      }));
      return;
    }

    const focusSet = activeNodeIds;

    setNodes((nds) => nds.map(n => ({
      ...n,
      style: {
        ...n.style,
        opacity: focusSet.has(n.id) ? 1 : 0.2,
        transition: 'opacity 0.3s ease'
      }
    })));

    setEdges((eds) => eds.map(e => {
      // 注意聚焦组件时连接两个高亮节点的 edge 仍算"相关"；如果只想保留 flow 内部
      // 边，这里是同样的逻辑。组件聚焦下大部分情况组件出现节点之间未必直连，所以
      // 这种情况下绝大多数 edge 都会被淡化 —— 这正是我们想要的结果（"只看高亮节点
      // 之间的关系"）。
      const isConnected = focusSet.has(e.source) && focusSet.has(e.target);
      const { stroke: _s, strokeWidth: _sw, opacity: _o, ...restStyle } = (e.style ?? {}) as any;
      return {
        ...e,
        className: isConnected ? undefined : 'tap-edge-dimmed',
        data: { ...(e.data ?? {}), dimmed: !isConnected },
        style: { ...restStyle, transition: 'opacity 0.3s ease' },
        animated: false,
      };
    }));

  }, [activeFlowId, activeComponentIndex, flows, components, setNodes, setEdges]);

  // Update nodes when language changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          label: language === 'zh' ? (node.data.label_zh || node.data.label) : (node.data.label_en || node.data.label),
          description: language === 'zh' ? (node.data.description_zh || node.data.description) : (node.data.description_en || node.data.description),
          edgeCases: language === 'zh' ? (node.data.edgeCases_zh || node.data.edgeCases) : (node.data.edgeCases_en || node.data.edgeCases),
          checklist: language === 'zh' ? (node.data.checklist_zh || node.data.checklist) : (node.data.checklist_en || node.data.checklist),
          questions: language === 'zh' ? (node.data.questions_zh || node.data.questions) : (node.data.questions_en || node.data.questions),
          onboardingStep: language === 'zh' ? (node.data.onboardingStep_zh || node.data.onboardingStep) : (node.data.onboardingStep_en || node.data.onboardingStep),
          uiLanguage: language,
        }
      }))
    );

    setEdges((eds) =>
      eds.map((edge) => ({
        ...edge,
        type: 'labeled',
        label: language === 'zh' ? (edge.label_zh || edge.label) : (edge.label_en || edge.label)
      }))
    );

    if (fullResult) {
      setSummary(language === 'zh' ? (fullResult.summary_zh || fullResult.summary) : (fullResult.summary_en || fullResult.summary));
    }
  }, [language, setNodes, setEdges, fullResult]);

  const handleAnalyze = async (context: string, images: string[], aiSettings: AiSettings) => {
    setIsAnalyzing(true);
    setSummary(null);
    setFullResult(null);
    setComponents([]);
    setUsabilityScores([]);
    setPageSuggestions([]);
    setFlows([]);
    setActiveFlowId(null);
    setIsSummaryExpanded(true);
    try {
      const result: AnalysisResult = await analyzeFlow(context, images, aiSettings);
      setFullResult(result);
      setComponents(result.components || []);
      setUsabilityScores(result.usabilityScores || []);
      setPageSuggestions(result.pageSuggestions || []);
      setFlows(result.flows || []);

      // Map result nodes to React Flow nodes with 'custom' type
      const newNodes: Node[] = result.nodes.map((n) => ({
        ...n,
        type: 'custom', // Force custom type
        data: {
          ...n.data,
          // Ensure current language is set initially
          label: language === 'zh' ? (n.data.label_zh || n.data.label) : (n.data.label_en || n.data.label),
          description: language === 'zh' ? (n.data.description_zh || n.data.description) : (n.data.description_en || n.data.description),
          edgeCases: language === 'zh' ? (n.data.edgeCases_zh || n.data.edgeCases) : (n.data.edgeCases_en || n.data.edgeCases),
          checklist: language === 'zh' ? (n.data.checklist_zh || n.data.checklist) : (n.data.checklist_en || n.data.checklist),
          questions: language === 'zh' ? (n.data.questions_zh || n.data.questions) : (n.data.questions_en || n.data.questions),
          layoutDirection: 'LR',
          uiLanguage: language,
        }
      }));

      const newEdges = result.edges.map(e => ({
        ...e,
        type: 'labeled',
        label: language === 'zh' ? (e.label_zh || e.label) : (e.label_en || e.label),
      }));

      // Apply layout immediately
      try {
        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
          newNodes,
          newEdges,
          'LR' // Default to Left-Right (Mind Map style)
        );
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
      } catch (layoutError) {
        console.error("Layout calculation failed:", layoutError);
        // Fallback to un-layouted nodes if layout fails
        setNodes(newNodes);
        setEdges(newEdges);
      }

      setSummary(language === 'zh' ? (result.summary_zh || result.summary) : (result.summary_en || result.summary));
    } catch (error: any) {
      console.error('Analysis failed', error);
      alert(`Analysis failed: ${error.message || 'Unknown error'}. Please try again.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportChecklist = () => {
    let content = `# UX Flow Checklist\n\n`;

    if (summary) {
      content += `## Summary\n${summary}\n\n`;
    }

    if (flows.length > 0) {
      content += `## User Flows\n`;
      flows.forEach(flow => {
        const name = language === 'zh' ? (flow.name_zh || flow.name) : (flow.name_en || flow.name);
        const desc = language === 'zh' ? (flow.description_zh || flow.description) : (flow.description_en || flow.description);
        content += `- **${name}**: ${desc}\n`;
      });
      content += `\n`;
    }

    if (usabilityScores.length > 0) {
      content += `## Usability Scorecard\n`;
      usabilityScores.forEach(score => {
        const category = language === 'zh' ? (score.category_zh || score.category) : (score.category_en || score.category);
        const reason = language === 'zh' ? (score.reason_zh || score.reason) : (score.reason_en || score.reason);
        content += `- **${category}**: ${score.score}/10\n  ${reason}\n`;
      });
      content += `\n`;
    }

    if (components.length > 0) {
      content += `## UI Components\n`;
      components.forEach(comp => {
        const name = language === 'zh' ? (comp.name_zh || comp.name) : (comp.name_en || comp.name);
        const states = language === 'zh' ? (comp.states_zh || comp.states) : (comp.states_en || comp.states);
        content += `- **${name}** (${comp.type})\n`;
        if (states && states.length > 0) {
          content += `  States: ${states.join(', ')}\n`;
        }
      });
      content += `\n`;
    }

    content += `## Steps & Checks\n`;

    nodes.forEach((node) => {
      content += `### ${node.data.label}\n`;
      if (node.data.description) content += `*${node.data.description}*\n`;

      if (node.data.checklist && node.data.checklist.length > 0) {
        content += `\n**Checklist:**\n`;
        node.data.checklist.forEach((item: string) => {
          content += `- [ ] ${item}\n`;
        });
      }

      if (node.data.edgeCases && node.data.edgeCases.length > 0) {
        content += `\n**Edge Cases:**\n`;
        node.data.edgeCases.forEach((item: string) => {
          content += `- [ ] ${item}\n`;
        });
      }

      if (node.data.questions && node.data.questions.length > 0) {
        content += `\n**Robustness Questions:**\n`;
        node.data.questions.forEach((item: string) => {
          content += `- [?] ${item}\n`;
        });
      }
      content += `\n---\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ux-checklist.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <ReactFlowProvider>
      <AnimatePresence>
        {isAnalyzing && <LoadingOverlay language={language} />}
      </AnimatePresence>

      <div className="flex h-screen w-screen overflow-hidden bg-transparent p-3 text-white">
        {/* Sidebar */}
        <div className="glass-panel w-80 h-full flex-shrink-0 z-10 overflow-hidden rounded-xl">
          <InputPanel onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} language={language} />
        </div>

        {/* Main Content */}
        <div className="flex-1 h-full relative">
          <FlowEditor
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
          />

          {/* 聚焦面包屑 —— 画布顶部居中。仅在有聚焦时出现，告诉用户"现在在
              聚焦什么 / 怎么退出"，避免聚焦后找不到出口的尴尬。 */}
          {(activeFlowId || activeComponentIndex !== null) && (() => {
            let label = '';
            let scopeText = '';
            let onExit: () => void = () => { };
            if (activeFlowId) {
              const f = flows.find(x => x.id === activeFlowId);
              label = language === 'zh' ? '聚焦流程' : 'Focused Flow';
              scopeText = f
                ? (language === 'zh' ? (f.name_zh || f.name) : (f.name_en || f.name))
                : '';
              onExit = () => setActiveFlowId(null);
            } else if (activeComponentIndex !== null) {
              const c = components[activeComponentIndex];
              label = language === 'zh' ? '聚焦组件' : 'Focused Component';
              scopeText = c
                ? `${language === 'zh' ? (c.name_zh || c.name) : (c.name_en || c.name)}（${c.nodeIds?.length ?? 0} ${language === 'zh' ? '个节点' : 'nodes'}）`
                : '';
              onExit = () => setActiveComponentIndex(null);
            }
            return (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-full border border-[#3a3a3a] bg-[#1c1c1c]/90 px-3 py-1.5 type-xs text-stone-200 shadow-[0_8px_24px_rgba(0,0,0,0.32)] backdrop-blur-md">
                <ScanSearch size={12} className="text-stone-400" />
                <span className="text-stone-400">{label}：</span>
                <span className="font-medium text-white">{scopeText}</span>
                <button
                  type="button"
                  onClick={onExit}
                  className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-stone-400 hover:bg-[#2a2a2a] hover:text-white transition-colors"
                  title={language === 'zh' ? '退出聚焦（返回完整视图）' : 'Exit focus'}
                >
                  <CloseIcon size={12} />
                </button>
              </div>
            );
          })()}

          <FloatingActions
            language={language}
            setLanguage={setLanguage}
            flows={flows}
            setShowFlowList={setShowFlowList}
            activeFlowId={activeFlowId}
            usabilityScores={usabilityScores}
            setShowUsabilityScorecard={setShowUsabilityScorecard}
            pageSuggestions={pageSuggestions}
            setShowPageSuggestions={setShowPageSuggestions}
            components={components}
            setShowComponentList={setShowComponentList}
            onLayout={onLayout}
            setNodes={setNodes}
            setEdges={setEdges}
            setSummary={setSummary}
            setFullResult={setFullResult}
            setComponents={setComponents}
            setUsabilityScores={setUsabilityScores}
            setPageSuggestions={setPageSuggestions}
            setFlows={setFlows}
            setActiveFlowId={setActiveFlowId}
            setActiveComponentIndex={setActiveComponentIndex}
            handleExportChecklist={handleExportChecklist}
            layoutDirection={layoutDirection}
            hasContent={
              !!summary ||
              !!fullResult ||
              flows.length > 0 ||
              components.length > 0 ||
              usabilityScores.length > 0 ||
              pageSuggestions.length > 0
            }
          />

          {/* Collapsible Summary Toast */}
          {summary && (
            <div className={`glass-panel absolute bottom-6 left-6 right-6 mx-auto max-w-xl rounded-xl transition-all duration-300 ${isSummaryExpanded ? 'p-4' : 'p-2'}`}>
              <div className="flex items-center justify-between">
                <h3 className="type-sm font-bold text-stone-100">
                  {language === 'zh' ? '分析摘要' : 'Analysis Summary'}
                </h3>
                <button
                  onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                  className="p-1 rounded-md ui-icon-button"
                >
                  {isSummaryExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                </button>
              </div>

              {isSummaryExpanded && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="type-sm text-stone-400 leading-relaxed max-h-40 overflow-y-auto pr-2">
                    {summary}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Component List Modal */}
          <ComponentList
            isOpen={showComponentList}
            onClose={() => setShowComponentList(false)}
            components={components}
            language={language}
            activeComponentIndex={activeComponentIndex}
            onFocusComponent={(idx) => {
              // 互斥：聚焦组件时取消已选 flow，避免两套高亮叠加
              if (idx !== null) {
                setActiveFlowId(null);
                // 聚焦后立即收起组件列表蒙层，让用户能直接看到画布上被高亮的节点
                setShowComponentList(false);
              }
              setActiveComponentIndex(idx);
            }}
          />

          {/* Usability Scorecard Modal */}
          <UsabilityScorecard
            isOpen={showUsabilityScorecard}
            onClose={() => setShowUsabilityScorecard(false)}
            scores={usabilityScores}
            language={language}
          />

          {/* Page Suggestion Modal —— 仅在没有截图、AI 给出建议页面时使用 */}
          <PageSuggestionList
            isOpen={showPageSuggestions}
            onClose={() => setShowPageSuggestions(false)}
            suggestions={pageSuggestions}
            language={language}
          />

          {/* Flow List Modal */}
          <FlowList
            isOpen={showFlowList}
            onClose={() => setShowFlowList(false)}
            flows={flows}
            language={language}
            activeFlowId={activeFlowId}
            onSelectFlow={(id) => {
              // 互斥：选中 flow 时取消组件聚焦
              if (id) setActiveComponentIndex(null);
              setActiveFlowId(id);
            }}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
