import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Cpu,
  Zap,
  Target,
  MessageSquare,
  FolderGit2,
  Users,
  Swords,
  Puzzle,
  BookOpen,
  BrainCircuit,
  Activity,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  Sun,
  Droplets,
  Wind,
  CheckSquare,
  Trash2,
  Send,
  Check,
  ChevronDown,
  HardDrive,
  FolderOpen,
  Power,
  Lock,
  Server,
  MemoryStick
} from 'lucide-react';
import DriveExplorerModal from './DriveExplorerModal';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Overview({
  setActiveTab,
  agents = [],
  activeAgentId,
  onSelectAgent,
  documents = [],
  sessions = [],
  models = { ollama_models: [], custom_models: [] },
  activeModel,
  telemetry,
  onNewSession,
  onDispatchPrompt
}) {
  const { t, isRTL, language } = useLanguage();
  // 1. Live Time State
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // 2. Weather State
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // 3. To-Do State
  const [todos, setTodos] = useState([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [newTodoPriority, setNewTodoPriority] = useState('medium');
  const [todoFilter, setTodoFilter] = useState('all'); // 'all', 'active', 'completed'

  // 4. Quick Prompt Bar & Selected Agent State (Default to Pi Lead Agent)
  const [quickPrompt, setQuickPrompt] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const agentDropdownRef = useRef(null);
  const quickInputRef = useRef(null);

  // 5. Data State & Drive Modal States
  const [finetuneJobs, setFinetuneJobs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [exploringDrive, setExploringDrive] = useState(null);
  const [ejectNotice, setEjectNotice] = useState(null);
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
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Eject failed');
      }
      setEjectNotice(`⚡ ${drive.name || drive.short_name || 'USB Drive'} safely ejected! Ready to unplug.`);
      setTimeout(() => setEjectNotice(null), 5000);
    } catch (err) {
      setEjectNotice(`❌ Eject failed: ${err.message}`);
      setTimeout(() => setEjectNotice(null), 5000);
    } finally {
      setEjectingDev(null);
    }
  };

  // Auto-focus the dispatch input whenever Overview mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      quickInputRef.current?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  // Sync selectedAgentId if activeAgentId updates externally
  useEffect(() => {
    if (activeAgentId && agents.some(a => a.id === activeAgentId)) setSelectedAgentId(activeAgentId);
  }, [activeAgentId, agents]);

  // Sync selectedAgentId to a real agent once the agent list loads
  useEffect(() => {
    if (agents.length > 0 && !agents.some(a => a.id === selectedAgentId)) {
      setSelectedAgentId(activeAgentId || agents[0].id);
    }
  }, [agents, activeAgentId, selectedAgentId]);

  // Click outside to close agent dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target)) {
        setAgentDropdownOpen(false);
      }
    };
    if (agentDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [agentDropdownOpen]);

  // Live Clock Tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Weather & Station Data with Live Real-time Sync
  const fetchAll = async () => {
    try {
      const [wRes, tRes, jobsRes, projRes, logsRes] = await Promise.all([
        fetch('/api/overview/weather').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/overview/todos').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/finetuning/jobs').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/projects').then(r => r.ok ? r.json() : []).catch(() => []),
        fetch('/api/agents/activity/logs?limit=6').then(r => r.ok ? r.json() : []).catch(() => [])
      ]);

      if (wRes) setWeather(wRes);
      setTodos(tRes || []);
      setFinetuneJobs(jobsRes || []);
      setProjects(projRes || []);
      setActivityLogs(logsRes || []);
    } catch (e) {
      console.error('Overview data fetch error:', e);
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const handleTodoUpdate = () => fetchAll();
    window.addEventListener('pi:todos_updated', handleTodoUpdate);
    const interval = setInterval(fetchAll, 3000); // 3s real-time background sync
    return () => {
      window.removeEventListener('pi:todos_updated', handleTodoUpdate);
      clearInterval(interval);
    };
  }, []);

  // Time & Greeting Helpers
  const hour = currentTime.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateString = currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  // To-Do Handlers
  const handleAddTodo = async (e) => {
    e.preventDefault();
    if (!newTodoText.trim()) return;

    try {
      const res = await fetch('/api/overview/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newTodoText.trim(), priority: newTodoPriority, category: 'general' })
      });
      if (res.ok) {
        const added = await res.json();
        setTodos(prev => [added, ...prev]);
        setNewTodoText('');
      }
    } catch (err) {
      console.error('Failed to add todo:', err);
    }
  };

  const handleToggleTodo = async (todo) => {
    const nextCompleted = !todo.completed;
    setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, completed: nextCompleted } : t));
    try {
      await fetch(`/api/overview/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: nextCompleted })
      });
    } catch (err) {
      console.error('Failed to toggle todo:', err);
    }
  };

  const handleDeleteTodo = async (todoId) => {
    setTodos(prev => prev.filter(t => t.id !== todoId));
    try {
      await fetch(`/api/overview/todos/${todoId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to delete todo:', err);
    }
  };

  const handleAddSuggestedTodo = async (text, priority = 'medium') => {
    try {
      const res = await fetch('/api/overview/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, priority, category: 'ai' })
      });
      if (res.ok) {
        const added = await res.json();
        setTodos(prev => [added, ...prev]);
      }
    } catch (err) {
      console.error('Failed to add suggested todo:', err);
    }
  };

  // Quick Prompt Dispatch Handler
  const handleQuickPromptSubmit = (e) => {
    e.preventDefault();
    if (!quickPrompt.trim()) return;
    const prompt = quickPrompt.trim();
    const targetAgentId = agents.some(a => a.id === selectedAgentId) ? selectedAgentId : (agents[0]?.id || null);
    setQuickPrompt('');
    if (onDispatchPrompt) {
      onDispatchPrompt(prompt, targetAgentId);
    } else {
      window.dispatchEvent(new CustomEvent('pi:quick_prompt', { detail: { prompt } }));
      if (targetAgentId && onSelectAgent) {
        onSelectAgent(targetAgentId);
      }
      if (onNewSession) onNewSession();
      setActiveTab('chat');
    }
  };

  const currentSelectedAgent = agents.find(a => a.id === selectedAgentId) || agents[0] || { name: 'Pi Lead Agent', avatar: '🤖', id: 'pi-lead' };

  const filteredTodos = todos.filter(t => {
    if (todoFilter === 'active') return !t.completed;
    if (todoFilter === 'completed') return t.completed;
    return true;
  });

  // Dynamically generate relevant station goals from real system & workspace state
  const dynamicGoals = useMemo(() => {
    const goals = [];

    // 1. Context from Fine-Tuning Jobs (Real fine-tuned models)
    const completedJobs = finetuneJobs.filter(j => j.status === 'trained' || j.status === 'completed');
    const draftJobs = finetuneJobs.filter(j => j.status !== 'trained' && j.status !== 'completed');

    if (completedJobs.length > 0) {
      const latestTrained = completedJobs[0];
      goals.push({
        text: `Evaluate ${latestTrained.target_identifier} in Chat Workspace`,
        pri: 'high'
      });
      goals.push({
        text: `Fine-tune next iteration: ${latestTrained.name.replace(/\s*v\d+$/i, '')} v2`,
        pri: 'medium'
      });
    } else if (draftJobs.length > 0) {
      goals.push({
        text: `Run Auto Fine-Tuning Wizard on ${draftJobs[0].name}`,
        pri: 'high'
      });
    } else {
      goals.push({
        text: 'Synthesize dataset & train first custom model with Unsloth QLoRA',
        pri: 'high'
      });
    }

    // 2. Context from Projects
    if (projects.length > 0) {
      const latestProj = projects[0];
      goals.push({
        text: `Review code & git diffs in "${latestProj.name}"`,
        pri: 'medium'
      });
    }

    // 3. Context from Chat Sessions
    if (sessions.length > 0) {
      const latestSession = sessions[0];
      const title = (latestSession.title || 'conversation').slice(0, 30);
      goals.push({
        text: `Resume discussion: "${title}..."`,
        pri: 'low'
      });
    }

    // 4. Context from Documents / RAG
    if (documents.length > 0) {
      goals.push({
        text: `Query knowledge base across ${documents.length} indexed documents`,
        pri: 'low'
      });
    }

    // Filter out goals already present in the todos list
    const existingTexts = new Set(todos.map(t => t.text.toLowerCase().trim()));
    const unaddedGoals = goals.filter(g => !existingTexts.has(g.text.toLowerCase().trim()));

    return unaddedGoals.slice(0, 2);
  }, [finetuneJobs, projects, sessions, documents, todos]);

  const completedTodosCount = todos.filter(t => t.completed).length;
  const formatGb = (mb) => (mb != null ? (mb / 1024).toFixed(1) : null);
  const ramTotalGb = formatGb(telemetry?.ram?.total_mb) || '31.2';
  const ramUsedGb = formatGb(telemetry?.ram?.used_mb) || '8.2';
  const diskFreeGb = telemetry?.disk?.free_gb != null ? telemetry.disk.free_gb : 369.1;
  const gpuNames = [...new Set((telemetry?.gpus || []).map(g => (g.name || '').replace(/NVIDIA GeForce /i, '').trim()))];
  const gpuLabel = gpuNames.length > 1
    ? `${gpuNames.length}× ${gpuNames[0]}`
    : (gpuNames[0] || 'RTX 5070');

  // All 9 Station Shortcuts (excluding Overview)
  const shortcuts = [
    {
      id: 'chat',
      title: isRTL ? 'مساحة المحادثة' : 'Chat Workspace',
      icon: MessageSquare,
      desc: isRTL ? 'محادثة تفاعلية وتدفق الأوامر' : 'Interactive chat & prompt stream',
      badge: isRTL ? `${sessions.length} جلسات` : `${sessions.length} sessions`,
      color: 'emerald'
    },
    {
      id: 'projects',
      title: isRTL ? 'المشاريع والأكواد' : 'Projects & Code',
      icon: FolderGit2,
      desc: isRTL ? 'محرر مباشر ومساحة عمل الملفات' : 'Live editor & file workspace',
      badge: isRTL ? `${projects.length} مشاريع` : `${projects.length} repos`,
      color: 'pink'
    },
    {
      id: 'finetuning',
      title: isRTL ? 'استوديو الضبط الدقيق' : 'Fine-Tuning Studio',
      icon: Target,
      desc: isRTL ? 'محرك تدريب QLoRA عبر Unsloth' : 'Unsloth QLoRA autonomous engine',
      badge: isRTL ? `${finetuneJobs.length} نماذج` : `${finetuneJobs.length} models`,
      color: 'purple'
    },
    {
      id: 'studio',
      title: isRTL ? 'استوديو الوكلاء' : 'Agent Studio',
      icon: Users,
      desc: isRTL ? 'تخصيص الشخصيات والتوجيهات والأدوات' : 'Personas, prompts & tool configs',
      badge: isRTL ? `${agents.length} وكلاء` : `${agents.length} agents`,
      color: 'indigo'
    },
    {
      id: 'debate',
      title: isRTL ? 'غرفة المناظرة' : 'Agent Debate',
      icon: Swords,
      desc: isRTL ? 'ساحة التداول ونقد الوكلاء' : 'Multi-agent critique arena',
      badge: isRTL ? 'نشط' : 'Active',
      color: 'amber'
    },
    {
      id: 'skills',
      title: isRTL ? 'المهارات والأدوات' : 'Skills & Tools',
      icon: Puzzle,
      desc: isRTL ? 'أدوات MCP وربط أوامر الطرفية' : 'MCP tools & bash terminal hooks',
      badge: isRTL ? 'مُدمج' : 'Integrated',
      color: 'cyan'
    },
    {
      id: 'docs',
      title: isRTL ? 'مكتبة المعرفة' : 'Library',
      icon: BookOpen,
      desc: isRTL ? 'قاعدة المعرفة المفهرسة عبر RAG' : 'RAG indexed knowledge base',
      badge: isRTL ? `${documents.length} ملفات` : `${documents.length} files`,
      color: 'blue'
    },
    {
      id: 'memory',
      title: isRTL ? 'الذاكرة والحقائق' : 'Memory & Facts',
      icon: BrainCircuit,
      desc: isRTL ? 'ملف المستخدم والذاكرة طويلة الأمد' : 'Long-term user profile & memory',
      badge: isRTL ? 'دائم' : 'Persistent',
      color: 'rose'
    },
    {
      id: 'resources',
      title: isRTL ? 'موارد النظام' : 'System Resources',
      icon: Activity,
      desc: isRTL ? 'مقاييس العتاد ومراقبة الأداء' : 'Dual RTX 5070 & hardware metrics',
      badge: isRTL ? `${diskFreeGb} جيجابايت متاح` : (telemetry?.disk?.free_gb != null ? `${telemetry.disk.free_gb} GB Free` : 'CUDA 13.0'),
      color: 'teal'
    }
  ];

  const getColorClasses = (col) => {
    switch(col) {
      case 'emerald': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:border-emerald-500/40 group-hover:text-emerald-300';
      case 'pink': return 'bg-pink-500/10 text-pink-400 border-pink-500/20 group-hover:border-pink-500/40 group-hover:text-pink-300';
      case 'purple': return 'bg-purple-500/10 text-purple-400 border-purple-500/20 group-hover:border-purple-500/40 group-hover:text-purple-300';
      case 'indigo': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 group-hover:border-indigo-500/40 group-hover:text-indigo-300';
      case 'amber': return 'bg-amber-500/10 text-amber-400 border-amber-500/20 group-hover:border-amber-500/40 group-hover:text-amber-300';
      case 'cyan': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 group-hover:border-cyan-500/40 group-hover:text-cyan-300';
      case 'blue': return 'bg-blue-500/10 text-blue-400 border-blue-500/20 group-hover:border-blue-500/40 group-hover:text-blue-300';
      case 'rose': return 'bg-rose-500/10 text-rose-400 border-rose-500/20 group-hover:border-rose-500/40 group-hover:text-rose-300';
      case 'teal': return 'bg-teal-500/10 text-teal-400 border-teal-500/20 group-hover:border-teal-500/40 group-hover:text-teal-300';
      default: return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 group-hover:border-indigo-500/40';
    }
  };

  return (
    <div className="h-full w-full overflow-hidden bg-[#0a0c14] text-gray-200 p-3.5 md:p-4 flex flex-col justify-between gap-3 select-none">
      
      {/* 1. TOP HERO BAR: Greeting, Live Weather & System Overview */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#141829] via-[#101322] to-[#0d0f1b] border border-purple-500/20 p-3.5 shadow-xl shrink-0">
        <div className="absolute top-0 right-0 w-60 h-60 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3">
          {/* Left: Greeting, Station Time & Combined Live Weather */}
          <div className="space-y-1.5 min-w-0">
            <h1 className="text-lg md:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>{isRTL ? (greeting.includes('morning') ? 'صباح الخير، أيها القائد' : (greeting.includes('afternoon') ? 'طاب مساؤك، أيها القائد' : 'مساء الخير، أيها القائد')) : `${greeting}, Commander`}</span>
              <span className="text-lg">⚡</span>
            </h1>

            <div className="flex items-center gap-2 text-[11px] font-mono text-gray-400">
              <Clock className="w-3 h-3 text-purple-400" />
              <span>{dateString}</span>
              <span className="text-gray-600">•</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-indigo-200 to-emerald-300 font-black tracking-wider text-sm">
                {timeString}
              </span>
            </div>

            {/* Live Weather Merged Into Greeting */}
            <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
              <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                <Sun className="w-3 h-3 text-amber-400" />
                <span>{weather?.city || 'Station Atmosphere'}</span>
              </span>
              <span className="text-gray-600">|</span>
              <span className="text-xl font-black text-white font-mono flex items-baseline">
                {weather?.temperature ?? 26}
                <span className="text-xs text-purple-400 ml-0.5">°C</span>
              </span>
              <span className="text-xs text-gray-300">{weather?.condition || 'Clear'}</span>
              <span className="flex items-center gap-1 text-[10px] font-mono text-gray-400">
                <Droplets className="w-3 h-3 text-cyan-400" /> {weather?.humidity || '48%'}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-mono text-gray-400">
                <Wind className="w-3 h-3 text-teal-400" /> {weather?.wind || '14 km/h'}
              </span>
            </div>
          </div>

          {/* Right: Compact System Overview Matrix (OS, CPU, RAM, GPU, {t('overview.storage', 'Storage')}) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 flex items-center gap-1.5 shadow-sm" title={`${telemetry?.os?.name || 'Linux'} ${telemetry?.os?.release || ''}`}>
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] font-mono font-bold text-gray-200">{telemetry?.os?.distro || 'Linux'}</span>
              <span className="text-[9px] font-mono text-gray-500">{telemetry?.os?.machine || 'x86_64'}</span>
            </div>

            <div className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 flex items-center gap-1.5 shadow-sm" title={telemetry?.cpu?.model || 'CPU'}>
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-mono font-bold text-gray-200">{telemetry?.cpu?.logical_cores || 28} {isRTL ? 'أنوية' : 'Cores'}</span>
              {telemetry?.cpu?.percent != null && (
                <span className="text-[9px] font-mono text-emerald-300">{telemetry.cpu.percent}%</span>
              )}
            </div>

            <div className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 flex items-center gap-1.5 shadow-sm" title="System RAM">
              <MemoryStick className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[10px] font-mono font-bold text-gray-200">
                {ramUsedGb} / {ramTotalGb} GB
              </span>
              {telemetry?.ram?.percent != null && (
                <span className="text-[9px] font-mono text-purple-300">{telemetry.ram.percent}%</span>
              )}
            </div>

            <div className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 flex items-center gap-1.5 shadow-sm" title="Graphics Hardware">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] font-mono font-bold text-gray-200">{gpuLabel}</span>
            </div>

            <div className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 flex items-center gap-1.5 shadow-sm" title="Root {t('overview.storage', 'Storage')}">
              <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-[10px] font-mono font-bold text-gray-200">{diskFreeGb} {isRTL ? 'جيجابايت متاح' : 'GB Free'}</span>
              {telemetry?.disk?.total_gb != null && (
                <span className="text-[9px] font-mono text-indigo-300">{telemetry.disk.used_gb} / {telemetry.disk.total_gb} GB</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. FAST AI PROMPT DISPATCH BAR WITH SELECTABLE AGENTS */}
      <div className="relative rounded-2xl bg-gradient-to-r from-[#121524] via-[#0f121e] to-[#121524] border border-purple-500/30 p-2 shadow-lg shrink-0 z-20">
        <form onSubmit={handleQuickPromptSubmit} className="flex items-center gap-2">
          
          {/* Dedicated Agent Selector Dropdown */}
          <div className="relative shrink-0" ref={agentDropdownRef}>
            <button
              type="button"
              onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#161a2b] hover:bg-[#1f253d] border border-purple-500/30 hover:border-purple-500/60 text-xs text-gray-200 transition-all font-mono shadow-sm cursor-pointer"
            >
              <span className="text-sm">{currentSelectedAgent.avatar || '🤖'}</span>
              <span className="font-bold text-purple-300 truncate max-w-[130px]">{currentSelectedAgent.name}</span>
              <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${agentDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {agentDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-64 rounded-xl bg-[#111422] border border-card-border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-1">
                <div className="px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-purple-300 border-b border-card-border/40">
                  Target Agent for Dispatch
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
                  {agents.map((ag) => {
                    const isSelected = ag.id === selectedAgentId;
                    return (
                      <button
                        key={ag.id}
                        type="button"
                        onClick={() => {
                          setSelectedAgentId(ag.id);
                          setAgentDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors border cursor-pointer ${
                          isSelected
                            ? 'bg-purple-500/20 text-purple-200 border-purple-500/40 shadow-sm'
                            : 'hover:bg-[#181c2b] text-gray-300 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate mr-1">
                          <span className="text-sm shrink-0">{ag.avatar || '🤖'}</span>
                          <div className="truncate">
                            <div className="font-bold text-xs text-gray-100 truncate">{ag.name}</div>
                            <div className="text-[9px] text-gray-400 font-mono truncate">{ag.role}</div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3 h-3 text-purple-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Input Bar */}
          <div className="flex-1 relative">
            <input
              ref={quickInputRef}
              autoFocus
              type="text"
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              placeholder={isRTL ? `...اسأل ${currentSelectedAgent.name} أي شيء أو أرسل توجيهاً لمساحة العمل` : `Ask ${currentSelectedAgent.name} anything or dispatch a prompt to workspace...`}
              className="w-full bg-[#090b12] border border-card-border rounded-xl px-3.5 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500/50 font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={!quickPrompt.trim()}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white font-mono font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-md shadow-purple-900/30 cursor-pointer"
          >
            <span>{isRTL ? 'إرسال التوجيه' : 'Dispatch'}</span>
            <Send className="w-3 h-3" />
          </button>
        </form>
      </div>

      {/* 3. MAIN DASHBOARD: 9 Station Shortcuts + To-Do Planner Hub */}
      <div className="grid grid-cols-12 gap-3 flex-1 min-h-0">
        
        {/* Left 8 Cols: 9 Station Feature Shortcuts + Hardware & {t('overview.storage', 'Storage')} Matrix */}
        <div className="col-span-12 lg:col-span-8 flex flex-col justify-between gap-3 h-full overflow-hidden">
          
          {/* 9 Feature Shortcut Cards Matrix */}
          <div className="p-3.5 rounded-2xl bg-[#0f121e] border border-card-border shadow-xl flex-1 flex flex-col justify-between overflow-hidden">
            <div className="flex items-center justify-between border-b border-card-border pb-2 mb-2">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-gray-200 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Station Applications & Feature Shortcuts</span>
              </div>
              <span className="text-[10px] font-mono text-gray-500">9 {t('overview.core_modules', 'Core Modules')}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 flex-1">
              {shortcuts.map((sc) => {
                const IconComponent = sc.icon;
                return (
                  <div
                    key={sc.id}
                    onClick={() => setActiveTab(sc.id)}
                    className="group p-2.5 rounded-xl bg-[#141726] hover:bg-[#1b2034] border border-card-border/60 hover:border-purple-500/40 transition-all duration-200 flex flex-col justify-between cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 select-none"
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-1.5 rounded-lg border transition-colors ${getColorClasses(sc.color)}`}>
                        <IconComponent className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10 group-hover:text-purple-300 group-hover:border-purple-500/30 transition-colors">
                        {sc.badge}
                      </span>
                    </div>

                    <div className="mt-1">
                      <h3 className="font-bold text-xs text-gray-100 group-hover:text-white transition-colors truncate">
                        {sc.title}
                      </h3>
                      <p className="text-[10px] text-gray-500 group-hover:text-gray-400 transition-colors line-clamp-1">
                        {sc.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* HARDWARE & MULTI-DISK ACCELERATION MATRIX */}
          <div className="p-3 rounded-2xl bg-[#0f121e] border border-card-border shadow-xl shrink-0 space-y-2">
            <div className="flex items-center justify-between border-b border-card-border pb-1.5">
              <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                <Zap className="w-3 h-3" />
                <span>Dual NVIDIA RTX 5070 & {t('overview.storage', 'Storage')} Hardware Matrix</span>
              </div>
              <button
                onClick={() => setActiveTab('resources')}
                className="text-[10px] font-mono text-gray-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Full Telemetry</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* GPU 0 */}
              <div className="p-2.5 rounded-xl bg-[#141829] border border-card-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-gray-200">
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                    <span>GPU 0 (RTX 5070)</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {telemetry?.gpus?.[0]?.temperature_c || 45}°C • Active
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                    <span>V{t('overview.ram_usage', 'RAM Usage')}</span>
                    <span className="font-bold text-emerald-300">
                      {telemetry?.gpus?.[0]?.vram_used_mb ? `${telemetry.gpus[0].vram_used_mb} MiB` : '824 MiB'} / 12.2 GB
                    </span>
                  </div>
                  <div className="w-full bg-[#090b12] h-1.5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      style={{ width: `${telemetry?.gpus?.[0]?.vram_percent || 7}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* GPU 1 */}
              <div className="p-2.5 rounded-xl bg-[#141829] border border-card-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-gray-200">
                    <Cpu className="w-3.5 h-3.5 text-purple-400" />
                    <span>GPU 1 (RTX 5070)</span>
                  </div>
                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                    {telemetry?.gpus?.[1]?.temperature_c || 33}°C • Standby
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
                    <span>V{t('overview.ram_usage', 'RAM Usage')}</span>
                    <span className="font-bold text-purple-300">
                      {telemetry?.gpus?.[1]?.vram_used_mb ? `${telemetry.gpus[1].vram_used_mb} MiB` : '2 MiB'} / 12.2 GB
                    </span>
                  </div>
                  <div className="w-full bg-[#090b12] h-1.5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                      style={{ width: `${telemetry?.gpus?.[1]?.vram_percent || 1}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Internal Disks & Connected USB Drives */}
              {(telemetry?.disks || [
                {
                  id: 'primary_disk',
                  name: 'Primary System Drive',
                  short_name: 'System Drive',
                  device: 'local',
                  mount: '/',
                  role: 'Operating System & Workspace',
                  used_gb: 0,
                  total_gb: 0,
                  free_gb: 0,
                  percent: 0,
                  status: 'Loading telemetry...',
                  is_usb: false
                }
              ]).map((d) => {
                const isUsb = d.is_usb;
                return (
                  <div
                    key={d.id}
                    className={`p-2.5 rounded-xl bg-[#141829] border space-y-2 transition-all group/dcard ${
                      isUsb
                        ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-[#141829] shadow-amber-500/10 shadow-lg'
                        : 'border-card-border hover:border-cyan-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-gray-200 truncate">
                        <HardDrive className={`w-3.5 h-3.5 shrink-0 ${
                          isUsb ? 'text-amber-400 animate-pulse' : 'text-cyan-400'
                        }`} />
                        <span className="truncate">{d.short_name || d.name}</span>
                      </div>
                      <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border shrink-0 ${
                        isUsb
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                      }`}>
                        {isUsb ? (isRTL ? '⚡ وحدة USB' : '⚡ USB Drive') : (isRTL ? `${d.free_gb} جيجابايت متاح` : `${d.free_gb} GB Free`)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 truncate">
                        <span className="truncate">{d.role || d.mount || t('overview.storage', 'Storage')}</span>
                        <span className={`font-bold shrink-0 ml-1 ${
                          isUsb ? 'text-amber-300' : 'text-cyan-300'
                        }`}>
                          {d.used_gb != null ? `${d.used_gb} / ${d.total_gb} GB` : `${d.total_gb} GB`}
                        </span>
                      </div>
                      <div className="w-full bg-[#090b12] h-1.5 rounded-full overflow-hidden border border-white/5">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isUsb
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                              : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, d.percent ?? 20))}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Bar: Explore & Eject */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] font-mono">
                      <button
                        type="button"
                        onClick={() => setExploringDrive(d)}
                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-cyan-500/20 text-gray-300 hover:text-cyan-300 border border-white/10 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Explore files & folders on this drive"
                      >
                        <FolderOpen className="w-2.5 h-2.5 text-cyan-400" />
                        <span>{t('common.explore', 'Explore')}</span>
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
                          <span>{t('overview.os_drive', 'OS Drive')}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Interactive Station To-Do Planner Hub */}
        <div className="col-span-12 lg:col-span-4 p-3.5 rounded-2xl bg-[#0f121e] border border-card-border shadow-xl flex flex-col justify-between h-full overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-card-border pb-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <CheckSquare className="w-3.5 h-3.5" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-gray-100 font-mono uppercase tracking-wider">
                  Station Planner
                </h2>
                <p className="text-[10px] text-gray-400 font-mono">
                  {isRTL ? `${completedTodosCount} من أصل ${todos.length} مكتملة` : `${completedTodosCount} of ${todos.length} completed`}
                </p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-0.5 bg-[#141829] p-0.5 rounded-lg border border-card-border text-[9px] font-mono">
              {['all', 'active', 'completed'].map(f => (
                <button
                  key={f}
                  onClick={() => setTodoFilter(f)}
                  className={`px-1.5 py-0.5 rounded capitalize transition-colors cursor-pointer ${
                    todoFilter === f ? 'bg-purple-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* New To-Do Form */}
          <form onSubmit={handleAddTodo} className="space-y-1.5 py-2 shrink-0 border-b border-card-border/40">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder="Add a new task or goal..."
                className="flex-1 bg-[#141829] border border-card-border rounded-lg px-2.5 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
              />
              <button
                type="submit"
                disabled={!newTodoText.trim()}
                className="p-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition-colors cursor-pointer"
                title="Add Task"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Priority Selector */}
            <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 px-0.5">
              <span>{t('common.priority', 'Priority')}:</span>
              <div className="flex items-center gap-1">
                {[
                  { id: 'high', label: '🔥 High' },
                  { id: 'medium', label: '⚡ Med' },
                  { id: 'low', label: '🟢 Low' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setNewTodoPriority(p.id)}
                    className={`px-1.5 py-0.2 rounded transition-all cursor-pointer ${
                      newTodoPriority === p.id ? 'bg-[#1e243c] text-white font-bold border border-purple-500/40' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </form>

          {/* Scrollable Checklist */}
          <div className="space-y-1.5 flex-1 overflow-y-auto pr-1 py-1">
            {filteredTodos.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500 font-mono">
                {todoFilter === 'completed' ? 'No completed tasks.' : t('overview.no_todos', 'No active tasks. Add one above!')}
              </div>
            ) : (
              filteredTodos.map(todo => (
                <div
                  key={todo.id}
                  className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 group ${
                    todo.completed
                      ? 'bg-[#101320]/60 border-card-border/40 text-gray-500'
                      : 'bg-[#141829] border-card-border text-gray-200 hover:border-purple-500/30'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleTodo(todo)}
                    className="flex items-center gap-2 text-left flex-1 cursor-pointer truncate"
                  >
                    {todo.completed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-gray-500 group-hover:text-purple-400 shrink-0" />
                    )}
                    <span className={`text-xs truncate ${todo.completed ? 'line-through text-gray-500' : 'font-medium'}`}>
                      {todo.text}
                    </span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    {todo.priority === 'high' && (
                      <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-red-500/15 text-red-300 border border-red-500/30">
                        High
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-500 hover:text-red-400 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* AI Quick Task Suggestions */}
          {dynamicGoals.length > 0 && (
            <div className="pt-2 border-t border-card-border space-y-1 shrink-0">
              <div className="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                  <span>Dynamic Goals</span>
                </span>
                <span className="text-[8px] text-gray-500">Contextual</span>
              </div>
              <div className="flex flex-col gap-1">
                {dynamicGoals.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleAddSuggestedTodo(s.text, s.pri)}
                    className="text-left text-[10px] text-gray-400 hover:text-purple-300 p-1 rounded-lg bg-[#111422] hover:bg-[#171c2e] border border-white/5 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span className="truncate mr-1">+ {s.text}</span>
                    <span className="text-[8px] font-mono text-purple-400 shrink-0">Add</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Eject Notification Toast */}
      {ejectNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#121626] border border-amber-500/40 text-amber-200 px-4 py-2.5 rounded-xl shadow-2xl font-mono text-xs flex items-center gap-2 animate-bounce">
          <Power className="w-4 h-4 text-amber-400" />
          <span>{ejectNotice}</span>
        </div>
      )}

      {/* {t('overview.drive_explorer_btn', 'Drive Explorer')} Modal */}
      {exploringDrive && (
        <DriveExplorerModal
          drive={exploringDrive}
          onClose={() => setExploringDrive(null)}
        />
      )}

    </div>
  );
}
