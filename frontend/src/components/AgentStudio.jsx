import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit3, 
  Bot, 
  Cpu, 
  Sparkles, 
  Activity, 
  Sliders, 
  Check, 
  X,
  Play,
  Terminal,
  Zap,
  Search,
  Globe,
  ClipboardPaste
} from 'lucide-react';

export default function AgentStudio({ 
  agents = [], 
  models = {}, 
  onRefreshAgents,
  onSelectAgentForChat 
}) {
  const [showModal, setShowModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openRouterCatalog, setOpenRouterCatalog] = useState([]);
  const [openaiCatalog, setOpenaiCatalog] = useState([]);
  const [anthropicCatalog, setAnthropicCatalog] = useState([]);
  const [modelSearch, setModelSearch] = useState('');
  const [customModelInput, setCustomModelInput] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [role, setRole] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [modelId, setModelId] = useState('qwen3.8:27b');
  const [modelProvider, setModelProvider] = useState('ollama');
  const [temperature, setTemperature] = useState(0.2);
  const [thinkingLevel, setThinkingLevel] = useState('medium');

  const emojiList = ['🤖', '⚡', '📐', '🛡️', '🔬', '💡', '🎨', '🚀', '🧠', '⚙️', '🔍', '📊'];

  // Fetch full OpenRouter catalog
  useEffect(() => {
    fetch('/api/models/openrouter/catalog')
      .then(res => res.json())
      .then(data => {
        if (data.models && Array.isArray(data.models)) {
          setOpenRouterCatalog(data.models);
        }
      })
      .catch(err => console.error('Failed to load OpenRouter catalog:', err));

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
      .catch(err => console.error('Failed to load Anthropic catalog:', err));
  }, []);

  // Fetch activity logs periodically
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch('/api/agents/activity/logs?limit=20');
        const data = await res.json();
        setActivityLogs(data);
      } catch (e) {
        console.error('Failed to load activity logs:', e);
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenCreate = () => {
    setEditingAgent(null);
    setName('');
    setAvatar('🤖');
    setRole('');
    setSystemPrompt('');
    setModelId(models?.ollama_models?.[0]?.id || 'qwen3.8:27b');
    setModelProvider('ollama');
    setTemperature(0.2);
    setThinkingLevel('medium');
    setModelSearch('');
    setCustomModelInput('');
    setShowModal(true);
  };

  const handleOpenEdit = (agent) => {
    setEditingAgent(agent);
    setName(agent.name);
    setAvatar(agent.avatar);
    setRole(agent.role);
    setSystemPrompt(agent.system_prompt);
    setModelId(agent.model_id);
    setModelProvider(agent.model_provider);
    setTemperature(agent.temperature);
    setThinkingLevel(agent.thinking_level);
    setModelSearch('');
    setCustomModelInput('');
    setShowModal(true);
  };

  const handleSelectModelOption = (id, provider) => {
    setModelId(id);
    setModelProvider(provider);
  };

  const handleApplyCustomModel = (e) => {
    e.preventDefault();
    const trimmed = customModelInput.trim();
    if (!trimmed) return;
    const provider = trimmed.includes('/') || trimmed.startsWith('~') ? 'openrouter'
      : trimmed.startsWith('claude') ? 'anthropic'
      : /^(gpt-|o1|o3|o4)/.test(trimmed) ? 'openai'
      : 'ollama';
    setModelId(trimmed);
    setModelProvider(provider);
    setCustomModelInput('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim() || !systemPrompt.trim()) return;

    setLoading(true);
    const payload = {
      name,
      avatar,
      role: role || 'AI Specialist',
      system_prompt: systemPrompt,
      model_provider: modelProvider,
      model_id: modelId,
      temperature: parseFloat(temperature),
      thinking_level: thinkingLevel,
      tools: ['read', 'bash', 'edit', 'write']
    };

    try {
      if (editingAgent) {
        await fetch(`/api/agents/${editingAgent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch('/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      setShowModal(false);
      onRefreshAgents?.();
    } catch (err) {
      console.error('Failed to save agent:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (agentId) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      try {
        await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
        onRefreshAgents?.();
      } catch (err) {
        console.error('Failed to delete agent:', err);
      }
    }
  };

  // Combine custom models from config with live 414 OpenRouter models
  const allOpenRouterList = [
    ...(models?.custom_models || []),
    ...openRouterCatalog.filter(cm => !(models?.custom_models || []).some(m => m.id === cm.id))
  ];

  const filteredOllama = (models?.ollama_models || []).filter(m =>
    m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
    m.id.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const filteredOpenRouter = allOpenRouterList.filter(m =>
    (m.name || '').toLowerCase().includes(modelSearch.toLowerCase()) ||
    (m.id || '').toLowerCase().includes(modelSearch.toLowerCase())
  );

  const filteredOpenAI = openaiCatalog.filter(m =>
    (m.name || '').toLowerCase().includes(modelSearch.toLowerCase()) ||
    (m.id || '').toLowerCase().includes(modelSearch.toLowerCase())
  );

  const filteredAnthropic = anthropicCatalog.filter(m =>
    (m.name || '').toLowerCase().includes(modelSearch.toLowerCase()) ||
    (m.id || '').toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="p-6 border-b border-card-border bg-[#0e1017] flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-gray-100">Agent Studio & Live Monitor</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Create custom autonomous agents with tailored system prompts, domain knowledge, and model assignments.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Agent</span>
        </button>
      </div>

      {/* Main Grid View */}
      <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Agent Cards Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 font-mono">
              Configured Agents ({agents.length})
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-xl border border-card-border bg-card/60 hover:bg-card p-4 transition-all flex flex-col justify-between space-y-3 group shadow-sm hover:border-emerald-500/30"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-card-border/60 border border-white/5 flex items-center justify-center text-lg shadow-sm">
                        {agent.avatar || '🤖'}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-100">{agent.name}</h4>
                        <span className="text-[11px] text-gray-400 font-mono">{agent.role}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEdit(agent)}
                        className="p-1.5 rounded-lg hover:bg-card-border/80 text-gray-400 hover:text-gray-200 transition-colors"
                        title="Edit Agent"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(agent.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete Agent"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 mt-2.5 line-clamp-2 leading-relaxed font-sans">
                    {agent.system_prompt}
                  </p>
                </div>

                {/* Card Footer: Model + Chat Trigger */}
                <div className="pt-2.5 border-t border-card-border/60 flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#161a26] border border-card-border text-[10px] text-gray-300 font-mono">
                    <Zap className="w-2.5 h-2.5 text-amber-400" />
                    <span className="truncate max-w-[120px] font-medium text-emerald-300">{agent.model_id}</span>
                    <span className="text-[9px] text-gray-500">({agent.model_provider})</span>
                  </div>

                  <button
                    onClick={() => onSelectAgentForChat(agent.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition-all"
                  >
                    <span>Chat</span>
                    <Play className="w-2.5 h-2.5 fill-current" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Live Agent Action Monitor */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 font-mono flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
              Agent Action Log
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-gray-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
                All Agents Idle
              </span>
              {activityLogs.length > 0 && (
                <button
                  onClick={async () => {
                    try {
                      await fetch('/api/agents/activity/logs', { method: 'DELETE' });
                      setActivityLogs([]);
                    } catch (e) {
                      console.error('Failed to clear logs:', e);
                    }
                  }}
                  className="p-1 hover:text-red-400 text-gray-500 rounded transition-colors"
                  title="Clear Log History"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-card-border bg-[#0b0c12] p-3 max-h-[500px] overflow-y-auto space-y-2 font-mono text-xs">
            {activityLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 space-y-1">
                <Terminal className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <div className="text-xs font-mono text-gray-400">All Agents in Standby</div>
                <div className="text-[11px] text-gray-600">No active background executions running.</div>
              </div>
            ) : (
              activityLogs.map((log) => (
                <div key={log.id} className="p-2.5 rounded-lg bg-[#121520] border border-card-border/50 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-indigo-300 flex items-center gap-1">
                      <span>{log.agent_name || 'Agent'}</span>
                    </span>
                    <span className="text-gray-500 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-[11px] text-gray-300 font-sans">{log.details}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit Agent Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0f121a] border border-card-border rounded-2xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-card-border">
              <h3 className="font-bold text-sm text-gray-100 flex items-center gap-2">
                <Bot className="w-4 h-4 text-emerald-400" />
                {editingAgent ? 'Edit Agent Profile' : 'Create New Agent'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Agent Name & Avatar */}
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3 space-y-1">
                  <label className="text-[11px] font-mono uppercase text-gray-400">Agent Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Database Architect"
                    className="w-full bg-[#151824] border border-card-border rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-emerald-500/50 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-gray-400">Avatar</label>
                  <select
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    className="w-full bg-[#151824] border border-card-border rounded-lg px-2 py-2 text-base text-gray-100 focus:outline-none"
                  >
                    {emojiList.map(e => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Role Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-gray-400">Role / Domain Specialty</label>
                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Code Review & Performance Optimization"
                  className="w-full bg-[#151824] border border-card-border rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* System Prompt */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-gray-400">System Instructions & Persona</label>
                <textarea
                  required
                  rows={4}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Define how this agent reasons, acts, critiques, and solves tasks..."
                  className="w-full bg-[#151824] border border-card-border rounded-lg p-3 text-xs text-gray-100 focus:outline-none focus:border-emerald-500/50 resize-none font-sans"
                />
              </div>

              {/* Model Assignment Section (with 400+ OpenRouter Search & Paste) */}
              <div className="space-y-2 pt-2 border-t border-card-border/60">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono uppercase text-gray-300 font-semibold flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    Assigned Model Engine
                  </label>
                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 truncate max-w-[200px]">
                    Active: {modelId} ({modelProvider})
                  </span>
                </div>

                {/* Model Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    placeholder="Search 400+ OpenRouter & Ollama models..."
                    className="w-full bg-[#141824] border border-card-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                {/* Quick Paste Custom Model */}
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <ClipboardPaste className="w-3 h-3 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customModelInput}
                      onChange={(e) => setCustomModelInput(e.target.value)}
                      placeholder="Paste exact model ID (e.g. meta-llama/llama-3.1-405b)"
                      className="w-full bg-[#121520] border border-card-border/80 rounded-lg pl-7 pr-2 py-1 text-[11px] text-gray-200 font-mono placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustomModel}
                    disabled={!customModelInput.trim()}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[11px] font-semibold transition-all"
                  >
                    Apply ID
                  </button>
                </div>

                {/* Scrollable Model Selection List */}
                <div className="max-h-40 overflow-y-auto space-y-2 border border-card-border/80 rounded-xl p-2 bg-[#0c0e15]">
                  {/* Ollama Models */}
                  {filteredOllama.length > 0 && (
                    <div>
                      <div className="text-[10px] font-mono uppercase text-emerald-400 font-semibold px-1.5 py-0.5">
                        Local Models (Ollama)
                      </div>
                      <div className="space-y-0.5 mt-0.5">
                        {filteredOllama.map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleSelectModelOption(m.id, 'ollama')}
                            className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                              modelId === m.id && modelProvider === 'ollama'
                                ? 'bg-emerald-500/20 text-emerald-200 font-semibold border border-emerald-500/30'
                                : 'hover:bg-card-border/50 text-gray-300'
                            }`}
                          >
                            <span className="font-mono text-xs">{m.name}</span>
                            {modelId === m.id && modelProvider === 'ollama' && (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* OpenRouter Models */}
                  <div>
                    <div className="text-[10px] font-mono uppercase text-indigo-400 font-semibold px-1.5 py-0.5 border-t border-card-border/50 pt-1.5 mt-1 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-indigo-400" />
                      <span>OpenRouter Catalog ({filteredOpenRouter.length} models)</span>
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {filteredOpenRouter.slice(0, 100).map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectModelOption(m.id, 'openrouter')}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                            modelId === m.id && modelProvider === 'openrouter'
                              ? 'bg-indigo-500/20 text-indigo-200 font-semibold border border-indigo-500/30'
                              : 'hover:bg-card-border/50 text-gray-300'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <span className="font-mono text-xs">{m.name}</span>
                            <span className="text-[10px] text-gray-500 ml-2 font-mono">{m.id}</span>
                          </div>
                          {modelId === m.id && modelProvider === 'openrouter' && (
                            <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* OpenAI Models */}
                  <div>
                    <div className="text-[10px] font-mono uppercase text-teal-400 font-semibold px-1.5 py-0.5 border-t border-card-border/50 pt-1.5 mt-1 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-teal-400" />
                      <span>OpenAI (Native) ({filteredOpenAI.length} models)</span>
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {filteredOpenAI.slice(0, 60).map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectModelOption(m.id, 'openai')}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                            modelId === m.id && modelProvider === 'openai'
                              ? 'bg-teal-500/20 text-teal-200 font-semibold border border-teal-500/30'
                              : 'hover:bg-card-border/50 text-gray-300'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <span className="font-mono text-xs">{m.name}</span>
                            <span className="text-[10px] text-gray-500 ml-2 font-mono">{m.id}</span>
                          </div>
                          {modelId === m.id && modelProvider === 'openai' && (
                            <Check className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Anthropic Models */}
                  <div>
                    <div className="text-[10px] font-mono uppercase text-orange-400 font-semibold px-1.5 py-0.5 border-t border-card-border/50 pt-1.5 mt-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-orange-400" />
                      <span>Anthropic Claude (Native) ({filteredAnthropic.length} models)</span>
                    </div>
                    <div className="space-y-0.5 mt-0.5">
                      {filteredAnthropic.slice(0, 30).map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleSelectModelOption(m.id, 'anthropic')}
                          className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                            modelId === m.id && modelProvider === 'anthropic'
                              ? 'bg-orange-500/20 text-orange-200 font-semibold border border-orange-500/30'
                              : 'hover:bg-card-border/50 text-gray-300'
                          }`}
                        >
                          <div className="truncate mr-2">
                            <span className="font-mono text-xs">{m.name}</span>
                            <span className="text-[10px] text-gray-500 ml-2 font-mono">{m.id}</span>
                          </div>
                          {modelId === m.id && modelProvider === 'anthropic' && (
                            <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Temperature & Thinking Level */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono uppercase text-gray-400">Thinking Level</label>
                  <select
                    value={thinkingLevel}
                    onChange={(e) => setThinkingLevel(e.target.value)}
                    className="w-full bg-[#151824] border border-card-border rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none"
                  >
                    <option value="off">Off</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium (Default)</option>
                    <option value="high">High (Deep Reasoning)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-gray-400">
                    <span>Temperature</span>
                    <span>{temperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="1.0"
                    step="0.05"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full accent-emerald-500 mt-2"
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-card-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-card-border/60 hover:bg-card-border text-gray-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-gray-950 font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all"
                >
                  {loading ? 'Saving...' : (editingAgent ? 'Save Changes' : 'Create Agent')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
