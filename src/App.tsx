import { useState, useCallback, useEffect } from 'react';
import { ReactFlowProvider, useNodesState, useEdgesState, addEdge, Connection, Node, Edge, useReactFlow } from 'reactflow';
import InputPanel from './components/InputPanel';
import FlowEditor from './components/FlowEditor';
import ComponentList from './components/ComponentList';
import UsabilityScorecard from './components/UsabilityScorecard';
import FlowList from './components/FlowList';
import { analyzeFlow } from './services/ai';
import { AiSettings, AnalysisResult, ComponentData, UsabilityScore, FlowPath } from './types';
import { Download, Languages, Layers, ClipboardCheck, ChevronDown, ChevronUp, Layout, GitBranch, Loader2, ScanSearch, BrainCircuit, Sparkles } from 'lucide-react';
import { getLayoutedElements } from './utils/layout';
import { motion, AnimatePresence } from 'motion/react';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'custom',
    position: { x: 250, y: 100 },
    data: { 
      label: '开始', 
      description: '上传截图或描述您的流程。',
      type: 'start',
      label_zh: '开始',
      label_en: 'Start',
      description_zh: '上传截图或描述您的流程。',
      description_en: 'Upload a screenshot or describe your flow.'
    },
  },
];

const initialEdges: Edge[] = [];

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
      className="fixed inset-0 z-[100] bg-stone-950/80 backdrop-blur-md flex flex-col items-center justify-center"
    >
      <div className="w-full max-w-md p-8 bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
            <Loader2 size={48} className="text-indigo-500 animate-spin relative z-10" />
          </div>
        </div>
        
        <div className="space-y-6">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isCompleted = i < step;
            
            return (
              <div key={i} className={`flex items-center gap-4 transition-all duration-500 ${isActive || isCompleted ? 'opacity-100' : 'opacity-30'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors duration-500 ${
                  isActive ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 
                  isCompleted ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 
                  'bg-stone-800 border-stone-700 text-stone-500'
                }`}>
                  <Icon size={14} />
                </div>
                <span className={`type-base font-medium ${isActive ? 'text-stone-100' : 'text-stone-500'}`}>
                  {s.text}
                </span>
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
  components, 
  setShowComponentList, 
  onLayout, 
  setNodes, 
  setEdges, 
  setSummary, 
  setFullResult, 
  setComponents, 
  setUsabilityScores, 
  setFlows, 
  setActiveFlowId, 
  handleExportChecklist 
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
        description: language === 'zh' ? '描述...' : 'Description...', 
        type: 'action' 
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
    <div className="absolute top-4 right-4 flex gap-2">
      <button 
        onClick={() => setLanguage((l: string) => l === 'zh' ? 'en' : 'zh')}
        className="bg-stone-800 border border-stone-700 shadow-sm hover:bg-stone-700 text-stone-300 px-3 py-1.5 rounded-md type-sm font-medium transition-all flex items-center"
        title="Toggle Language"
      >
        <Languages size={14} className="mr-1.5" />
        {language === 'zh' ? 'EN' : '中文'}
      </button>
      <div className="w-px h-6 bg-stone-800 mx-1 self-center"></div>
      
      {flows.length > 0 && (
        <button 
          onClick={() => setShowFlowList(true)}
          className={`border shadow-sm px-3 py-1.5 rounded-md type-sm font-medium transition-all flex items-center ${
            activeFlowId 
              ? 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500' 
              : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
          }`}
        >
          <GitBranch size={14} className="mr-1.5" />
          {language === 'zh' ? '流程场景' : 'Flows'}
        </button>
      )}

      {usabilityScores.length > 0 && (
        <button 
          onClick={() => setShowUsabilityScorecard(true)}
          className="bg-stone-800 border border-stone-700 shadow-sm hover:bg-stone-700 text-stone-300 px-3 py-1.5 rounded-md type-sm font-medium transition-all flex items-center"
        >
          <ClipboardCheck size={14} className="mr-1.5" />
          {language === 'zh' ? '可用性评分' : 'Scorecard'}
        </button>
      )}

      {components.length > 0 && (
        <button 
          onClick={() => setShowComponentList(true)}
          className="bg-stone-800 border border-stone-700 shadow-sm hover:bg-stone-700 text-stone-300 px-3 py-1.5 rounded-md type-sm font-medium transition-all flex items-center"
        >
          <Layers size={14} className="mr-1.5" />
          {language === 'zh' ? '组件列表' : 'Components'}
        </button>
      )}

      <button 
        onClick={() => onLayout('LR')}
        className="bg-stone-800 border border-stone-700 shadow-sm hover:bg-stone-700 text-stone-300 px-3 py-1.5 rounded-md type-sm font-medium transition-all flex items-center"
        title={language === 'zh' ? '水平布局 (脑图)' : 'Horizontal Layout'}
      >
        <Layout size={14} className="mr-1.5" />
        {language === 'zh' ? '脑图布局' : 'Map Layout'}
      </button>
      
      <button 
        onClick={() => onLayout('TB')}
        className="bg-stone-800 border border-stone-700 shadow-sm hover:bg-stone-700 text-stone-300 px-3 py-1.5 rounded-md type-sm font-medium transition-all flex items-center"
        title={language === 'zh' ? '垂直布局 (流程图)' : 'Vertical Layout'}
      >
        <Layout size={14} className="mr-1.5 rotate-90" />
        {language === 'zh' ? '流程布局' : 'Flow Layout'}
      </button>

      <button 
        onClick={handleAddStep}
        className="bg-stone-800 border border-stone-700 shadow-sm hover:bg-stone-700 text-stone-300 px-3 py-1.5 rounded-md type-sm font-medium transition-all"
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
          setFlows([]);
          setActiveFlowId(null);
        }}
        className="bg-stone-800 border border-stone-700 shadow-sm hover:bg-stone-700 text-stone-300 px-3 py-1.5 rounded-md type-sm font-medium transition-all"
      >
        {language === 'zh' ? '清空' : 'Clear'}
      </button>
      <button 
        onClick={handleExportChecklist}
        className="bg-stone-100 shadow-sm hover:bg-white text-stone-900 px-3 py-1.5 rounded-md type-sm font-medium flex items-center transition-all"
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
  const [showFlowList, setShowFlowList] = useState(false);
  const [components, setComponents] = useState<ComponentData[]>([]);
  const [usabilityScores, setUsabilityScores] = useState<UsabilityScore[]>([]);
  const [flows, setFlows] = useState<FlowPath[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  // Layout function
  const onLayout = useCallback((direction = 'LR') => {
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      direction
    );

    setNodes([...layoutedNodes]);
    setEdges([...layoutedEdges]);
  }, [nodes, edges, setNodes, setEdges]);

  // Handle Flow Selection
  useEffect(() => {
    if (!activeFlowId) {
      // Reset styles
      setNodes((nds) => nds.map(n => ({ ...n, style: { ...n.style, opacity: 1 } })));
      setEdges((eds) => eds.map(e => ({ ...e, style: { ...e.style, opacity: 1, stroke: '#57534e' }, animated: false })));
      return;
    }

    const activeFlow = flows.find(f => f.id === activeFlowId);
    if (!activeFlow) return;

    const activeNodeIds = new Set(activeFlow.nodeIds);

    setNodes((nds) => nds.map(n => ({
      ...n,
      style: {
        ...n.style,
        opacity: activeNodeIds.has(n.id) ? 1 : 0.2,
        transition: 'opacity 0.3s ease'
      }
    })));

    setEdges((eds) => eds.map(e => {
      const isConnected = activeNodeIds.has(e.source) && activeNodeIds.has(e.target);
      return {
        ...e,
        style: {
          ...e.style,
          opacity: isConnected ? 1 : 0.1,
          stroke: isConnected ? '#6366f1' : '#57534e', // Indigo for active
          strokeWidth: isConnected ? 2 : 1,
          transition: 'all 0.3s ease'
        },
        animated: isConnected
      };
    }));

  }, [activeFlowId, flows, setNodes, setEdges]);

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
        }
      }))
    );
    
    setEdges((eds) => 
      eds.map((edge) => ({
        ...edge,
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
    setFlows([]);
    setActiveFlowId(null);
    setIsSummaryExpanded(true);
    try {
      const result: AnalysisResult = await analyzeFlow(context, images, aiSettings);
      setFullResult(result);
      setComponents(result.components || []);
      setUsabilityScores(result.usabilityScores || []);
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
        }
      }));

      const newEdges = result.edges.map(e => ({
          ...e,
          label: language === 'zh' ? (e.label_zh || e.label) : (e.label_en || e.label)
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
      
      <div className="flex h-screen w-screen overflow-hidden bg-stone-950 text-stone-200">
        {/* Sidebar */}
        <div className="w-80 h-full flex-shrink-0 z-10 shadow-xl border-r border-stone-800">
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
          
          <FloatingActions 
            language={language}
            setLanguage={setLanguage}
            flows={flows}
            setShowFlowList={setShowFlowList}
            activeFlowId={activeFlowId}
            usabilityScores={usabilityScores}
            setShowUsabilityScorecard={setShowUsabilityScorecard}
            components={components}
            setShowComponentList={setShowComponentList}
            onLayout={onLayout}
            setNodes={setNodes}
            setEdges={setEdges}
            setSummary={setSummary}
            setFullResult={setFullResult}
            setComponents={setComponents}
            setUsabilityScores={setUsabilityScores}
            setFlows={setFlows}
            setActiveFlowId={setActiveFlowId}
            handleExportChecklist={handleExportChecklist}
          />

          {/* Collapsible Summary Toast */}
          {summary && (
            <div className={`absolute bottom-6 left-6 right-6 mx-auto max-w-xl bg-stone-900/95 backdrop-blur border border-stone-700 rounded-lg shadow-lg transition-all duration-300 ${isSummaryExpanded ? 'p-4' : 'p-2'}`}>
              <div className="flex items-center justify-between">
                <h3 className="type-base font-bold text-stone-100">
                  {language === 'zh' ? '分析摘要' : 'Analysis Summary'}
                </h3>
                <button 
                  onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                  className="p-1 hover:bg-stone-800 rounded-full text-stone-400 hover:text-stone-200 transition-colors"
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
          />

          {/* Usability Scorecard Modal */}
          <UsabilityScorecard 
            isOpen={showUsabilityScorecard} 
            onClose={() => setShowUsabilityScorecard(false)} 
            scores={usabilityScores}
            language={language}
          />

          {/* Flow List Modal */}
          <FlowList 
            isOpen={showFlowList} 
            onClose={() => setShowFlowList(false)} 
            flows={flows}
            language={language}
            activeFlowId={activeFlowId}
            onSelectFlow={setActiveFlowId}
          />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
