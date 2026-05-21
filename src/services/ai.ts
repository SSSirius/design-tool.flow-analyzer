import { AiSettings, AnalysisResult } from "../types";

const DEFAULT_TEXT_MODEL = "gemini-3.1-pro-preview";
const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";
const DEFAULT_NODE_MODEL = "gemini-3-flash-preview";

export const DEFAULT_AI_SETTINGS: AiSettings = {
  provider: "gemini",
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  analysisModel: "auto",
  nodeModel: DEFAULT_NODE_MODEL,
};

const getApiKey = (apiKey?: string) => {
  const configuredKey = apiKey?.trim() || import.meta.env.VITE_GEMINI_API_KEY;
  if (!configuredKey) {
    throw new Error("Please enter an API key in AI Settings.");
  }
  return configuredKey;
};

const getAnalysisModel = (settings: AiSettings, hasImages = false) => {
  if (settings.analysisModel !== "auto") return settings.analysisModel;
  return settings.provider === "gemini"
    ? (hasImages ? DEFAULT_IMAGE_MODEL : DEFAULT_TEXT_MODEL)
    : "gpt-4o-mini";
};

const extractJson = (text: string) => {
  const cleanText = text.replace(/```json\n?|```/g, '').trim();
  return JSON.parse(cleanText);
};

const getOpenAiUrl = (settings: AiSettings) => {
  const baseUrl = (settings.baseUrl || DEFAULT_AI_SETTINGS.baseUrl).replace(/\/$/, "");
  return `${baseUrl}/chat/completions`;
};

async function generateOpenAiCompatibleContent(settings: AiSettings, model: string, prompt: string, images?: string[]) {
  const content: any[] = [{ type: "text", text: prompt }];

  if (images?.length) {
    images.forEach((image) => {
      content.push({
        type: "image_url",
        image_url: { url: image.startsWith("data:") ? image : `data:image/png;base64,${image}` },
      });
    });
  }

  const response = await fetch(getOpenAiUrl(settings), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey(settings.apiKey)}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI request failed: ${response.status} ${detail}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("No response from AI model.");
  return text;
}

export const getStoredAiSettings = (): AiSettings => {
  if (typeof window === "undefined") return DEFAULT_AI_SETTINGS;

  try {
    const stored = window.localStorage.getItem("ux-flow-ai-settings");
    if (!stored) return DEFAULT_AI_SETTINGS;
    return {
      ...DEFAULT_AI_SETTINGS,
      ...JSON.parse(stored),
    };
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
};

export const storeAiSettings = (settings: AiSettings) => {
  window.localStorage.setItem("ux-flow-ai-settings", JSON.stringify(settings));
};

export async function testAiConnection(settings: AiSettings): Promise<void> {
  const model = getAnalysisModel(settings);

  if (settings.provider === "openai-compatible") {
    const response = await fetch(getOpenAiUrl(settings), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey(settings.apiKey)}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
        max_tokens: 8,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`AI connection failed: ${response.status} ${detail}`);
    }
    return;
  }

  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: getApiKey(settings.apiKey) });
  const response = await ai.models.generateContent({
    model,
    contents: "Reply with exactly: OK",
  });

  if (!response.text) {
    throw new Error("No response from AI model.");
  }
}

export async function generateNodeDetails(stepName: string, settings = getStoredAiSettings()): Promise<any> {
  const prompt = `
  You are a UX expert. The user is creating a user flow diagram and added a step named "${stepName}".
  Provide a brief description, edge cases, a checklist, and robustness questions for this step.
  Respond in the same language as the step name (e.g. if Chinese, respond in Chinese).
  
  Output JSON strictly matching this structure:
  {
    "description": "Brief description of what happens here",
    "edgeCases": ["Edge case 1", "Edge case 2"],
    "checklist": ["Checklist item 1", "Checklist item 2"],
    "questions": ["Robustness question 1", "Robustness question 2"]
  }
  `;

  try {
    if (settings.provider === "openai-compatible") {
      const text = await generateOpenAiCompatibleContent(settings, settings.nodeModel || "gpt-4o-mini", prompt);
      return extractJson(text);
    }

    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: getApiKey(settings.apiKey) });
    const response = await ai.models.generateContent({
      model: settings.nodeModel || DEFAULT_NODE_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return extractJson(text);
  } catch (error) {
    console.error("AI Node Detail Generation Failed:", error);
    throw error;
  }
}

export async function analyzeFlow(
  context: string,
  images: string[],
  settings: AiSettings
): Promise<AnalysisResult> {
  const { GoogleGenAI, ThinkingLevel } = await import("@google/genai");
  
  const hasImages = images && images.length > 0;
  const model = getAnalysisModel(settings, hasImages);


  const prompt = `
    You are a Senior UX Researcher and Interaction Designer.
    Analyze the provided UI screenshot (if any) and the context description.
    
    Your goal is to reverse-engineer the user flow, identify edge cases, and create a design checklist.
    
    IMPORTANT: 
    1. The flow MUST be multi-branching. Identify different user scenarios (e.g., Happy Path, Error Path, Alternative Path).
    2. Provide ALL text content in BOTH Chinese (zh) and English (en).
    3. Identify all unique UI components (controls) involved in the flow.
       - Group identical components (consistency check).
       - List their interactive states (e.g., Default, Hover, Pressed, Disabled, Error).
    4. **Robustness Questions (健壮性提问)**: For each step, ask critical questions about the UI's capabilities and robustness related to user scenarios.
       - Example: If there is an image upload, ask "Does it support multiple images?" or "What is the max file size?".
       - Example: If there is a list, ask "How is pagination handled?" or "What is the empty state?".
       - Example: If there is a form, ask "Is there auto-save?" or "How are validation errors displayed?".
    5. **Usability Scorecard (可用性打分)**: Evaluate the flow based on Nielsen's Heuristics or general UX principles.
       - Categories: Visibility of System Status, Match between System and Real World, User Control and Freedom, Consistency and Standards, Error Prevention, Recognition rather than Recall, Flexibility and Efficiency of Use, Aesthetic and Minimalist Design, Help Users Recognize, Diagnose, and Recover from Errors, Help and Documentation.
       - Provide a score (1-10) and a brief reason for each relevant category.
    6. **Flow Paths (流程路径)**: Identify distinct user flows/scenarios within the diagram.
       - **CRITICAL**: The first flow MUST be the "Critical Happy Path" (核心主流程).
         - This path should represent the *minimum* steps required to complete the primary task.
         - Do NOT include optional steps, edge cases, or interactions with secondary components (e.g., "Forgot Password", "Help", "Settings") unless strictly necessary for the main goal.
         - Focus on the "straight line" to success.
       - Then list other flows like "Error Path", "Alternative Path", etc.
       - List the sequence of node IDs for each flow.
    
    Output a JSON object representing a node-based flow diagram.
    
    The structure should be:
    {
      "nodes": [
        {
          "id": "unique_id",
          "type": "default", 
          "nodeType": "start" | "action" | "decision" | "end",
          "label_zh": "步骤名称",
          "label_en": "Step Name",
          "description_zh": "这里发生了什么",
          "description_en": "What happens here",
          "edgeCases_zh": ["情况1", "情况2"],
          "edgeCases_en": ["Case 1", "Case 2"],
          "checklist_zh": ["检查点1", "检查点2"],
          "checklist_en": ["Check 1", "Check 2"],
          "questions_zh": ["健壮性提问1", "健壮性提问2"],
          "questions_en": ["Robustness Question 1", "Robustness Question 2"]
        }
      ],
      "edges": [
        {
          "id": "e1-2",
          "source": "node_id_1",
          "target": "node_id_2",
          "label_zh": "动作/条件",
          "label_en": "Action/Condition"
        }
      ],
      "flows": [
        {
          "id": "flow_1",
          "name_zh": "正常登录流程",
          "name_en": "Happy Path Login",
          "description_zh": "用户使用账号密码成功登录",
          "description_en": "User logs in successfully with credentials",
          "nodeIds": ["node_id_1", "node_id_2"]
        }
      ],
      "components": [
        {
          "name_zh": "提交按钮",
          "name_en": "Submit Button",
          "type": "Button",
          "states_zh": ["默认", "悬停", "点击", "禁用", "加载中"],
          "states_en": ["Default", "Hover", "Pressed", "Disabled", "Loading"]
        }
      ],
      "usabilityScores": [
        {
          "category_zh": "系统状态可见性",
          "category_en": "Visibility of System Status",
          "score": 8,
          "reason_zh": "加载状态清晰...",
          "reason_en": "Loading states are clear..."
        }
      ],
      "summary_zh": "流程摘要...",
      "summary_en": "Flow summary..."
    }

    Ensure the nodes are logically connected and cover multiple scenarios.
    If an image is provided, base the steps on the visible UI elements.
    If only text is provided, infer the standard flow for such a feature.
    
    IMPORTANT: Position the nodes in a logical layout (e.g., top-to-bottom). 
    Calculate approximate x/y coordinates for a layout where nodes don't overlap too much.
    Assume a canvas size of roughly 1000x1000.
    
    Context: ${context}
  `;

  const parts: any[] = [{ text: prompt }];

  if (images && images.length > 0) {
    images.forEach(img => {
      // Remove data URL prefix if present
      const base64Data = img.split(",")[1] || img;
      // Extract mime type if available, otherwise default to png
      const mimeType = img.match(/data:([^;]+);base64/)?.[1] || "image/png";
      
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64Data,
        },
      });
    });
  }

  try {
    let text: string;

    if (settings.provider === "openai-compatible") {
      text = await generateOpenAiCompatibleContent(settings, model, prompt, images);
    } else {
      const ai = new GoogleGenAI({ apiKey: getApiKey(settings.apiKey) });
      const config: any = {};

      // Only apply JSON mode and thinking config for the text-only reasoning model
      // gemini-2.5-flash-image does not support responseMimeType: application/json
      if (!hasImages) {
        config.responseMimeType = "application/json";
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      }

      const response = await ai.models.generateContent({
        model: model,
        contents: { parts },
        config: config,
      });

      text = response.text || "";
    }

    if (!text) throw new Error("No response from AI");

    let data;
    try {
      data = extractJson(text);
    } catch (e) {
      console.error("Failed to parse JSON:", text);
      throw new Error("Invalid JSON response from AI");
    }

    // Post-process to ensure React Flow compatibility
    const nodes = data.nodes.map((n: any) => ({
      id: n.id,
      type: n.type || 'default',
      position: n.position || { x: Math.random() * 400, y: Math.random() * 400 }, // Fallback if AI doesn't give positions
      data: {
        label: n.label_zh || n.label, // Default to ZH
        description: n.description_zh || n.description,
        edgeCases: n.edgeCases_zh || n.edgeCases || [],
        checklist: n.checklist_zh || n.checklist || [],
        questions: n.questions_zh || n.questions || [],
        type: n.nodeType,
        
        // Store all variants
        label_zh: n.label_zh,
        label_en: n.label_en,
        description_zh: n.description_zh,
        description_en: n.description_en,
        edgeCases_zh: n.edgeCases_zh,
        edgeCases_en: n.edgeCases_en,
        checklist_zh: n.checklist_zh,
        checklist_en: n.checklist_en,
        questions_zh: n.questions_zh,
        questions_en: n.questions_en,
      }
    }));

    const edges = data.edges.map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label_zh || e.label,
      label_zh: e.label_zh,
      label_en: e.label_en,
      animated: true
    }));

    const components = data.components?.map((c: any) => ({
      name: c.name_zh || c.name,
      type: c.type,
      states: c.states_zh || c.states || [],
      name_zh: c.name_zh,
      name_en: c.name_en,
      states_zh: c.states_zh,
      states_en: c.states_en
    })) || [];

    const usabilityScores = data.usabilityScores?.map((s: any) => ({
      category: s.category_zh || s.category,
      score: s.score,
      reason: s.reason_zh || s.reason,
      category_zh: s.category_zh,
      category_en: s.category_en,
      reason_zh: s.reason_zh,
      reason_en: s.reason_en
    })) || [];

    const flows = data.flows?.map((f: any) => ({
      id: f.id,
      name: f.name_zh || f.name,
      description: f.description_zh || f.description,
      nodeIds: f.nodeIds || [],
      name_zh: f.name_zh,
      name_en: f.name_en,
      description_zh: f.description_zh,
      description_en: f.description_en
    })) || [];

    return {
      nodes,
      edges,
      summary: data.summary_zh || data.summary || "Analysis complete.",
      summary_zh: data.summary_zh,
      summary_en: data.summary_en,
      components,
      usabilityScores,
      flows
    };

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    throw error;
  }
}
