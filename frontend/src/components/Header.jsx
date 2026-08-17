import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  ShieldCheck, 
  Plus, 
  ChevronDown, 
  RefreshCw, 
  Sparkles,
  Zap,
  Search,
  ClipboardPaste,
  ArrowRight,
  Globe,
  Bot,
  Users,
  Check
} from 'lucide-react';

export default function Header({ 
  activeTab, 
  setActiveTab, 
  onNewSession, 
  models, 
  activeModel, 
  setActiveModel, 
  agents = [],
  activeAgentId,
  onSelectAgent,
  telemetry,
  onOpenCommandPalette 
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customModelInput, setCustomModelInput] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [openaiCatalog, setOpenaiCatalog] = useState([]);
  const [anthropicCatalog, setAnthropicCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [customFinetuneJobs, setCustomFinetuneJobs] = useState([]);

  const activeAgent = agents.find(a => a.id === activeAgentId) || agents[0];

  // Fetch provider catalogs & custom fine-tuned jobs on component mount
  useEffect(() => {
    setCatalogLoading(true);
    fetch('/api/models/openrouter/catalog')
      .then(res => res.json())
      .then(data => {
        if (data.models && Array.isArray(data.models)) {
          setCatalog(data.models);
        }
      })
      .catch(err => console.error('Failed to load catalog:', err));

    fetch('/api/models/openai/catalog')
      .then(res => res.json())
      .then(data => {
        if (data.models && Array.isArray(data.models)) {
          setOpenaiCatalog(data.models);
        }
      })
      .catch(err => console.error('Failed to load OpenAI catalog:', err));

    fetch('/api/models/anthropic/catalog')
      .then(res => res.json())
      .then(data => {
        if (data.models && Array.isArray(data.models)) {
          setAnthropicCatalog(data.models);
        }
      })
      .catch(err => console.error('Failed to load Anthropic catalog:', err))
      .finally(() => setCatalogLoading(false));

    fetch('/api/finetuning/jobs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCustomFinetuneJobs(data);
      })
      .catch(() => {});
  }, [dropdownOpen]);

  const handleSelectModel = async (modelId, provider = 'ollama') => {
    setActiveModel({ model: modelId, provider });
    setDropdownOpen(false);
    setSearchQuery('');
    setCustomModelInput('');
    try {
      await fetch('/api/models/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, model_id: modelId }),
      });
    } catch (e) {
      console.error('Failed to update active model:', e);
    }
  };

  const handleSelectAgentItem = (agent) => {
    onSelectAgent?.(agent.id);
    setDropdownOpen(false);
    setSearchQuery('');
  };

  const handleCustomModelSubmit = (e) => {
    e.preventDefault();
    const trimmed = customModelInput.trim();
    if (!trimmed) return;
    let provider = 'ollama';
    if (trimmed.includes('/') || trimmed.startsWith('~')) provider = 'openrouter';
    else if (trimmed.startsWith('claude')) provider = 'anthropic';
    else if (/^(gpt-|o1|o3|o4)/.test(trimmed)) provider = 'openai';
    handleSelectModel(trimmed, provider);
  };

  const handleSyncModels = async (e) => {
    e.stopPropagation();
    setSyncing(true);
    try {
      await fetch('/api/models/sync', { method: 'POST' });
      window.location.reload();
    } catch (e) {
      console.error('Failed to sync models:', e);
    } finally {
      setSyncing(false);
    }
  };

  // Combine custom models from models.json and live catalog
  const allOpenRouterModels = [
    ...(models?.custom_models || []),
    ...catalog.filter(cm => !(models?.custom_models || []).some(m => m.id === cm.id))
  ];

  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.role || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.model_id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOllama = (models?.ollama_models || []).filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOpenRouter = allOpenRouterModels.filter(m => 
    (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOpenAI = openaiCatalog.filter(m => 
    (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAnthropic = anthropicCatalog.filter(m => 
    (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (m.id || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <header className="h-14 border-b border-card-border bg-card/80 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Brand & Mode */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-lg shadow-sm shadow-emerald-500/10">
          ⚡
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-gray-100 tracking-tight">PiStation</span>
          </div>
        </div>
      </div>

      {/* Center Controls: Live Agent & Model Selector */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-[#181b26] hover:bg-[#202534] border border-card-border text-xs text-gray-200 transition-all shadow-inner cursor-pointer"
        >
          {(() => {
            const activeCustom = customFinetuneJobs.find(j => 
              j.target_identifier === activeModel?.model || j.name === activeModel?.model
            );
            const isAgentNative = activeModel?.model === activeAgent?.model_id;
            const isCloud = ['openrouter', 'openai', 'anthropic'].includes(activeModel?.provider) || (activeModel?.model && (activeModel.model.includes('/') || activeModel.model.startsWith('claude') || /^(gpt-|o1|o3|o4)/.test(activeModel.model) || !models?.ollama_models?.some(m => m.id === activeModel.model)));

            if (activeCustom) {
              return (
                <>
                  <span className="text-sm">🎯</span>
                  <span className="font-bold text-purple-300 truncate max-w-[150px]">{activeCustom.name}</span>
                  <span className="text-gray-500">•</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30 font-bold truncate max-w-[140px]">
                    Custom Local
                  </span>
                </>
              );
            } else if (isAgentNative) {
              return (
                <>
                  <span className="text-sm">{activeAgent?.avatar || '🤖'}</span>
                  <span className="font-bold text-gray-100 truncate max-w-[130px]">{activeAgent?.name || 'Agent'}</span>
                  <span className="text-gray-500">•</span>
                  <span className="font-medium font-mono text-[11px] text-gray-300 truncate max-w-[140px]">{activeModel?.model || 'Select Model'}</span>
                  {isCloud ? (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-sky-300 bg-sky-500/20 border border-sky-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                      Cloud
                    </span>
                  ) : (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                      Local
                    </span>
                  )}
                </>
              );
            } else {
              return (
                <>
                  <span className="text-sm">{isCloud ? '☁️' : '🖥️'}</span>
                  <span className="font-bold text-gray-200 truncate max-w-[150px]">{activeModel?.model || 'Direct Model'}</span>
                  {isCloud ? (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-sky-300 bg-sky-500/20 border border-sky-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                      Cloud
                    </span>
                  ) : (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">
                      Local
                    </span>
                  )}
                </>
              );
            }
          })()}
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[420px] glass-dropdown rounded-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 shadow-2xl space-y-2.5 bg-[#101422] border border-card-border">
              
              {/* Header & Sync */}
              <div className="flex items-center justify-between pb-1 border-b border-card-border">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-300 font-mono flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Agent & Engine Selector</span>
                </span>
                <button
                  onClick={handleSyncModels}
                  className="text-[11px] text-gray-400 hover:text-emerald-400 flex items-center gap-1 transition-colors font-mono cursor-pointer"
                  title="Rescan Ollama models"
                >
                  <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                  <span>Sync Ollama</span>
                </button>
              </div>

              {/* Instant Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search agents or 400+ models..."
                  className="w-full bg-[#151928] border border-card-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50 font-sans"
                />
              </div>

              {/* Paste Custom Model ID Form */}
              <form onSubmit={handleCustomModelSubmit} className="flex gap-1.5">
                <div className="relative flex-1">
                  <ClipboardPaste className="w-3 h-3 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customModelInput}
                    onChange={(e) => setCustomModelInput(e.target.value)}
                    placeholder="Paste custom ID (e.g. meta-llama/llama-3.1-405b)"
                    className="w-full bg-[#151928] border border-card-border/80 rounded-lg pl-7 pr-2 py-1 text-[11px] text-gray-200 font-mono placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!customModelInput.trim()}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-semibold transition-all flex items-center gap-1 shadow-sm shrink-0 cursor-pointer"
                >
                  <span>Activate</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </form>

              {/* Scrollable Agent & Model Lists */}
              <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
                
                {/* 0. Custom Fine-Tuned Models Section */}
                {customFinetuneJobs.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-300 font-mono flex items-center gap-1.5 border-b border-card-border/40 pb-1 mb-1">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>Custom Fine-Tuned Models ({customFinetuneJobs.length})</span>
                    </div>
                    <div className="space-y-1">
                      {customFinetuneJobs.map((job) => {
                        const isCurrentModel = activeModel?.model === job.target_identifier;
                        return (
                          <button
                            key={job.id}
                            onClick={() => handleSelectModel(job.target_identifier, 'ollama')}
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors border cursor-pointer ${
                              isCurrentModel
                                ? 'bg-purple-500/20 text-purple-200 border-purple-500/40 shadow-sm'
                                : 'hover:bg-[#181c2b] text-gray-300 border-card-border/40'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate mr-2">
                              <span className="text-base shrink-0">🎯</span>
                              <div className="truncate">
                                <div className="font-bold text-xs text-purple-200 truncate">{job.name}</div>
                                <div className="text-[10px] text-gray-400 font-mono truncate">
                                  {job.target_identifier} • <span className="text-emerald-400 font-semibold">{job.status}</span>
                                </div>
                              </div>
                            </div>
                            <span className="text-[9px] font-mono font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 rounded shrink-0 mr-1.5">
                              CUSTOM
                            </span>
                            {isCurrentModel && (
                              <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 1. Configured Agents Section */}
                {filteredAgents.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-300 font-mono flex items-center gap-1.5 border-b border-card-border/40 pb-1 mb-1">
                      <Users className="w-3 h-3 text-indigo-400" />
                      <span>Available Autonomous Agents ({filteredAgents.length})</span>
                    </div>
                    <div className="space-y-1">
                      {filteredAgents.map((ag) => {
                        const isCurrentAgent = activeAgent?.id === ag.id && activeModel?.model === ag.model_id;
                        const isCloud = ag.model_id && (ag.model_id.includes('/') || !models?.ollama_models?.some(m => m.id === ag.model_id));
                        return (
                          <button
                            key={ag.id}
                            onClick={() => handleSelectAgentItem(ag)}
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors border cursor-pointer ${
                              isCurrentAgent
                                ? 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40 shadow-sm'
                                : 'hover:bg-[#181c2b] text-gray-300 border-card-border/40'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate mr-2">
                              <span className="text-base shrink-0">{ag.avatar || '🤖'}</span>
                              <div className="truncate">
                                <div className="font-bold text-xs text-gray-100 truncate">{ag.name}</div>
                                <div className="text-[10px] text-gray-400 font-mono truncate">
                                  {ag.role} • <span className={isCloud ? 'text-sky-300' : 'text-emerald-400'}>{ag.model_id}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                isCloud 
                                  ? 'text-sky-300 bg-sky-500/15 border-sky-500/30' 
                                  : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              }`}>
                                {isCloud ? 'CLOUD' : 'LOCAL'}
                              </span>
                              {isCurrentAgent && (
                                <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Local Ollama Models Section */}
                {filteredOllama.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 font-mono flex items-center gap-1 border-b border-card-border/40 pb-1 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Local GPU Models (Ollama)</span>
                    </div>
                    <div className="space-y-0.5">
                      {filteredOllama.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectModel(m.id, 'ollama')}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                            activeModel?.model === m.id
                              ? 'bg-emerald-500/10 text-emerald-300 font-medium border border-emerald-500/20'
                              : 'hover:bg-[#181c2b] text-gray-300'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <div className="font-mono text-xs font-medium">{m.name}</div>
                            <div className="text-[10px] text-gray-500">{m.parameter_size || 'Local'} • {m.family}</div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                              LOCAL
                            </span>
                            {activeModel?.model === m.id && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Cloud OpenRouter Section */}
                <div>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-sky-400 font-mono flex items-center justify-between border-b border-card-border/40 pb-1 mb-1">
                    <div className="flex items-center gap-1">
                      <Globe className="w-3 h-3 text-sky-400" />
                      <span>OpenRouter Cloud Catalog ({filteredOpenRouter.length})</span>
                    </div>
                    {catalogLoading && <span className="text-[9px] text-gray-500 animate-pulse">Loading 400+...</span>}
                  </div>
                  <div className="space-y-0.5">
                    {filteredOpenRouter.length === 0 ? (
                      <div className="px-2 py-2 text-center text-xs text-gray-500 font-mono">No matching models found. Paste ID above.</div>
                    ) : (
                      filteredOpenRouter.slice(0, 100).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectModel(m.id, 'openrouter')}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                            activeModel?.model === m.id
                              ? 'bg-sky-500/10 text-sky-300 font-medium border border-sky-500/20'
                              : 'hover:bg-[#181c2b] text-gray-300'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <div className="font-mono text-xs font-medium">{m.name}</div>
                            <div className="text-[10px] text-gray-500 font-mono truncate">{m.id}</div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] font-mono font-bold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">
                              CLOUD
                            </span>
                            {activeModel?.model === m.id && (
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400 shrink-0" />
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* 4. OpenAI Native Section */}
                <div>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-teal-400 font-mono flex items-center justify-between border-b border-card-border/40 pb-1 mb-1">
                    <div className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-teal-400" />
                      <span>OpenAI (Native) ({filteredOpenAI.length})</span>
                    </div>
                    {catalogLoading && <span className="text-[9px] text-gray-500 animate-pulse">Loading...</span>}
                  </div>
                  <div className="space-y-0.5">
                    {filteredOpenAI.length === 0 ? (
                      <div className="px-2 py-2 text-center text-xs text-gray-500 font-mono">No models. Set OPENAI_API_KEY to unlock.</div>
                    ) : (
                      filteredOpenAI.slice(0, 60).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectModel(m.id, 'openai')}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                            activeModel?.model === m.id
                              ? 'bg-teal-500/10 text-teal-300 font-medium border border-teal-500/20'
                              : 'hover:bg-[#181c2b] text-gray-300'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <div className="font-mono text-xs font-medium">{m.name}</div>
                            <div className="text-[10px] text-gray-500 font-mono truncate">{m.id}</div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] font-mono font-bold text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/20">
                              GPT
                            </span>
                            {activeModel?.model === m.id && (
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-sm shadow-teal-400 shrink-0" />
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* 5. Anthropic Native Section */}
                <div>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-orange-400 font-mono flex items-center justify-between border-b border-card-border/40 pb-1 mb-1">
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-orange-400" />
                      <span>Anthropic Claude (Native) ({filteredAnthropic.length})</span>
                    </div>
                    {catalogLoading && <span className="text-[9px] text-gray-500 animate-pulse">Loading...</span>}
                  </div>
                  <div className="space-y-0.5">
                    {filteredAnthropic.length === 0 ? (
                      <div className="px-2 py-2 text-center text-xs text-gray-500 font-mono">No models. Set ANTHROPIC_API_KEY to unlock.</div>
                    ) : (
                      filteredAnthropic.slice(0, 30).map((m) => (
                        <button
                          key={m.id}
                          onClick={() => handleSelectModel(m.id, 'anthropic')}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                            activeModel?.model === m.id
                              ? 'bg-orange-500/10 text-orange-300 font-medium border border-orange-500/20'
                              : 'hover:bg-[#181c2b] text-gray-300'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <div className="font-mono text-xs font-medium">{m.name}</div>
                            <div className="text-[10px] text-gray-500 font-mono truncate">{m.id}</div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] font-mono font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                              CLAUDE
                            </span>
                            {activeModel?.model === m.id && (
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shadow-sm shadow-orange-400 shrink-0" />
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Controls: New Chat */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onNewSession}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-medium text-xs shadow-sm shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>
    </header>
  );
}
