import type { CSSProperties } from 'react';
import { Info, Loader2, Wifi, X } from 'lucide-react';
import { Combobox } from './Combobox';
import { AiSettings } from '../types';
import { DEFAULT_AI_SETTINGS, Z_AI_CODING_BASE_URL, testAiConnection } from '../services/ai';

type ConnectionStatus = 'disconnected' | 'testing' | 'connected';

interface AiSettingsPanelProps {
  language: 'zh' | 'en';
  settings: AiSettings;
  connectionStatus: ConnectionStatus;
  anchorStyle: CSSProperties;
  onClose: () => void;
  onUpdate: (patch: Partial<AiSettings>) => void;
  onConnectionStatusChange: (status: ConnectionStatus) => void;
}

const TEXT = {
  zh: {
    aiSettings: "AI 设置",
    connectionGroup: "连接方式",
    modelGroup: "模型分工",
    providerLabel: "模型服务",
    apiKeyLabel: "API Key",
    apiKeyPlaceholder: "输入你的 API Key",
    baseUrlLabel: "接口地址",
    baseUrlPlaceholder: "例如：https://api.openai.com/v1",
    analysisModelLabel: "分析模型",
    nodeModelLabel: "节点补全模型",
    modelHint: "可调用主流模型接口，或直接输入自定义模型名。请注意需要用图片分析时，模型必须支持Image理解功能。",
    testConnection: "测试连接",
    visionReady: "该分析模型可用于截图理解。",
    visionUnknown: "该分析模型可能不支持图片输入；如果上传截图，请选择支持视觉理解的模型。",
    nodeModelHint: "节点补全模型只负责补写节点内容，可选更轻量的文本模型。",
  },
  en: {
    aiSettings: "AI Settings",
    connectionGroup: "Connection",
    modelGroup: "Model roles",
    providerLabel: "Model Provider",
    apiKeyLabel: "API Key",
    apiKeyPlaceholder: "Enter your API key",
    baseUrlLabel: "Base URL",
    baseUrlPlaceholder: "e.g. https://api.openai.com/v1",
    analysisModelLabel: "Analysis Model",
    nodeModelLabel: "Node Completion Model",
    modelHint: "Calls to supported models. Custom model names are allowed. Please note that when using images, the model must support image understanding.",
    testConnection: "Test Connection",
    visionReady: "This analysis model can interpret screenshots.",
    visionUnknown: "This analysis model may not support image input. Use a vision-capable model when uploading screenshots.",
    nodeModelHint: "The node completion model only expands node content, so a lighter text model is fine.",
  },
};

const MODEL_OPTIONS_BY_PROVIDER: Record<AiSettings['provider'], string[]> = {
  gemini: [
    "auto",
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.5-flash-image",
  ],
  "z-ai-coding": [
    "glm-5.1",
    "glm-4.7",
  ],
  "openai-compatible": [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
  ],
};

const isKnownVisionModel = (provider: AiSettings['provider'], model: string) => {
  const normalized = model.trim().toLowerCase();
  if (!normalized) return false;
  if (provider === 'gemini') return normalized === 'auto' || normalized.includes('gemini');
  if (provider === 'openai-compatible') {
    return normalized.includes('gpt-4o') || normalized.includes('gpt-4.1');
  }
  return false;
};

export default function AiSettingsPanel({
  language,
  settings,
  connectionStatus,
  anchorStyle,
  onClose,
  onUpdate,
  onConnectionStatusChange,
}: AiSettingsPanelProps) {
  const t = TEXT[language];
  const modelOptions = MODEL_OPTIONS_BY_PROVIDER[settings.provider];
  const analysisModelVisionReady = isKnownVisionModel(settings.provider, settings.analysisModel);

  const handleProviderChange = (provider: AiSettings['provider']) => {
    const isGemini = provider === 'gemini';
    const isZAiCoding = provider === 'z-ai-coding';

    onUpdate({
      provider,
      analysisModel: isGemini ? 'auto' : isZAiCoding ? 'glm-5.1' : 'gpt-4o-mini',
      nodeModel: isGemini ? 'gemini-3-flash-preview' : isZAiCoding ? 'glm-5.1' : 'gpt-4o-mini',
      baseUrl: isZAiCoding
        ? Z_AI_CODING_BASE_URL
        : isGemini
          ? DEFAULT_AI_SETTINGS.baseUrl
          : settings.baseUrl || DEFAULT_AI_SETTINGS.baseUrl,
    });
  };

  const handleTestConnection = async () => {
    onConnectionStatusChange('testing');
    try {
      await testAiConnection(settings);
      onConnectionStatusChange('connected');
    } catch (error: any) {
      onConnectionStatusChange('disconnected');
      alert(error.message || 'AI connection failed.');
    }
  };

  return (
    <div className="ai-settings-overlay" onClick={onClose}>
      <div
        className="ai-settings-modal"
        style={anchorStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="ai-settings-header">
          <div>
            <h2 className="ai-settings-title">{t.aiSettings}</h2>
            <p className="ai-settings-hint">{t.modelHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ai-settings-close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="ai-settings-body">
          <section className="ai-settings-section">
            <div className="ai-settings-section-title">{t.connectionGroup}</div>
            <div className="ai-field">
              <label className="ai-field-label">{t.providerLabel}</label>
              <Combobox
                value={settings.provider}
                allowCustom={false}
                options={[
                  { value: 'gemini', label: 'Gemini' },
                  { value: 'z-ai-coding', label: 'Z.AI Coding Plan' },
                  { value: 'openai-compatible', label: 'OpenAI Compatible' },
                ]}
                onChange={(v) => handleProviderChange(v as AiSettings['provider'])}
              />
            </div>

            {settings.provider !== 'gemini' && (
              <div className="ai-field">
                <label className="ai-field-label">{t.baseUrlLabel}</label>
                <input
                  className="ai-field-input glass-input"
                  type="url"
                  autoComplete="off"
                  placeholder={t.baseUrlPlaceholder}
                  value={settings.baseUrl}
                  onChange={(e) => onUpdate({ baseUrl: e.target.value })}
                />
              </div>
            )}

            <div className="ai-field">
              <label className="ai-field-label">{t.apiKeyLabel}</label>
              <input
                className="ai-field-input glass-input"
                type="password"
                autoComplete="off"
                placeholder={t.apiKeyPlaceholder}
                value={settings.apiKey}
                onChange={(e) => onUpdate({ apiKey: e.target.value })}
              />
            </div>
          </section>

          <section className="ai-settings-section">
            <div className="ai-settings-section-title">{t.modelGroup}</div>
            <div className="ai-field">
              <label className="ai-field-label">{t.analysisModelLabel}</label>
              <Combobox
                value={settings.analysisModel}
                options={modelOptions}
                onChange={(value) => onUpdate({ analysisModel: value })}
              />
              <div className={analysisModelVisionReady ? 'ai-model-note ai-model-note--ok' : 'ai-model-note ai-model-note--warn'}>
                <Info size={13} />
                <span>{analysisModelVisionReady ? t.visionReady : t.visionUnknown}</span>
              </div>
            </div>

            <div className="ai-field">
              <label className="ai-field-label">{t.nodeModelLabel}</label>
              <Combobox
                value={settings.nodeModel}
                options={modelOptions.filter((model) => model !== 'auto')}
                onChange={(value) => onUpdate({ nodeModel: value })}
              />
              <div className="ai-model-note">
                <Info size={13} />
                <span>{t.nodeModelHint}</span>
              </div>
            </div>
          </section>
        </div>

        <div className="ai-settings-footer">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={connectionStatus === 'testing'}
            className="ai-test-btn"
          >
            {connectionStatus === 'testing' ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
            {t.testConnection}
          </button>
        </div>
      </div>
    </div>
  );
}
