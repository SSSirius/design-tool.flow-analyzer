import { useState, useRef, useLayoutEffect, useEffect, ChangeEvent, DragEvent, ClipboardEvent, CSSProperties } from 'react';
import { Upload, Play, Loader2, FileText, CheckSquare, ImagePlus, Settings, ChevronDown, ChevronUp, Wifi, X } from 'lucide-react';
import { motion } from 'motion/react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableImage } from './SortableImage';
import { Combobox } from './Combobox';
import { AiSettings } from '../types';
import { DEFAULT_AI_SETTINGS, Z_AI_CODING_BASE_URL, getStoredAiSettings, storeAiSettings, testAiConnection } from '../services/ai';

interface InputPanelProps {
  onAnalyze: (context: string, images: string[], settings: AiSettings) => void;
  isAnalyzing: boolean;
  language: 'zh' | 'en';
}

interface UploadedImage {
  id: string;
  src: string;
}

const TEXT = {
  zh: {
    title: "UX 流程分析器",
    subtitle: "上传 UI 截图或描述上下文，生成流程图和边界情况。",
    contextLabel: "上下文与目标",
    contextPlaceholder: "例如：用户想要更新他们的个人资料图片...",
    imageLabel: "UI 截图 (支持多图排序)",
    uploadText: "点击上传或拖拽文件",
    uploadHint: "PNG, JPG 最大 5MB",
    analyzeBtn: "生成流程",
    analyzingBtn: "分析中...",
    footerEdge: "生成边界情况",
    footerCheck: "创建设计检查清单",
    copy: "复制图片",
    remove: "移除图片",
    clear: "清空所有",
    dragHint: "拖拽图片调整顺序",
    aiSettings: "AI 设置",
    settingsToggle: "设置项",
    providerLabel: "模型服务",
    apiKeyLabel: "API Key",
    apiKeyPlaceholder: "输入你的 API Key",
    baseUrlLabel: "接口地址",
    baseUrlPlaceholder: "例如：https://api.openai.com/v1",
    analysisModelLabel: "分析模型",
    nodeModelLabel: "节点补全模型",
    modelHint: "可调用主流模型接口，或直接输入自定义模型名。请注意需要用图片分析时，模型必须支持Image理解功能。",
    disconnected: "未接入 AI",
    connected: "AI 已连通",
    testing: "检测中...",
    testConnection: "测试连接"
  },
  en: {
    title: "UX Flow Analyzer",
    subtitle: "Upload a UI screenshot or describe the context to generate a flow diagram and edge cases.",
    contextLabel: "Context & Goal",
    contextPlaceholder: "e.g., User wants to update their profile picture...",
    imageLabel: "UI Screenshots (Multi-upload)",
    uploadText: "Click to upload or drag & drop",
    uploadHint: "PNG, JPG up to 5MB",
    analyzeBtn: "Generate Flow",
    analyzingBtn: "Analyzing...",
    footerEdge: "Generates Edge Cases",
    footerCheck: "Creates Design Checklist",
    copy: "Copy Image",
    remove: "Remove Image",
    clear: "Clear All",
    dragHint: "Drag to reorder images",
    aiSettings: "AI Settings",
    settingsToggle: "Settings",
    providerLabel: "Model Provider",
    apiKeyLabel: "API Key",
    apiKeyPlaceholder: "Enter your API key",
    baseUrlLabel: "Base URL",
    baseUrlPlaceholder: "e.g. https://api.openai.com/v1",
    analysisModelLabel: "Analysis Model",
    nodeModelLabel: "Node Completion Model",
    modelHint: "Calls to supported models. Custom model names are allowed. Please note that when using images, the model must support image understanding.",
    disconnected: "AI not connected",
    connected: "AI connected",
    testing: "Testing...",
    testConnection: "Test Connection"
  }
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

export default function InputPanel({ onAnalyze, isAnalyzing, language }: InputPanelProps) {
  const [context, setContext] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => getStoredAiSettings());
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'testing' | 'connected'>('disconnected');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsAnchorRef = useRef<HTMLDivElement>(null);
  const [anchorStyle, setAnchorStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!showAiSettings) return;
    const updateAnchor = () => {
      const el = settingsAnchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setAnchorStyle({
        ['--ai-anchor-left' as any]: `${rect.left}px`,
        ['--ai-anchor-bottom' as any]: `${window.innerHeight - rect.top + 8}px`,
        ['--ai-anchor-width' as any]: `${rect.width}px`,
      });
    };
    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);
    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, [showAiSettings]);

  useEffect(() => {
    if (!showAiSettings) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowAiSettings(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showAiSettings]);
  
  const t = TEXT[language];

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(Array.from(files));
    }
  };

  const processFiles = (files: File[]) => {
    const newImages: UploadedImage[] = [];
    let processedCount = 0;

    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push({
          id: Math.random().toString(36).substr(2, 9),
          src: reader.result as string
        });
        processedCount++;
        
        if (processedCount === files.length) {
          setImages(prev => [...prev, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(Array.from(files));
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      processFiles(files);
      e.preventDefault();
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleRemoveImage = (id: string) => {
    setImages(images.filter(img => img.id !== id));
  };

  const updateAiSettings = (patch: Partial<AiSettings>) => {
    setAiSettings((current) => {
      const next = { ...DEFAULT_AI_SETTINGS, ...current, ...patch };
      storeAiSettings(next);
      setConnectionStatus('disconnected');
      return next;
    });
  };

  const handleProviderChange = (provider: AiSettings['provider']) => {
    const isGemini = provider === 'gemini';
    const isZAiCoding = provider === 'z-ai-coding';

    updateAiSettings({
      provider,
      analysisModel: isGemini ? 'auto' : isZAiCoding ? 'glm-5.1' : 'gpt-4o-mini',
      nodeModel: isGemini ? 'gemini-3-flash-preview' : isZAiCoding ? 'glm-5.1' : 'gpt-4o-mini',
      baseUrl: isZAiCoding
        ? Z_AI_CODING_BASE_URL
        : isGemini
          ? DEFAULT_AI_SETTINGS.baseUrl
          : aiSettings.baseUrl || DEFAULT_AI_SETTINGS.baseUrl,
    });
  };

  const hasAiConfig = Boolean(
    aiSettings.apiKey.trim() &&
    aiSettings.analysisModel.trim() &&
    aiSettings.nodeModel.trim() &&
    (aiSettings.provider === 'gemini' || aiSettings.baseUrl.trim())
  );
  const isConnected = hasAiConfig && connectionStatus === 'connected';
  const statusText = connectionStatus === 'testing'
    ? t.testing
    : isConnected
      ? t.connected
      : t.disconnected;
  const statusClass = isConnected
    ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.65)]'
    : connectionStatus === 'testing'
      ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.55)]'
      : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.65)]';
  const modelOptions = MODEL_OPTIONS_BY_PROVIDER[aiSettings.provider];

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    try {
      await testAiConnection(aiSettings);
      setConnectionStatus('connected');
    } catch (error: any) {
      setConnectionStatus('disconnected');
      alert(error.message || 'AI connection failed.');
    }
  };

  const handleSubmit = () => {
    if (!context.trim() && images.length === 0) return;
    onAnalyze(context, images.map(img => img.src), aiSettings);
  };

  return (
    <>
      <div 
        className="relative h-full flex flex-col bg-transparent p-4 overflow-y-auto text-[#d7d9df] outline-none"
        onPaste={handlePaste}
        tabIndex={0}
      >
        <div className="mb-6">
          <h1 className="type-lg text-white mb-1">{t.title}</h1>
          <p className="type-sm text-[#8a8a8a]">
            {t.subtitle}
          </p>
        </div>

      <div className="space-y-4 flex-1">
        {/* Context Input */}
        <div>
          <label className="block type-sm font-semibold uppercase tracking-wider text-[#8a8a8a] mb-3">
            {t.contextLabel}
          </label>
          <textarea
            className="glass-input input-panel-context-input"
            placeholder={t.contextPlaceholder}
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        {/* Image Upload */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="block type-sm font-semibold uppercase tracking-wider text-[#8a8a8a]">
              {t.imageLabel}
            </label>
            {images.length > 0 && (
              <button
                type="button"
                onClick={() => setImages([])}
                className="input-panel-clear-btn"
              >
                {t.clear}
              </button>
            )}
          </div>
          
          <div
            className={`glass-card upload-dropzone ${images.length > 0 ? 'upload-dropzone--filled' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {images.length > 0 ? (
              <DndContext 
                sensors={sensors} 
                collisionDetection={closestCenter} 
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={images.map(img => img.id)} 
                  strategy={rectSortingStrategy}
                >
                  <div className="upload-grid">
                    {images.map((img) => (
                      <SortableImage 
                        key={img.id} 
                        id={img.id} 
                        src={img.src} 
                        onRemove={handleRemoveImage} 
                      />
                    ))}
                    
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="upload-add-tile"
                    >
                      <ImagePlus size={20} className="upload-add-tile-icon" />
                      <span className="type-xs">{language === 'zh' ? '添加' : 'Add'}</span>
                    </button>
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div
                className="upload-empty"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-icon-box">
                  <Upload size={14} />
                </div>
                <p className="upload-empty-text">{t.uploadText}</p>
              </div>
            )}
            
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
            />
          </div>
          {images.length > 0 && (
            <p className="type-xs text-[#676d78] text-center mt-2">
              {t.dragHint}
            </p>
          )}
        </div>

        {/* Action Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={isAnalyzing || (!context && images.length === 0)}
          className={`w-full py-3 rounded-lg flex items-center justify-center font-semibold type-sm transition-all cursor-pointer ${
            isAnalyzing || (!context && images.length === 0)
              ? 'bg-[#242424] text-[#6f6f6f] cursor-not-allowed border border-[#303030]'
              : 'glass-primary hover:brightness-105'
          }`}
        >
          {isAnalyzing ? (
            <>
              <Loader2 size={14} className="animate-spin mr-2" />
              {t.analyzingBtn}
            </>
          ) : (
            <>
              <Play size={14} className="mr-2 fill-current" />
              {t.analyzeBtn}
            </>
          )}
        </motion.button>
      </div>

      {/* Footer Info */}
      <div className="mt-6 pt-4 border-t border-[#303030]">
        <div className="flex items-center type-sm text-[#777d89] mb-1">
          <CheckSquare size={10} className="mr-2" />
          <span>{t.footerEdge}</span>
        </div>
        <div className="flex items-center type-sm text-[#777d89]">
          <FileText size={10} className="mr-2" />
          <span>{t.footerCheck}</span>
        </div>

        <div
          ref={settingsAnchorRef}
          className={`glass-card relative mt-3 rounded-lg settings-anchor ${showAiSettings ? 'settings-anchor--raised' : ''}`}
        >
          <button
            type="button"
            onClick={() => setShowAiSettings((open) => !open)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-[#ababab] hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2 type-sm font-medium">
              <Settings size={12} />
              {t.settingsToggle}
            </span>
            <span className="flex items-center gap-2 type-xs text-[#8a8a8a]">
              <span className={`h-2 w-2 rounded-md ${statusClass}`} />
              {statusText}
              {showAiSettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </span>
          </button>

          {showAiSettings && (
            <div
              className="ai-settings-overlay"
              onClick={() => setShowAiSettings(false)}
            >
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
                    onClick={() => setShowAiSettings(false)}
                    className="ai-settings-close"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="ai-settings-body">
                  <div className="ai-field">
                    <label className="ai-field-label">{t.providerLabel}</label>
                    <Combobox
                      value={aiSettings.provider}
                      allowCustom={false}
                      options={[
                        { value: 'gemini', label: 'Gemini' },
                        { value: 'z-ai-coding', label: 'Z.AI Coding Plan' },
                        { value: 'openai-compatible', label: 'OpenAI Compatible' },
                      ]}
                      onChange={(v) => handleProviderChange(v as AiSettings['provider'])}
                    />
                  </div>

                  {aiSettings.provider !== 'gemini' && (
                    <div className="ai-field">
                      <label className="ai-field-label">{t.baseUrlLabel}</label>
                      <input
                        className="ai-field-input glass-input"
                        type="url"
                        autoComplete="off"
                        placeholder={t.baseUrlPlaceholder}
                        value={aiSettings.baseUrl}
                        onChange={(e) => updateAiSettings({ baseUrl: e.target.value })}
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
                      value={aiSettings.apiKey}
                      onChange={(e) => updateAiSettings({ apiKey: e.target.value })}
                    />
                  </div>

                  <div className="ai-field">
                    <label className="ai-field-label">{t.analysisModelLabel}</label>
                    <Combobox
                      value={aiSettings.analysisModel}
                      options={modelOptions}
                      onChange={(value) => updateAiSettings({ analysisModel: value })}
                    />
                  </div>

                  <div className="ai-field">
                    <label className="ai-field-label">{t.nodeModelLabel}</label>
                    <Combobox
                      value={aiSettings.nodeModel}
                      options={modelOptions.filter((model) => model !== 'auto')}
                      onChange={(value) => updateAiSettings({ nodeModel: value })}
                    />
                  </div>
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
          )}
        </div>
      </div>
      </div>
    </>
  );
}
