import { AiSettings, AnalysisResult } from "../types";
import { preprocessImages, describeSliceLayout } from "../utils/imagePreprocess";

const DEFAULT_TEXT_MODEL = "gemini-3.1-pro-preview";
// 注意：gemini-2.5-flash-image 是图像*生成*模型（Nano Banana），不是图像理解模型，
// 用它做 UI 分析会得到极简化、忽略模块的结果。这里把图片输入也走 Pro 模型，
// 它原生多模态，能同时处理文本+图片，并且支持 responseMimeType: application/json。
const DEFAULT_IMAGE_MODEL = "gemini-3.1-pro-preview";
const DEFAULT_NODE_MODEL = "gemini-3-flash-preview";
const DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-4o-mini";
const DEFAULT_Z_AI_CODING_MODEL = "glm-5.1";
export const Z_AI_CODING_BASE_URL = "https://api.z.ai/api/coding/paas/v4";

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
  if (settings.provider === "gemini") return hasImages ? DEFAULT_IMAGE_MODEL : DEFAULT_TEXT_MODEL;
  if (settings.provider === "z-ai-coding") return DEFAULT_Z_AI_CODING_MODEL;
  return DEFAULT_OPENAI_COMPATIBLE_MODEL;
};

const isChatCompletionsProvider = (settings: AiSettings) => (
  settings.provider === "openai-compatible" || settings.provider === "z-ai-coding"
);

const extractJson = (text: string) => {
  // 1) 去掉 ```json ... ``` 围栏
  let cleaned = text.replace(/```json\s*|```/g, '').trim();

  // 2) 去掉 JS 风格的块注释（行注释处理太容易误伤 URL / 字符串里的 //，
  //    所以只清理块注释；尾随的 // 注释交给括号扫描器自然忽略即可）
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

  // 3) 用括号匹配扫描器，从首个 { 开始找它对应的 } 就截断；
  //    比"从首 { 到末 }"更稳——模型有时会输出多个 JSON 块、或在 JSON 后再
  //    续写散文/重复版本，导致 "Unexpected non-whitespace character after JSON"。
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace >= 0) {
    let depth = 0;
    let inString = false;
    let escape = false;
    let end = -1;
    for (let i = firstBrace; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
      } else if (ch === '{') {
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end > firstBrace) {
      cleaned = cleaned.slice(firstBrace, end + 1);
    } else {
      // fallback：扫描器未找到平衡点（可能字符串状态被打乱），
      // 回退到旧的"末 }"截法
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }
    }
  }

  // 4) 修掉对象/数组结尾的尾随逗号（某些模型常见错误）
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  // 5) 解析；若仍失败但是 "after JSON at position N" 这种"尾巴噪声"错误，
  //    根据报错位置 N 直接截断重试——这是最后兜底，确保我们能拿到第一个有效 JSON。
  const tryParse = (src: string): { ok: true; value: any; err?: undefined } | { ok: false; value?: undefined; err: Error } => {
    try {
      return { ok: true, value: JSON.parse(src) };
    } catch (e) {
      return { ok: false, err: e as Error };
    }
  };

  const result = tryParse(cleaned);
  if (result.ok) return result.value;
  const firstErr: Error = result.err;
  const msg = firstErr.message || '';
  // V8/Chromium: "Unexpected non-whitespace character after JSON at position 7266 ..."
  // Firefox:     "unexpected non-whitespace character after JSON data at line X column Y of the JSON data"
  const m = msg.match(/position\s+(\d+)/i);
  if (m && /after JSON/i.test(msg)) {
    const pos = parseInt(m[1], 10);
    if (Number.isFinite(pos) && pos > 0 && pos <= cleaned.length) {
      const truncated = cleaned.slice(0, pos);
      const retry = tryParse(truncated);
      if (retry.ok) return retry.value;
    }
  }
  const preview = cleaned.slice(0, 240);
  throw new Error(
    `JSON parse failed: ${msg}. Preview: ${preview}`
  );
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
      ...(images?.length ? {} : { response_format: { type: "json_object" } }),
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

  if (isChatCompletionsProvider(settings)) {
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
    if (isChatCompletionsProvider(settings)) {
      const text = await generateOpenAiCompatibleContent(settings, settings.nodeModel || DEFAULT_OPENAI_COMPATIBLE_MODEL, prompt);
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

  // 把用户上传的原图先做"长图切片 + 限尺下采样"，避免被模型视觉编码器
  // 黑盒下采样导致细节丢失。preprocessed 里的每一项都是已经塞得进 Gemini
  // 单图 tile 上限的尺寸，长图会被展开成多个切片（同一 groupId）。
  const preprocessed = images && images.length > 0
    ? await preprocessImages(images)
    : [];
  const processedImages = preprocessed.map(p => p.src);
  const sliceLayoutNote = describeSliceLayout(preprocessed);

  const hasImages = processedImages.length > 0;
  const model = getAnalysisModel(settings, hasImages);


  const prompt = `
    You are a Senior UX Researcher and Interaction Designer.
    Analyze the provided UI screenshot (if any) and the context description.
    
    Your goal is to reverse-engineer the user flow, identify edge cases, and create a design checklist.
    
    IMPORTANT: 
    0. **Multi-image inputs（多图输入）**[仅当提供了 ≥1 张图片时适用]：
       - 用户上传的**每一张图通常都对应不同的页面 / 模块 / 状态 / Tab / 弹窗**——它们一起拼成一条更完整的产品流程，**不是**让你"求多图共同点"然后压缩成一个简化版流程。
       - **图片越多，节点和边只会越多，不会越少**。如果用户给了 N 张截图（N ≥ 2），那么 nodes 数量应当 ≥ N + 该业务必要的过渡/异常/确认节点（典型经验下界：节点数 ≈ 1.5 × N ~ 3 × N）。如果你最后只产出了少于 N 个节点，说明你在偷懒地合并图片，**这是不合格输出**。
       - 每一张图里出现的**每一个明显模块**（卡片区、入口按钮、Tab 项、列表条目、二级导航、设置开关、状态栏角标等）都应该被视为"潜在分支起点"——为它配上对应的去向节点（点击它会去哪？长按它会去哪？为空时长什么样？加载失败长什么样？），不要只画跑通主任务的那一条窄线。
       - 如果同一个元素在多张图里出现状态变化（比如默认/选中/加载/已读），那是**同一节点的不同状态**，写到该节点的 description / edgeCases 里；但如果是**承载页面变化**（比如点了卡片进入详情页），那就是**新节点**。
       - 不要因为"看起来很像"就把不同 tab / 不同页面合并成一个节点；只要路由意义上是另一个页面，或者承载的核心信息不同，就**保留为独立节点**。

    1. The flow MUST be multi-branching. Identify different user scenarios (e.g., Happy Path, Error Path, Alternative Path).
       - **回环边是必须的，不要回避**：真实产品的流程图里大量存在"返回上一步 / 修改后重试 / 验证失败重输 / 取消并回到列表 / 失败后重新选择"这种**逆向 / 回环边**。请大胆地在 edges 数组里加这类边。
       - 例如：表单校验失败 → 回到表单编辑节点；支付失败 → 回到选择支付方式；审核拒绝 → 回到资料填写；删除二次确认弹窗 → 取消则回到列表。
       - 这些回路边的 label 要清晰描述触发条件（"修改后重试"、"取消"、"返回编辑"、"验证失败"、"再选一次"等），不要只画前向边。
       - 流程图里出现 cycle（循环）是**正常的、必要的**，不要因为"避免循环"而剪掉它们。
       - **图片模式下尤其容易漏异常流**：LLM 看到具体 UI 时会本能地"画它看见的"，跳过"它没画但必然存在的"。请主动反向推：每个交互节点都问一遍——
         · 这一步可能失败吗？失败提示去哪？（→ 错误流）
         · 这一步可以"取消"或"返回"吗？回到哪？（→ 取消流）
         · 这一步要等待吗？等待中可以打断吗？（→ 中断流）
         · 这一步的输入有空态/超长/格式错吗？（→ 校验流）
         · 二次确认弹窗的"取消"按钮指向哪？（→ 不是悬空，是回到上一步）
         **没有这些反向边的图片分析视为不合格**。
    2. Provide ALL text content in BOTH Chinese (zh) and English (en).
    3. **UI Components (UI 组件)**: Identify the UI controls involved in the flow.
       - **必须穷尽，不要漏**：典型组件包括但不限于 —— 输入框、文本域、密码输入、搜索框、下拉选择、单选/多选、开关、滑块、按钮（主要/次要/文字/图标）、链接、Tab、面包屑、分页器、列表项、卡片、表格、模态框、抽屉、Toast/通知、Tooltip、Popover、菜单、头像、徽章、标签、上传组件、进度条、加载动画、分割线、步骤条、空态图、骨架屏等。每出现一种就要列。
       - **复用要适度，但不要过度收敛**：通用型组件（按钮、输入框、卡片等）在意图分析上**信息逻辑一致**就视为同一个组件，列一条即可；但只要在交互逻辑、信息结构、状态机上有任何差异（比如"主页搜索框"是输入即触发联想 vs "全局搜索框"是回车才触发），就**保留为不同条目**。
       - 列每个组件的：name（如"主提交按钮"）、type（如 "Button"）、states（默认/悬停/点击/禁用/加载中/错误等）、**nodeIds**（这个组件在你列出的 nodes 中出现/被使用在哪几个节点上的 id 列表，至少 1 个；如果一个组件贯穿多个节点比如全局导航栏，就把这些节点 id 都列上；用于前端"点击组件聚焦相关节点"功能，**不能省略**）。
    4. **Robustness Questions (健壮性提问)**: For each step, ask critical questions about the UI's capabilities and robustness related to user scenarios.
       - Example: If there is an image upload, ask "Does it support multiple images?" or "What is the max file size?".
       - Example: If there is a list, ask "How is pagination handled?" or "What is the empty state?".
       - Example: If there is a form, ask "Is there auto-save?" or "How are validation errors displayed?".
    5. **Usability Scorecard (可用性打分)** [仅当提供了图片时输出]: Evaluate the flow based on Nielsen's Heuristics or general UX principles.
       - Categories: Visibility of System Status, Match between System and Real World, User Control and Freedom, Consistency and Standards, Error Prevention, Recognition rather than Recall, Flexibility and Efficiency of Use, Aesthetic and Minimalist Design, Help Users Recognize, Diagnose, and Recover from Errors, Help and Documentation.
       - Provide a score (1-10) and a brief reason for each relevant category.
       - 注意：如果输入只有文字描述、没有截图，请把 usabilityScores 输出为空数组 []，因为没有图片就没有可用性可评分。改为输出 pageSuggestions（见下文）。
    5b. **Page Suggestions (建议页面)** [仅当未提供图片时输出]: 根据用户的目标和流程，列出实现这个意图所需的**独立路由页面**（注意：是独立路由页面，不是同一页面的不同状态——状态已经在流程节点里体现了）。
       - **节制**：基于你对流程的合理推导得到一个基础页面数，再视情况补 1~3 个真正必要的支撑/边界页即可，不要凑数、不要硬塞。
       - 主体仍是主流程页面（按你判断的步骤拆分）；只有在该业务确实需要时，才补充少量真正关键的支撑页（如登录/SSO 回调、支付回流落地、关键的空态/错误页等）。
       - 不要为了显得"完整"就把 onboarding、帮助中心、账户中心、404 等通用页全堆上来——只有跟当前意图强相关的才列。
       - 列每个页面：页面名 + 一句话简介（说明它的存在价值与核心内容）。
       - 同一页面的不同状态（比如"密码错误提示"、"加载中"）**不**单列，那已经在流程节点里。
       - 如果输入提供了图片，请把 pageSuggestions 输出为空数组 []。
    6. **Flow Paths (流程路径)**: Identify distinct user flows/scenarios within the diagram.
       - **必须输出多条 flow（通常 3~5 条），不能只给一条 happy path**。少于 2 条 flow 视为不合格输出。
       - **第 1 条 flow 必须是 "Critical Happy Path"（核心主流程）**：
         - 代表完成主任务的*最少*步骤。
         - 不要纳入可选步骤、边界场景、与次要组件的交互（如"忘记密码"、"帮助"、"设置"）除非主目标确实必需。
         - 它应该是一条"直线"。
         - 注意：happy path 是直线只是为了"路径序列"清晰，**不代表整张图就不能有回路** —— 整张 edges 数组里依然必须包含必要的逆向/回环边（见第 1 条），它们由其他非 happy 的 flow 路径覆盖，或单独存在于 edges 中作为补充关系。
       - **从第 2 条开始必须包含至少 1~3 条非 happy 的 flow**，按业务实际情况覆盖（不要全堆边界，也不要漏边界）：
         - **错误/异常流（Error Path）**：典型如校验失败→重输、网络失败→重试、支付失败→回到选择、上传失败→重传、登录失败→提示。
         - **回环/重试流（Loopback / Retry）**：用户在某节点出错后退回上一步、修改后重试，nodeIds 序列里**会重复**（如 A→B→C→B→D 表示在 C 失败后回到 B 改完再走）。
         - **分支/替代流（Alternative Path）**：典型如第三方登录、扫码登录、跳过 onboarding、记住密码自动登录等可选入口。
         - **取消/放弃流（Cancellation）**：用户中途退出、关闭弹窗、取消订单等导致回到列表/首页。
         - 选哪几条由业务决定，但**至少要覆盖一条错误/回环流**——不能只给 happy path + 替代流就完事。
         - **图片模式下（提供了截图时）这条规则是硬性的**：必须至少有一条 flow 的 nodeIds 序列**显式重复**（出现 A→B→...→A 或类似的回退节点），用以承载错误回退/重试的真实路径；如果整套 flows 里所有 nodeIds 序列都是单调向前、没有任何节点重复出现，**视为遗漏异常流，不合格**。
       - 每条 flow 的 nodeIds 序列：happy path 不允许重复；非 happy 的 flow nodeIds **可以并且经常需要重复**（A→B→A→C 表示走错回退再继续）。
       - 每条 flow 列出：id、name、description（一句话说明这是什么场景/触发条件）、nodeIds 序列。
    
    Output a JSON object representing a node-based flow diagram.

    重要：nodeType 取值仅限 "start" | "action" | "decision"。**不要**输出 "end" 类型节点
    —— 真实产品的流程很少有"终止"状态，多数所谓终点其实是回到列表 / 回到首页 / 回到详情，
    应该在 edges 里画一条回环边到对应节点，而不是画一个孤零零的 end 节点。
    同样地，**不要生成 label 是"结束 / 完成 / 成功 / 退出 / 关闭 / End / Finish / Done /
    Complete / Success / Exit"等纯粹"终止性"措辞的节点**——即使你把它的 nodeType 标成
    action 也不行。这类节点没有承载任何 UI 信息或用户决策，只是在画"流程图教科书里
    的尾巴"。请把它替换成：
      · 一条指向"列表页 / 详情页 / 首页"等真实落点节点的 edge（label 写"返回列表"
        "回到首页"等），或
      · 一个真实承载落地内容的节点（如"订单成功页 - 展示订单号 + 物流入口 + 推荐
        商品"——这种是有 UI 的页面，不是空的"结束"）。
    判断标准：如果你想加的"结束节点"上写不出任何 UI 控件、edgeCases、checklist，
    那它就是该被剔除的伪节点。

    The structure should be:
    {
      "nodes": [
        {
          "id": "unique_id",
          "type": "default", 
          "nodeType": "start" | "action" | "decision",
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
          "states_en": ["Default", "Hover", "Pressed", "Disabled", "Loading"],
          "nodeIds": ["node_id_1", "node_id_2"]
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
      "pageSuggestions": [
        {
          "name_zh": "登录页",
          "name_en": "Login Page",
          "description_zh": "用户输入账号密码进行登录的入口页面",
          "description_en": "Entry page where user enters credentials to log in"
        }
      ],
      "summary_zh": "流程摘要...",
      "summary_en": "Flow summary..."
    }

    Ensure the nodes are logically connected and cover multiple scenarios.
    If an image is provided, base the steps on the visible UI elements.
    If only text is provided, infer the standard flow for such a feature.

    INPUT METADATA:
    - 本次用户提供的原图数量（user-uploaded images）= ${images?.length ?? 0}
    - 实际发送给你的图像数量（after slicing）= ${processedImages.length}（长截图被纵向切成多片以保留细节）
    ${sliceLayoutNote ? sliceLayoutNote.split('\n').map(l => '    ' + l).join('\n') : ''}
    - 当原图数量 ≥ 2 时，请回到上面"0. Multi-image inputs"的硬约束：
      · 节点数下界 ≈ 1.5 × 原图数量，不允许低于原图数量本身。
      · 必须至少有一条 flow 的 nodeIds 序列显式重复以承载异常/回退路径。
    - 当原图数量 ≥ 1 时，必须至少存在一条非 happy 的 error/loopback flow，且 edges 数组中存在至少一条逆向边（target 在拓扑序上早于 source）。
    - **关键**：如果"实际发送给你的图像数量"大于"原图数量"，说明有长截图被切片了。来自同一原图的多张切片是**同一个页面的连续部分**（顶部导航在第一片、底部 tab 在最后一片，中间的卡片/列表都属于这个页面）。请把切片之间的所有可见模块**合并到同一个页面节点**下来分析，**不要**把每个切片当作独立页面去拆。但反过来，**不同原图之间**就是不同页面/视图，要按多图规则拆开。

    CRITICAL OUTPUT FORMAT REQUIREMENTS:
    - Respond with a **single JSON object only**. No prose before or after.
    - Do NOT wrap the JSON in markdown code fences (no \`\`\`json, no \`\`\`).
    - Do NOT include comments (no //, no /* */) inside the JSON.
    - Do NOT include trailing commas.
    - All keys and string values must be in double quotes.
    - If a field is not applicable, use an empty array [] or empty string "" — never omit required keys.
    
    IMPORTANT: Position the nodes in a logical layout (e.g., top-to-bottom). 
    Calculate approximate x/y coordinates for a layout where nodes don't overlap too much.
    Assume a canvas size of roughly 1000x1000.
    
    Context: ${context}
  `;

  const parts: any[] = [{ text: prompt }];

  if (processedImages.length > 0) {
    processedImages.forEach(img => {
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

    if (isChatCompletionsProvider(settings)) {
      text = await generateOpenAiCompatibleContent(settings, model, prompt, processedImages);
    } else {
      const ai = new GoogleGenAI({ apiKey: getApiKey(settings.apiKey) });
      const config: any = {};

      // JSON mode：除了 image-gen 模型（gemini-*-flash-image）以外都支持，安全开启。
      const isImageGenModel = /flash-image/i.test(model);
      if (!isImageGenModel) {
        config.responseMimeType = "application/json";
      }

      // thinkingConfig 只有支持思考预算的模型才能传，否则 API 直接 400：
      //   "Thinking level is not supported for this model."
      // 目前已知支持：gemini-3.x（含 pro / flash / flash-preview），以及
      // gemini-2.5-pro。gemini-2.5-flash / flash-lite / 2.5-flash-image 都不支持。
      const supportsThinking = /^gemini-3/i.test(model) || /^gemini-2\.5-pro/i.test(model);
      if (supportsThinking) {
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
      console.error("Failed to parse JSON. Raw response:\n", text);
      const reason = (e as Error).message || 'unknown';
      throw new Error(`Invalid JSON response from AI. ${reason}`);
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
        // 'end' 已弃用：模型偶尔仍会输出，统一降级为 'action'
        type: n.nodeType === 'end' ? 'action' : n.nodeType,
        
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

    // 兜底过滤：即使 prompt 已禁，模型仍可能给出 label 是 "结束 / 完成 / End / Done"
    // 这种空壳"流程图尾巴"节点。这类节点没有承载任何 UI / 决策信息，
    // 留在画布上只会让用户觉得"分析很机械"。
    // 判定 = label 命中"终止性词典" + 该节点不带任何 edgeCases / checklist / questions
    //        （只要 AI 真的在这个节点上写出过具体内容，就尊重它的判断不剔除）
    const TERMINAL_LABEL_KEYWORDS = [
      '结束', '完成', '成功', '退出', '关闭', '终止',
      'end', 'finish', 'done', 'complete', 'completed', 'success', 'exit',
    ];
    const isTerminalShellNode = (node: any): boolean => {
      const label = String(node.data?.label || '').trim().toLowerCase();
      if (!label) return false;
      const hitKeyword = TERMINAL_LABEL_KEYWORDS.some(k => label === k || label === k + '。' || label.includes(k));
      if (!hitKeyword) return false;
      // 真的有内容就保留 —— 例如"订单完成 - 展示订单号 + 物流入口"这种带 UI 的节点
      const hasContent =
        (node.data?.edgeCases?.length || 0) > 0 ||
        (node.data?.checklist?.length || 0) > 0 ||
        (node.data?.questions?.length || 0) > 0 ||
        String(node.data?.description || '').trim().length > 0;
      return !hasContent;
    };
    const terminalIds = new Set<string>(nodes.filter(isTerminalShellNode).map((n: any) => n.id));
    const filteredNodes = nodes.filter((n: any) => !terminalIds.has(n.id));

    const edges = data.edges
      .map((e: any) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label_zh || e.label,
        label_zh: e.label_zh,
        label_en: e.label_en,
        animated: true
      }))
      // 端点指向被剔除的"结束节点"的 edge 一并丢弃
      .filter((e: any) => !terminalIds.has(e.source) && !terminalIds.has(e.target));

    const components = data.components?.map((c: any) => ({
      name: c.name_zh || c.name,
      type: c.type,
      states: c.states_zh || c.states || [],
      pages: c.pages_zh || c.pages || [],
      // 把组件 → 节点的索引里指向已剔除节点的 id 也清掉
      nodeIds: (c.nodeIds || []).filter((id: string) => !terminalIds.has(id)),
      name_zh: c.name_zh,
      name_en: c.name_en,
      states_zh: c.states_zh,
      states_en: c.states_en,
      pages_zh: c.pages_zh,
      pages_en: c.pages_en
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

    const pageSuggestions = data.pageSuggestions?.map((p: any) => ({
      name: p.name_zh || p.name,
      description: p.description_zh || p.description,
      name_zh: p.name_zh,
      name_en: p.name_en,
      description_zh: p.description_zh,
      description_en: p.description_en,
    })) || [];

    const flows = data.flows?.map((f: any) => ({
      id: f.id,
      name: f.name_zh || f.name,
      description: f.description_zh || f.description,
      // flow 的 nodeIds 序列里也要把被剔除的"结束节点"挤出去
      nodeIds: (f.nodeIds || []).filter((id: string) => !terminalIds.has(id)),
      name_zh: f.name_zh,
      name_en: f.name_en,
      description_zh: f.description_zh,
      description_en: f.description_en
    })) || [];

    return {
      nodes: filteredNodes,
      edges,
      summary: data.summary_zh || data.summary || "Analysis complete.",
      summary_zh: data.summary_zh,
      summary_en: data.summary_en,
      components,
      usabilityScores,
      pageSuggestions,
      flows
    };

  } catch (error) {
    console.error("AI Analysis Failed:", error);
    throw error;
  }
}
