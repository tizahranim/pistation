import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Cpu,
  Zap,
  HardDrive,
  Flame,
  Search,
  RefreshCw,
  Play,
  Pause,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Thermometer,
  Gauge,
  Sparkles,
  ShieldAlert,
  Server,
  X,
  SlidersHorizontal,
  ChevronDown,
  MessageSquare,
  Send,
  Loader2,
  Terminal,
  Bot,
  Minimize2,
  Maximize2,
  FolderOpen,
  Power,
  Lock
} from 'lucide-react';
import DriveExplorerModal from './DriveExplorerModal';

export default function ResourceMonitor({ agents = [], activeModel }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(2000); // 2s
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // 'all' | 'ai' | 'high_mem' | 'high_cpu'
  const [sortField, setSortField] = useState('memory_mb'); // 'memory_mb' | 'cpu_percent' | 'pid' | 'name'
  const [sortAsc, setSortAsc] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);
  const [isUnloadingVram, setIsUnloadingVram] = useState(false);
  const [killConfirmModal, setKillConfirmModal] = useState(null); // { pid, name, signal }
  const [exploringDrive, setExploringDrive] = useState(null);
  const [ejectingDev, setEjectingDev] = useState(null);

  const handleEjectDrive = async (drive) => {
    if (!drive?.device) return;
    setEjectingDev(drive.device);
    try {
      const res = await fetch('/api/storage/eject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device: drive.device })
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.detail || resData.message || 'Eject failed');
      }
      setActionNotice(`⚡ ${drive.name || drive.short_name || 'USB Drive'} safely ejected! Ready to unplug.`);
      setTimeout(() => setActionNotice(null), 5000);
    } catch (err) {
      setActionNotice(`❌ Eject failed: ${err.message}`);
      setTimeout(() => setActionNotice(null), 5000);
    } finally {
      setEjectingDev(null);
    }
  };

  // Resource Copilot Pop-up Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id || 'agent-lead');
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'init',
      role: 'assistant',
      content: 'Hello! I am your DevOps & Hardware Resource Copilot. I have live access to your 28 CPU cores, 32GB RAM, Dual RTX 5070 GPUs, VRAM, and all running processes. Ask me to diagnose bottlenecks, free GPU memory, or kill any runaway process for you!'
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const chatEndRef = useRef(null);

  const timerRef = useRef(null);

  const fetchResources = async () => {
    try {
      const res = await fetch('/api/telemetry/resources');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch system telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isLive) {
      timerRef.current = setInterval(fetchResources, refreshInterval);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isLive, refreshInterval]);

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatStreaming, isChatOpen]);

  const handleKillProcess = async (pid, name, sig = 'SIGTERM') => {
    try {
      const res = await fetch('/api/telemetry/processes/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid, signal: sig })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setActionNotice({ type: 'success', text: result.message });
        fetchResources();
      } else {
        setActionNotice({ type: 'error', text: result.detail || result.message || 'Termination failed' });
      }
    } catch (err) {
      setActionNotice({ type: 'error', text: `Failed to terminate PID ${pid}: ${err.message}` });
    } finally {
      setKillConfirmModal(null);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleUnloadVram = async (modelName = null) => {
    setIsUnloadingVram(true);
    try {
      const res = await fetch('/api/telemetry/ollama/unload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: modelName })
      });
      const result = await res.json();
      if (res.ok) {
        setActionNotice({ type: 'success', text: result.message || 'VRAM successfully freed!' });
        fetchResources();
      } else {
        setActionNotice({ type: 'error', text: result.detail || 'Failed to unload models' });
      }
    } catch (err) {
      setActionNotice({ type: 'error', text: `VRAM unload error: ${err.message}` });
    } finally {
      setIsUnloadingVram(false);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  // Chat with Resource Copilot
  const handleSendChatMessage = async (presetText = null) => {
    const textToSend = presetText || chatInput;
    if (!textToSend.trim() || isChatStreaming) return;

    const userMsg = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: textToSend.trim()
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!presetText) setChatInput('');
    setIsChatStreaming(true);

    const tempAsstId = `asst-${Date.now()}`;
    const initialAsst = {
      id: tempAsstId,
      role: 'assistant',
      content: '',
      actions: []
    };

    setChatMessages(prev => [...prev, initialAsst]);

    try {
      const history = chatMessages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/telemetry/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend.trim(),
          agent_id: selectedAgentId,
          model_id: activeModel?.model,
          model_provider: activeModel?.provider,
          history
        })
      });

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let hadAction = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'token') {
                setChatMessages(prev => prev.map(m =>
                  m.id === tempAsstId ? { ...m, content: m.content + event.content } : m
                ));
              } else if (event.type === 'action') {
                hadAction = true;
                setChatMessages(prev => prev.map(m =>
                  m.id === tempAsstId ? { ...m, actions: [...(m.actions || []), event] } : m
                ));
              }
            } catch (e) {}
          }
        }
      }

      if (hadAction) {
        // Refresh telemetry immediately if action was triggered
        fetchResources();
      }
    } catch (err) {
      setChatMessages(prev => prev.map(m =>
        m.id === tempAsstId ? { ...m, content: `⚠️ Error: ${err.message}` } : m
      ));
    } finally {
      setIsChatStreaming(false);
    }
  };

  // Filter & Sort processes
  const processes = data?.processes || [];
  const filteredProcesses = processes.filter(p => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.cmdline.toLowerCase().includes(q) ||
      String(p.pid).includes(q) ||
      p.username.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (selectedFilter === 'ai') return p.is_ai;
    if (selectedFilter === 'high_mem') return p.memory_mb > 200;
    if (selectedFilter === 'high_cpu') return p.cpu_percent > 1.0;
    return true;
  });

  filteredProcesses.sort((a, b) => {
    let vA = a[sortField];
    let vB = b[sortField];
    if (typeof vA === 'string') {
      vA = vA.toLowerCase();
      vB = vB.toLowerCase();
    }
    if (vA < vB) return sortAsc ? -1 : 1;
    if (vA > vB) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const cpu = data?.cpu || { percent: 0, per_cpu: [], logical_cores: 0, load_avg: [0, 0, 0] };
  const ram = data?.ram || { total_mb: 0, used_mb: 0, percent: 0, available_mb: 0, swap_percent: 0 };
  const gpus = data?.gpus || [];
  const disk = data?.disk || { total_gb: 0, used_gb: 0, percent: 0 };
  const ollamaLoaded = data?.ollama_loaded || [];
  const activeAgent = agents.find(a => a.id === selectedAgentId) || agents[0];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0d14] text-gray-100 overflow-hidden font-sans select-none relative">
      
      {/* Top Header & Control Toolbar */}
      <div className="px-6 py-4 border-b border-card-border bg-[#0d101a] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-indigo-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-100 tracking-tight flex items-center gap-2">
                <span>System & Hardware Resources</span>
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live Telemetry
                </span>
              </h1>
              <p className="text-xs text-gray-400">
                Real-time monitoring of CPU, RAM, Dual GPU RTX 5070 VRAM, and process lifecycle control.
              </p>
            </div>
          </div>
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-3">
          {/* Action Notice Toast */}
          {actionNotice && (
            <div className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1 ${
              actionNotice.type === 'success' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/15 text-red-300 border border-red-500/30'
            }`}>
              {actionNotice.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              <span>{actionNotice.text}</span>
            </div>
          )}

          {/* Pop-up Resource Chat Toggle Button */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold font-mono transition-all shadow-sm ${
              isChatOpen
                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-200'
                : 'bg-[#181c2c] hover:bg-[#22283e] border-card-border text-indigo-300'
            }`}
            title="Chat with DevOps Resource Copilot"
          >
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            <span>Resource Copilot</span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse ml-0.5" />
          </button>

          {/* Quick Free VRAM Button */}
          <button
            onClick={() => handleUnloadVram()}
            disabled={isUnloadingVram}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold font-mono transition-all disabled:opacity-50 shadow-sm"
            title="Free GPU memory by unloading all active Ollama models"
          >
            <Flame className={`w-3.5 h-3.5 text-amber-400 ${isUnloadingVram ? 'animate-bounce' : ''}`} />
            <span>{isUnloadingVram ? 'Freeing VRAM...' : 'Free GPU VRAM'}</span>
          </button>

          {/* Polling Rate Selector */}
          <div className="flex items-center bg-[#151928] border border-card-border rounded-xl p-0.5 text-xs font-mono">
            <button
              onClick={() => setIsLive(!isLive)}
              className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                isLive ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {isLive ? <Play className="w-3 h-3 fill-current" /> : <Pause className="w-3 h-3" />}
              <span>{isLive ? 'Live' : 'Paused'}</span>
            </button>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              disabled={!isLive}
              className="bg-transparent text-gray-300 px-2 py-1 text-xs focus:outline-none cursor-pointer"
            >
              <option value={1000}>1.0s</option>
              <option value={2000}>2.0s</option>
              <option value={5000}>5.0s</option>
            </select>
          </div>

          {/* Manual Refresh Button */}
          <button
            onClick={fetchResources}
            className="p-2 rounded-xl bg-[#151928] hover:bg-[#1d2236] border border-card-border text-gray-300 hover:text-emerald-400 transition-colors"
            title="Refresh now"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Container: Split with Chat if Open */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left / Main: Hardware Metrics & Process Table */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* 1. Top Hardware Telemetry Gauges Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* CPU Card */}
            <div className="p-4 rounded-2xl bg-[#0f121d] border border-card-border space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-gray-200">Processor (CPU)</span>
                    <div className="text-[10px] text-gray-500 font-mono">{cpu.logical_cores} Cores ({cpu.physical_cores || cpu.logical_cores} Phys)</div>
                  </div>
                </div>
                <span className={`text-sm font-bold font-mono ${
                  cpu.percent > 80 ? 'text-red-400' : cpu.percent > 50 ? 'text-amber-400' : 'text-indigo-400'
                }`}>
                  {cpu.percent}%
                </span>
              </div>

              {/* Overall Bar */}
              <div className="w-full bg-[#161a29] h-2.5 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, cpu.percent))}%` }}
                />
              </div>

              {/* Mini Per-Core Matrix */}
              <div className="space-y-1">
                <div className="text-[9px] uppercase tracking-wider text-gray-500 font-mono flex items-center justify-between">
                  <span>Core Load Grid</span>
                  <span>Avg: {cpu.load_avg?.join(' • ')}</span>
                </div>
                <div className="grid grid-cols-7 gap-1 pt-0.5">
                  {(cpu.per_cpu || []).slice(0, 28).map((pct, idx) => (
                    <div
                      key={idx}
                      className="h-3 rounded-sm bg-[#161a29] overflow-hidden relative group"
                      title={`Core ${idx}: ${pct}%`}
                    >
                      <div
                        className={`h-full transition-all duration-200 ${
                          pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-400' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RAM / System Memory Card */}
            <div className="p-4 rounded-2xl bg-[#0f121d] border border-card-border space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-gray-200">System RAM</span>
                    <div className="text-[10px] text-gray-500 font-mono">{(ram.total_mb / 1024).toFixed(1)} GB Total</div>
                  </div>
                </div>
                <span className={`text-sm font-bold font-mono ${
                  ram.percent > 85 ? 'text-red-400' : ram.percent > 65 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  {ram.percent}%
                </span>
              </div>

              <div className="w-full bg-[#161a29] h-2.5 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, ram.percent))}%` }}
                />
              </div>

              <div className="space-y-1 text-[11px] font-mono">
                <div className="flex items-center justify-between text-gray-400">
                  <span>Used:</span>
                  <span className="text-gray-200 font-semibold">{(ram.used_mb / 1024).toFixed(1)} GB</span>
                </div>
                <div className="flex items-center justify-between text-gray-400">
                  <span>Available:</span>
                  <span className="text-emerald-300 font-semibold">{(ram.available_mb / 1024).toFixed(1)} GB</span>
                </div>
                <div className="flex items-center justify-between text-gray-500 text-[10px] pt-1 border-t border-white/5">
                  <span>Swap Usage:</span>
                  <span>{ram.swap_percent}% ({(ram.swap_used_mb / 1024).toFixed(1)} GB)</span>
                </div>
              </div>
            </div>

            {/* GPU 0 VRAM Card */}
            {gpus.length > 0 && (
              <div className="p-4 rounded-2xl bg-[#0f121d] border border-card-border space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="truncate max-w-[130px]">
                      <span className="font-bold text-xs text-gray-200">GPU 0: VRAM</span>
                      <div className="text-[10px] text-gray-400 font-mono truncate">{gpus[0].name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold font-mono ${
                      gpus[0].vram_percent > 85 ? 'text-red-400' : 'text-purple-400'
                    }`}>
                      {gpus[0].vram_percent}%
                    </span>
                    <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1 justify-end">
                      <Thermometer className="w-2.5 h-2.5 text-amber-400" />
                      <span>{gpus[0].temperature_c}°C</span>
                    </div>
                  </div>
                </div>

                <div className="w-full bg-[#161a29] h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, gpus[0].vram_percent))}%` }}
                  />
                </div>

                <div className="space-y-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>VRAM Used:</span>
                    <span className="text-purple-300 font-semibold">{(gpus[0].vram_used_mb / 1024).toFixed(1)} / {(gpus[0].vram_total_mb / 1024).toFixed(1)} GB</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>GPU Compute Core:</span>
                    <span className="text-emerald-300 font-semibold">{gpus[0].gpu_util_percent}%</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500 text-[10px] pt-1 border-t border-white/5">
                    <span>Power Draw:</span>
                    <span>{gpus[0].power_w} W</span>
                  </div>
                </div>
              </div>
            )}

            {/* GPU 1 VRAM Card */}
            {gpus.length > 1 && (
              <div className="p-4 rounded-2xl bg-[#0f121d] border border-card-border space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="truncate max-w-[130px]">
                      <span className="font-bold text-xs text-gray-200">GPU 1: VRAM</span>
                      <div className="text-[10px] text-gray-400 font-mono truncate">{gpus[1].name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold font-mono ${
                      gpus[1].vram_percent > 85 ? 'text-red-400' : 'text-pink-400'
                    }`}>
                      {gpus[1].vram_percent}%
                    </span>
                    <div className="text-[10px] text-gray-500 font-mono flex items-center gap-1 justify-end">
                      <Thermometer className="w-2.5 h-2.5 text-amber-400" />
                      <span>{gpus[1].temperature_c}°C</span>
                    </div>
                  </div>
                </div>

                <div className="w-full bg-[#161a29] h-2.5 rounded-full overflow-hidden border border-white/5">
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, gpus[1].vram_percent))}%` }}
                  />
                </div>

                <div className="space-y-1 text-[11px] font-mono">
                  <div className="flex items-center justify-between text-gray-400">
                    <span>VRAM Used:</span>
                    <span className="text-pink-300 font-semibold">{(gpus[1].vram_used_mb / 1024).toFixed(1)} / {(gpus[1].vram_total_mb / 1024).toFixed(1)} GB</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-400">
                    <span>GPU Compute Core:</span>
                    <span className="text-emerald-300 font-semibold">{gpus[1].gpu_util_percent}%</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-500 text-[10px] pt-1 border-t border-white/5">
                    <span>Power Draw:</span>
                    <span>{gpus[1].power_w} W</span>
                  </div>
                </div>
              </div>
            )}

            {/* Storage Drives & Partitions Matrix */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 p-4 rounded-2xl bg-[#0f121d] border border-card-border space-y-3">
              <div className="flex items-center justify-between border-b border-card-border/60 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-gray-100 uppercase tracking-wider font-mono">
                      Physical Storage Drives & Partitions ({data?.disks?.length || 2})
                    </span>
                    <div className="text-[10px] text-gray-500 font-mono">Real-time NVMe & SATA SSD Telemetry</div>
                  </div>
                </div>
                <span className="text-[11px] text-cyan-300 font-mono font-bold">
                  {disk.free_gb} GB Free on Linux Host
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(data?.disks || [
                  {
                    id: 'primary_disk',
                    name: 'Primary System Drive',
                    short_name: 'System Drive',
                    device: 'local',
                    mount: '/',
                    fs_type: '—',
                    type: 'System SSD',
                    role: 'Operating System & Workspace',
                    total_gb: 0,
                    used_gb: 0,
                    free_gb: 0,
                    percent: 0,
                    status: 'Loading telemetry...'
                  }
                ]).map((d, idx) => {
                  const isUsb = d.is_usb;
                  return (
                    <div
                      key={d.id || idx}
                      className={`p-3 rounded-xl bg-[#141829] border space-y-2 transition-all ${
                        isUsb
                          ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-[#141829] shadow-amber-500/10 shadow-lg'
                          : 'border-card-border'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate">
                          <HardDrive className={`w-4 h-4 shrink-0 ${
                            isUsb ? 'text-amber-400 animate-pulse' : 'text-cyan-400'
                          }`} />
                          <div className="truncate">
                            <div className="font-bold text-xs text-gray-200 truncate">{d.name}</div>
                            <div className="text-[10px] text-gray-500 font-mono truncate">{d.device} • {d.mount} ({d.fs_type?.toUpperCase()})</div>
                          </div>
                        </div>
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border shrink-0 ${
                          isUsb
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        }`}>
                          {d.status || `${d.percent}% Used`}
                        </span>
                      </div>

                      <div className="w-full bg-[#090b12] h-2 rounded-full overflow-hidden border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isUsb
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                              : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, d.percent ?? 20))}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                        <span>Used: <strong className="text-gray-200">{d.used_gb} GB</strong> ({d.percent}%)</span>
                        <span>Free: <strong className={isUsb ? 'text-amber-300' : 'text-cyan-300'}>{d.free_gb} GB</strong> / {d.total_gb} GB</span>
                      </div>

                      {/* Action Buttons: Explore & Eject */}
                      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] font-mono">
                        <button
                          type="button"
                          onClick={() => setExploringDrive(d)}
                          className="px-2 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 text-gray-300 hover:text-cyan-300 border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Explore files & folders on this drive"
                        >
                          <FolderOpen className="w-2.5 h-2.5 text-cyan-400" />
                          <span>Explore</span>
                        </button>

                        {isUsb ? (
                          <button
                            type="button"
                            onClick={() => handleEjectDrive(d)}
                            disabled={ejectingDev === d.device}
                            className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Safely unmount and power off USB drive"
                          >
                            <Power className={`w-2.5 h-2.5 text-amber-400 ${ejectingDev === d.device ? 'animate-spin' : ''}`} />
                            <span>{ejectingDev === d.device ? 'Ejecting...' : 'Eject'}</span>
                          </button>
                        ) : (
                          <span className="text-[9px] text-gray-500 flex items-center gap-1" title="Primary OS partition">
                            <Lock className="w-2.5 h-2.5 text-gray-600" />
                            <span>OS Drive</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* 2. Active LLM Models Loaded in VRAM Section */}
          {ollamaLoaded.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#0e121f] border border-indigo-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-xs text-gray-100 uppercase tracking-wider font-mono">
                    Active Models Loaded in GPU VRAM ({ollamaLoaded.length})
                  </span>
                </div>
                <span className="text-[11px] text-indigo-300 font-mono">
                  Total VRAM Allocated: {(ollamaLoaded.reduce((acc, m) => acc + (m.size_vram_mb || 0), 0) / 1024).toFixed(1)} GB
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {ollamaLoaded.map((m, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#141828] border border-card-border flex items-center justify-between">
                    <div className="truncate mr-2">
                      <div className="font-bold text-xs text-indigo-200 truncate">{m.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">
                        {(m.size_vram_mb / 1024).toFixed(1)} GB VRAM • {(m.size_total_mb / 1024).toFixed(1)} GB Weights
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnloadVram(m.name)}
                      className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-mono font-semibold transition-all shrink-0"
                      title="Unload this model from VRAM"
                    >
                      Unload
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Live Running Processes & Termination Manager */}
          <div className="rounded-2xl border border-card-border bg-[#0f121d] overflow-hidden space-y-4 p-5 shadow-xl">
            
            {/* Table Header Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-gray-100 uppercase tracking-wider font-mono flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <span>Running Processes & Tasks ({filteredProcesses.length})</span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Inspect memory consumption, CPU load, and terminate runaway background processes.
                </p>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Category Filter Pills */}
                <div className="flex items-center bg-[#151928] border border-card-border rounded-xl p-0.5 text-xs font-mono">
                  <button
                    onClick={() => setSelectedFilter('all')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      selectedFilter === 'all' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    All ({processes.length})
                  </button>
                  <button
                    onClick={() => setSelectedFilter('ai')}
                    className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                      selectedFilter === 'ai' ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>AI & LLM ({processes.filter(p => p.is_ai).length})</span>
                  </button>
                  <button
                    onClick={() => setSelectedFilter('high_mem')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      selectedFilter === 'high_mem' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    &gt;200MB ({processes.filter(p => p.memory_mb > 200).length})
                  </button>
                  <button
                    onClick={() => setSelectedFilter('high_cpu')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      selectedFilter === 'high_cpu' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    Active CPU ({processes.filter(p => p.cpu_percent > 1.0).length})
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter PID or name..."
                    className="bg-[#151928] border border-card-border rounded-xl pl-8 pr-3 py-1 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50 font-mono w-48"
                  />
                </div>
              </div>
            </div>

            {/* Process Table */}
            <div className="overflow-x-auto rounded-xl border border-card-border/60 bg-[#0c0e18]">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-card-border/80 bg-[#121624] text-gray-400 select-none">
                    <th onClick={() => handleSort('pid')} className="py-2.5 px-3 cursor-pointer hover:text-gray-200">
                      <div className="flex items-center gap-1">
                        <span>PID</span>
                        {sortField === 'pid' && <span>{sortAsc ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('name')} className="py-2.5 px-3 cursor-pointer hover:text-gray-200">
                      <div className="flex items-center gap-1">
                        <span>PROCESS & COMMAND</span>
                        {sortField === 'name' && <span>{sortAsc ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-2.5 px-3">USER</th>
                    <th onClick={() => handleSort('cpu_percent')} className="py-2.5 px-3 cursor-pointer hover:text-gray-200">
                      <div className="flex items-center gap-1">
                        <span>CPU %</span>
                        {sortField === 'cpu_percent' && <span>{sortAsc ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th onClick={() => handleSort('memory_mb')} className="py-2.5 px-3 cursor-pointer hover:text-gray-200">
                      <div className="flex items-center gap-1">
                        <span>MEMORY</span>
                        {sortField === 'memory_mb' && <span>{sortAsc ? '▲' : '▼'}</span>}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border/30">
                  {filteredProcesses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500 font-mono">
                        No matching processes found.
                      </td>
                    </tr>
                  ) : (
                    filteredProcesses.map((p) => (
                      <tr key={p.pid} className="hover:bg-[#151928] transition-colors group">
                        <td className="py-2 px-3 text-emerald-400 font-bold">{p.pid}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-200">{p.name}</span>
                            {p.is_ai && (
                              <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-bold">
                                AI / Engine
                              </span>
                            )}
                            <span className="text-[10px] text-gray-500 truncate max-w-[280px]">
                              {p.cmdline || p.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-gray-400">{p.username}</td>
                        <td className="py-2 px-3">
                          <span className={`font-bold ${
                            p.cpu_percent > 50 ? 'text-red-400' : p.cpu_percent > 10 ? 'text-amber-400' : 'text-gray-300'
                          }`}>
                            {p.cpu_percent}%
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-bold text-gray-200">{p.memory_mb} MB</span>
                          <span className="text-[10px] text-gray-500 ml-1">({p.memory_percent}%)</span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setKillConfirmModal({ pid: p.pid, name: p.name, signal: 'SIGTERM' })}
                              className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] transition-colors"
                              title="Gracefully terminate process (SIGTERM)"
                            >
                              End Task
                            </button>
                            <button
                              onClick={() => setKillConfirmModal({ pid: p.pid, name: p.name, signal: 'SIGKILL' })}
                              className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] transition-colors"
                              title="Force kill process (SIGKILL)"
                            >
                              Kill -9
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Pane: Pop-up / Docked DevOps Resource Copilot Chat */}
        {isChatOpen && (
          <div className="w-[410px] border-l border-card-border bg-[#0d0f17] flex flex-col shrink-0 overflow-hidden animate-in slide-in-from-right-2 duration-150">
            
            {/* Copilot Header */}
            <div className="p-3 border-b border-card-border flex items-center justify-between bg-[#0e111a]">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-gray-200">
                    <span>RESOURCE COPILOT</span>
                  </div>
                  <div className="text-[9px] text-gray-400 font-mono flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Grounded in live server telemetry</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="bg-[#151824] border border-card-border rounded px-2 py-0.5 text-[10px] text-gray-300 font-mono focus:outline-none max-w-[120px] truncate"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.avatar} {a.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setChatMessages([
                    {
                      id: 'init',
                      role: 'assistant',
                      content: 'Chat cleared. How can I assist you with diagnosing hardware or managing processes?'
                    }
                  ])}
                  className="p-1 rounded hover:bg-[#1f2436] text-gray-500 hover:text-gray-300 transition-colors"
                  title="Clear chat history"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-1 rounded hover:bg-[#1f2436] text-gray-500 hover:text-gray-300 transition-colors"
                  title="Close Copilot"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Action Preset Chips */}
            <div className="px-3 py-2 border-b border-card-border/60 bg-[#101422] flex flex-wrap gap-1.5 shrink-0">
              <button
                onClick={() => handleSendChatMessage('Free GPU VRAM by unloading all idle Ollama models')}
                disabled={isChatStreaming}
                className="px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-mono transition-colors disabled:opacity-50"
              >
                ⚡ Free VRAM
              </button>
              <button
                onClick={() => handleSendChatMessage('Which running process is consuming the most memory and CPU right now?')}
                disabled={isChatStreaming}
                className="px-2 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono transition-colors disabled:opacity-50"
              >
                🔍 Top Consumers
              </button>
              <button
                onClick={() => handleSendChatMessage('Perform a quick health diagnosis on CPU load, RAM pressure, and dual RTX 5070 thermals')}
                disabled={isChatStreaming}
                className="px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono transition-colors disabled:opacity-50"
              >
                📊 Hardware Check
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 font-sans text-xs">
              {chatMessages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col space-y-1.5 ${
                    m.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono">
                    <span>{m.role === 'user' ? 'You' : `${activeAgent?.avatar || '🤖'} ${activeAgent?.name || 'DevOps Copilot'}`}</span>
                  </div>

                  <div
                    className={`p-3 rounded-xl max-w-[90%] leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-[#151928] border border-card-border text-gray-200 shadow-sm'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>

                    {/* Action Execution Badges */}
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-card-border/60 space-y-1.5">
                        {m.actions.map((act, actIdx) => (
                          <div
                            key={actIdx}
                            className={`p-2 rounded-lg text-[10px] font-mono border ${
                              act.status === 'success'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : 'bg-red-500/10 text-red-300 border-red-500/30'
                            }`}
                          >
                            <div className="font-bold flex items-center gap-1">
                              {act.status === 'success' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <AlertTriangle className="w-3 h-3 text-red-400" />}
                              <span className="uppercase">Action: {act.action}</span>
                            </div>
                            <div className="mt-0.5 text-gray-300">{act.details}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isChatStreaming && (
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono p-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing system telemetry & executing...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChatMessage();
              }}
              className="p-3 border-t border-card-border bg-[#0e111a] flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask or command: e.g. Kill PID 1234..."
                disabled={isChatStreaming}
                className="flex-1 bg-[#151928] border border-card-border rounded-xl px-3 py-2 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500/50 font-mono"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatStreaming}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all shadow-md shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>

          </div>
        )}

      </div>

      {/* Kill Process Confirmation Modal */}
      {killConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#10131e] border border-red-500/40 rounded-2xl p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/15 border border-red-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-gray-100">
                  Confirm {killConfirmModal.signal === 'SIGKILL' ? 'Force Kill' : 'Terminate'}
                </h3>
                <p className="text-xs text-gray-400 font-mono">
                  Target PID: {killConfirmModal.pid} ({killConfirmModal.name})
                </p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed font-sans">
              Are you sure you want to send <strong className="text-red-400 font-mono">{killConfirmModal.signal}</strong> to process <strong>{killConfirmModal.name}</strong> (PID {killConfirmModal.pid})?
              {killConfirmModal.signal === 'SIGKILL' ? ' This will immediately terminate execution without saving state.' : ''}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-card-border">
              <button
                onClick={() => setKillConfirmModal(null)}
                className="px-3.5 py-1.5 rounded-xl bg-[#161a28] hover:bg-[#1e2336] text-gray-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleKillProcess(killConfirmModal.pid, killConfirmModal.name, killConfirmModal.signal)}
                className={`px-4 py-1.5 rounded-xl text-white text-xs font-bold transition-all shadow-md ${
                  killConfirmModal.signal === 'SIGKILL'
                    ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                    : 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                }`}
              >
                Confirm {killConfirmModal.signal}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drive Explorer Modal */}
      {exploringDrive && (
        <DriveExplorerModal
          drive={exploringDrive}
          onClose={() => setExploringDrive(null)}
        />
      )}

    </div>
  );
}
