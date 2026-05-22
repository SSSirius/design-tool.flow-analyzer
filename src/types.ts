
export interface FlowNodeData {
  label: string;
  description?: string;
  edgeCases?: string[];
  checklist?: string[];
  questions?: string[]; // Robustness questions
  type?: 'start' | 'action' | 'decision';
  
  // Multilingual support
  label_zh?: string;
  label_en?: string;
  description_zh?: string;
  description_en?: string;
  edgeCases_zh?: string[];
  edgeCases_en?: string[];
  checklist_zh?: string[];
  checklist_en?: string[];
  questions_zh?: string[];
  questions_en?: string[];
}

export interface ComponentData {
  name: string;
  type: string;
  states: string[];
  pages?: string[];
  // 该组件出现在流程中的哪些节点上 —— 用于"点组件聚焦相关节点"
  nodeIds?: string[];
  
  // Multilingual support
  name_zh?: string;
  name_en?: string;
  states_zh?: string[];
  states_en?: string[];
  pages_zh?: string[];
  pages_en?: string[];
}

export interface UsabilityScore {
  category: string;
  score: number;
  reason: string;
  
  // Multilingual
  category_zh?: string;
  category_en?: string;
  reason_zh?: string;
  reason_en?: string;
}

export interface PageSuggestion {
  name: string;
  description: string;
  // Multilingual
  name_zh?: string;
  name_en?: string;
  description_zh?: string;
  description_en?: string;
}

export interface FlowPath {
  id: string;
  name: string;
  description: string;
  nodeIds: string[];
  
  // Multilingual
  name_zh?: string;
  name_en?: string;
  description_zh?: string;
  description_en?: string;
}

export interface AiSettings {
  provider: 'gemini' | 'openai-compatible' | 'z-ai-coding';
  apiKey: string;
  baseUrl: string;
  analysisModel: string;
  nodeModel: string;
}

export interface AnalysisResult {
  nodes: {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: FlowNodeData;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    label?: string;
    label_zh?: string;
    label_en?: string;
    animated?: boolean;
  }[];
  summary: string;
  summary_zh?: string;
  summary_en?: string;
  components?: ComponentData[];
  usabilityScores?: UsabilityScore[];
  pageSuggestions?: PageSuggestion[];
  flows?: FlowPath[];
}

export interface AppState {
  context: string;
  image: string | null; // Base64
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
}
