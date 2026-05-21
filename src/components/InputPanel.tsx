import { useState, useRef, ChangeEvent, DragEvent, ClipboardEvent } from 'react';
import { Upload, Play, Loader2, FileText, CheckSquare, ImagePlus, Settings, ChevronDown, ChevronUp, Wifi } from 'lucide-react';
import { motion } from 'motion/react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { SortableImage } from './SortableImage';
import { AiSettings } from '../types';
import { DEFAULT_AI_SETTINGS, getStoredAiSettings, storeAiSettings, testAiConnection } from '../services/ai';

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
    subtitle: "上传 UI 截图并描述上下文，生成流程图和边界情况。",
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
    modelHint: "支持 Gemini 或 OpenAI-compatible 接口，可直接输入自定义模型名。",
    disconnected: "未接入 AI",
    connected: "AI 已连通",
    testing: "检测中...",
    testConnection: "测试连接"
  },
  en: {
    title: "UX Flow Analyzer",
    subtitle: "Upload a UI screenshot and describe the context to generate a flow diagram and edge cases.",
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
    modelHint: "Supports Gemini or OpenAI-compatible APIs. Custom model names are allowed.",
    disconnected: "AI not connected",
    connected: "AI connected",
    testing: "Testing...",
    testConnection: "Test Connection"
  }
};

const MODEL_OPTIONS = [
  "auto",
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gemini-3.1-pro-preview",
  "gemini-3-flash-preview",
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.5-flash-image",
];

export default function InputPanel({ onAnalyze, isAnalyzing, language }: InputPanelProps) {
  const [context, setContext] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => getStoredAiSettings());
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'testing' | 'connected'>('disconnected');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
    updateAiSettings({
      provider,
      analysisModel: provider === 'gemini' ? 'auto' : 'gpt-4o-mini',
      nodeModel: provider === 'gemini' ? 'gemini-3-flash-preview' : 'gpt-4o-mini',
      baseUrl: provider === 'gemini' ? DEFAULT_AI_SETTINGS.baseUrl : aiSettings.baseUrl || DEFAULT_AI_SETTINGS.baseUrl,
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
    <div 
      className="h-full flex flex-col bg-stone-900 border-r border-stone-800 p-4 overflow-y-auto text-stone-300 outline-none"
      onPaste={handlePaste}
      tabIndex={0}
    >
      <div className="mb-6">
        <h1 className="type-lg text-stone-100 mb-1">{t.title}</h1>
        <p className="type-sm text-stone-500">
          {t.subtitle}
        </p>
      </div>

      <div className="space-y-4 flex-1">
        {/* Context Input */}
        <div>
          <label className="block type-sm font-semibold uppercase tracking-wider text-stone-500 mb-1">
            {t.contextLabel}
          </label>
          <textarea
            className="w-full h-24 p-2 bg-stone-800 border border-stone-700 rounded-md type-base text-stone-200 focus:ring-1 focus:ring-stone-500 focus:outline-none resize-none transition-all placeholder-stone-600"
            placeholder={t.contextPlaceholder}
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        {/* Image Upload */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block type-sm font-semibold uppercase tracking-wider text-stone-500">
              {t.imageLabel}
            </label>
            {images.length > 0 && (
              <button
                type="button"
                onClick={() => setImages([])}
                className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
              >
                {t.clear}
              </button>
            )}
          </div>
          
          <div
            className={`relative border border-dashed rounded-lg p-4 transition-all ${
              images.length > 0 ? 'border-stone-700 bg-stone-800/30' : 'border-stone-700 hover:border-stone-600 bg-stone-800/50 text-center'
            }`}
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
                  <div className="grid grid-cols-2 gap-2">
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
                      className="aspect-square border-2 border-dashed border-stone-700 rounded-lg flex flex-col items-center justify-center text-stone-500 hover:border-stone-500 hover:text-stone-300 transition-colors bg-stone-800/30 hover:bg-stone-800"
                    >
                      <ImagePlus size={20} className="mb-1" />
                      <span className="text-[10px]">{language === 'zh' ? '添加' : 'Add'}</span>
                    </button>
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div
                className="cursor-pointer flex flex-col items-center justify-center py-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-8 h-8 bg-stone-700 rounded-full flex items-center justify-center mb-2">
                  <Upload size={14} className="text-stone-400" />
                </div>
                <p className="type-sm font-medium text-stone-400">{t.uploadText}</p>
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
            <p className="text-[10px] text-stone-600 text-center mt-2">
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
          className={`w-full py-3 rounded-lg flex items-center justify-center text-stone-900 font-semibold type-base shadow-lg transition-all cursor-pointer ${
            isAnalyzing || (!context && images.length === 0)
              ? 'bg-stone-700 text-stone-500 cursor-not-allowed'
              : 'bg-stone-100 hover:bg-white'
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
      <div className="mt-6 pt-4 border-t border-stone-800">
        <div className="flex items-center type-sm text-stone-600 mb-1">
          <CheckSquare size={10} className="mr-2" />
          <span>{t.footerEdge}</span>
        </div>
        <div className="flex items-center type-sm text-stone-600">
          <FileText size={10} className="mr-2" />
          <span>{t.footerCheck}</span>
        </div>

        <div className="relative mt-3 rounded-lg border border-stone-800 bg-stone-950/30">
          <button
            type="button"
            onClick={() => setShowAiSettings((open) => !open)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-stone-400 hover:text-stone-200 transition-colors"
          >
            <span className="flex items-center gap-2 type-sm font-medium">
              <Settings size={12} />
              {t.settingsToggle}
            </span>
            <span className="flex items-center gap-2 text-[10px] text-stone-500">
              <span className={`h-2 w-2 rounded-full ${statusClass}`} />
              {statusText}
              {showAiSettings ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </span>
          </button>

          {showAiSettings && (
            <div className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-[58vh] overflow-y-auto rounded-lg border border-stone-700 bg-stone-900 p-3 shadow-2xl shadow-black/50">
              <div>
                <h2 className="type-sm font-semibold uppercase tracking-wider text-stone-500">
                  {t.aiSettings}
                </h2>
                <p className="mt-1 text-[10px] leading-relaxed text-stone-600">
                  {t.modelHint}
                </p>
              </div>

              <div>
                <label className="block type-sm font-semibold text-stone-500 mb-1">
                  {t.providerLabel}
                </label>
                <select
                  className="w-full p-2 bg-stone-800 border border-stone-700 rounded-md type-base text-stone-200 focus:ring-1 focus:ring-stone-500 focus:outline-none transition-all"
                  value={aiSettings.provider}
                  onChange={(e) => handleProviderChange(e.target.value as AiSettings['provider'])}
                >
                  <option value="gemini">Gemini</option>
                  <option value="openai-compatible">OpenAI Compatible</option>
                </select>
              </div>

              {aiSettings.provider === 'openai-compatible' && (
                <div>
                  <label className="block type-sm font-semibold text-stone-500 mb-1">
                    {t.baseUrlLabel}
                  </label>
                  <input
                    className="w-full p-2 bg-stone-800 border border-stone-700 rounded-md type-base text-stone-200 focus:ring-1 focus:ring-stone-500 focus:outline-none transition-all placeholder-stone-600"
                    type="url"
                    autoComplete="off"
                    placeholder={t.baseUrlPlaceholder}
                    value={aiSettings.baseUrl}
                    onChange={(e) => updateAiSettings({ baseUrl: e.target.value })}
                  />
                </div>
              )}

              <div>
                <label className="block type-sm font-semibold text-stone-500 mb-1">
                  {t.apiKeyLabel}
                </label>
                <input
                  className="w-full p-2 bg-stone-800 border border-stone-700 rounded-md type-base text-stone-200 focus:ring-1 focus:ring-stone-500 focus:outline-none transition-all placeholder-stone-600"
                  type="password"
                  autoComplete="off"
                  placeholder={t.apiKeyPlaceholder}
                  value={aiSettings.apiKey}
                  onChange={(e) => updateAiSettings({ apiKey: e.target.value })}
                />
              </div>

              <div>
                <label className="block type-sm font-semibold text-stone-500 mb-1">
                  {t.analysisModelLabel}
                </label>
                <input
                  className="w-full p-2 bg-stone-800 border border-stone-700 rounded-md type-base text-stone-200 focus:ring-1 focus:ring-stone-500 focus:outline-none transition-all"
                  list="analysis-model-options"
                  value={aiSettings.analysisModel}
                  onChange={(e) => updateAiSettings({ analysisModel: e.target.value })}
                />
              </div>

              <div>
                <label className="block type-sm font-semibold text-stone-500 mb-1">
                  {t.nodeModelLabel}
                </label>
                <input
                  className="w-full p-2 bg-stone-800 border border-stone-700 rounded-md type-base text-stone-200 focus:ring-1 focus:ring-stone-500 focus:outline-none transition-all"
                  list="node-model-options"
                  value={aiSettings.nodeModel}
                  onChange={(e) => updateAiSettings({ nodeModel: e.target.value })}
                />
              </div>

              <button
                type="button"
                onClick={handleTestConnection}
                disabled={connectionStatus === 'testing'}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-indigo-500/40 bg-indigo-500/15 px-3 py-2 type-sm font-semibold text-indigo-200 transition-colors hover:border-indigo-400/70 hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {connectionStatus === 'testing' ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
                {t.testConnection}
              </button>

              <datalist id="analysis-model-options">
                {MODEL_OPTIONS.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
              <datalist id="node-model-options">
                {MODEL_OPTIONS.filter((model) => model !== "auto").map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
