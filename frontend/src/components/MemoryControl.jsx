import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { 
  BrainCircuit, 
  FileText, 
  Save, 
  History, 
  Sparkles, 
  Check, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  User, 
  Sliders, 
  X, 
  Code,
  Star, 
  Copy, 
  Download, 
  Upload, 
  RefreshCw, 
  LayoutGrid, 
  List, 
  CheckSquare, 
  Square, 
  BookOpen, 
  Zap, 
  CornerDownLeft
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All Memories', color: 'emerald', icon: BrainCircuit },
  { id: 'user_profile', label: 'User & Identity', color: 'purple', icon: User },
  { id: 'preference', label: 'Preferences & Style', color: 'cyan', icon: Sliders },
  { id: 'project_rule', label: 'Project Rules & Stack', color: 'amber', icon: Code },
  { id: 'knowledge', label: 'Knowledge & Docs', color: 'emerald', icon: BookOpen },
];

export default function MemoryControl() {
  const { t, isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState('facts'); // 'facts' | 'rules' | 'sessions'
  
  // Facts state
  const [facts, setFacts] = useState([]);
  const [loadingFacts, setLoadingFacts] = useState(false);
  const [factsSearch, setFactsSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSource, setSelectedSource] = useState('all'); // 'all' | 'manual' | 'system' | 'agent'
  const [sortBy, setSortBy] = useState('pinned'); // 'pinned' | 'recent' | 'alpha' | 'category'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [selectedFactIds, setSelectedFactIds] = useState(new Set());
  const [copiedId, setCopiedId] = useState(null);

  // Quick Capture Bar state
  const [quickInput, setQuickInput] = useState('');
  const [quickCategory, setQuickCategory] = useState('user_profile');
  const [quickSaving, setQuickSaving] = useState(false);

  // Modal states
  const [showFactModal, setShowFactModal] = useState(false);
  const [editingFact, setEditingFact] = useState(null);
  const [factKey, setFactKey] = useState('');
  const [factValue, setFactValue] = useState('');
  const [factCategory, setFactCategory] = useState('user_profile');
  const [factPinned, setFactPinned] = useState(false);

  // Import / Export Modal
  const [showImportExportModal, setShowImportExportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [importResult, setImportResult] = useState(null);

  // Rules state
  const [rules, setRules] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [saved, setSaved] = useState(false);

  // Sessions state
  const [sessions, setSessions] = useState([]);

  // Toast feedback
  const [feedbackToast, setFeedbackToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setFeedbackToast({ msg, type });
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const fetchFacts = async () => {
    setLoadingFacts(true);
    try {
      const res = await fetch('/api/memory/facts');
      const data = await res.json();
      if (Array.isArray(data)) {
        setFacts(data);
      }
    } catch (err) {
      console.error('Failed to load memory facts:', err);
      showToast('Failed to load facts', 'error');
    } finally {
      setLoadingFacts(false);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await fetch('/api/memory/rules');
      const data = await res.json();
      if (data.rules && data.rules.length > 0) {
        setRules(data.rules);
        if (!selectedFile) {
          setSelectedFile(data.rules[0].file);
          setFileContent(data.rules[0].content);
        }
      }
    } catch (err) {
      console.error('Failed to load rules:', err);
    }
  };

  useEffect(() => {
    fetchFacts();
    fetchRules();

    fetch('/api/memory/sessions')
      .then(res => res.json())
      .then(data => setSessions(data))
      .catch(() => {});
  }, []);

  const handleQuickCapture = async (e) => {
    if (e) e.preventDefault();
    if (!quickInput.trim()) return;

    setQuickSaving(true);
    let key = '';
    let value = quickInput.trim();

    if (value.includes(':')) {
      const parts = value.split(':');
      key = parts[0].trim();
      value = parts.slice(1).join(':').trim();
    } else if (value.includes(' - ')) {
      const parts = value.split(' - ');
      key = parts[0].trim();
      value = parts.slice(1).join(' - ').trim();
    } else {
      const words = value.split(' ');
      key = words.slice(0, 4).join(' ');
      if (words.length > 4) key += '...';
    }

    try {
      const res = await fetch('/api/memory/facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value,
          category: quickCategory,
          source: 'manual',
          is_pinned: 0
        })
      });
      if (res.ok) {
        showToast(`Saved memory: "${key}"`);
        setQuickInput('');
        fetchFacts();
      }
    } catch (err) {
      showToast(`Error saving: ${err.message}`, 'error');
    } finally {
      setQuickSaving(false);
    }
  };

  const handleOpenCreateFact = () => {
    setEditingFact(null);
    setFactKey('');
    setFactValue('');
    setFactCategory(selectedCategory !== 'all' ? selectedCategory : 'user_profile');
    setFactPinned(false);
    setShowFactModal(true);
  };

  const handleOpenEditFact = (fact) => {
    setEditingFact(fact);
    setFactKey(fact.key);
    setFactValue(fact.value);
    setFactCategory(fact.category || 'user_profile');
    setFactPinned(!!fact.is_pinned);
    setShowFactModal(true);
  };

  const handleSaveFact = async (e) => {
    e.preventDefault();
    if (!factKey.trim() || !factValue.trim()) return;

    try {
      let res;
      if (editingFact?.id) {
        res = await fetch(`/api/memory/facts/${editingFact.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: factKey.trim(),
            value: factValue.trim(),
            category: factCategory,
            is_pinned: factPinned ? 1 : 0
          })
        });
      } else {
        res = await fetch('/api/memory/facts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: factKey.trim(),
            value: factValue.trim(),
            category: factCategory,
            source: 'manual',
            is_pinned: factPinned ? 1 : 0
          })
        });
      }

      if (res.ok) {
        setShowFactModal(false);
        showToast(editingFact ? 'Memory updated successfully' : 'Memory fact created');
        fetchFacts();
      }
    } catch (err) {
      showToast(`Failed to save: ${err.message}`, 'error');
    }
  };

  const handleTogglePin = async (fact) => {
    try {
      const res = await fetch(`/api/memory/facts/${fact.id}/pin`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setFacts(prev => prev.map(f => f.id === fact.id ? { ...f, is_pinned: data.is_pinned } : f));
        showToast(data.is_pinned ? `Pinned "${fact.key}" to top` : `Unpinned "${fact.key}"`);
      }
    } catch (err) {
      showToast('Failed to toggle pin', 'error');
    }
  };

  const handleDeleteFact = async (id, key) => {
    if (confirm(`Delete memory fact "${key}"?`)) {
      try {
        await fetch(`/api/memory/facts/${id}`, { method: 'DELETE' });
        showToast(`Deleted "${key}"`);
        fetchFacts();
      } catch (err) {
        showToast('Failed to delete fact', 'error');
      }
    }
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selectedFactIds);
    if (!ids.length) return;
    if (confirm(`Are you sure you want to delete ${ids.length} selected memory facts?`)) {
      try {
        const res = await fetch('/api/memory/facts/batch-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fact_ids: ids })
        });
        if (res.ok) {
          showToast(`Deleted ${ids.length} memory facts`);
          setSelectedFactIds(new Set());
          fetchFacts();
        }
      } catch (err) {
        showToast('Batch delete failed', 'error');
      }
    }
  };

  const handleCopyFact = (fact) => {
    const text = `${fact.key}: ${fact.value}`;
    navigator.clipboard.writeText(text);
    setCopiedId(fact.id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('Copied to clipboard');
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(facts, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pi_memory_facts_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported memory facts backup');
  };

  const handleImportJson = async () => {
    try {
      const parsed = JSON.parse(importJsonText);
      const factsArray = Array.isArray(parsed) ? parsed : (parsed.facts || []);
      if (!factsArray.length) {
        setImportResult({ success: false, message: 'JSON array is empty or invalid.' });
        return;
      }
      const res = await fetch('/api/memory/facts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts: factsArray })
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult({ success: true, message: `Successfully imported ${data.count} memory facts!` });
        fetchFacts();
        setTimeout(() => {
          setShowImportExportModal(false);
          setImportJsonText('');
          setImportResult(null);
        }, 1500);
      }
    } catch (err) {
      setImportResult({ success: false, message: `JSON Parse error: ${err.message}` });
    }
  };

  const handleSaveRule = async () => {
    if (!selectedFile) return;
    try {
      await fetch('/api/memory/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath: selectedFile, content: fileContent })
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      showToast('Project rules saved successfully');
    } catch (err) {
      showToast('Failed to save rules', 'error');
    }
  };

  const categoryCounts = useMemo(() => {
    const counts = { all: facts.length, user_profile: 0, preference: 0, project_rule: 0, knowledge: 0 };
    facts.forEach(f => {
      if (counts[f.category] !== undefined) {
        counts[f.category]++;
      } else {
        counts.knowledge++;
      }
    });
    return counts;
  }, [facts]);

  const filteredFacts = useMemo(() => {
    let list = facts.filter(f => {
      const matchesCat = selectedCategory === 'all' || f.category === selectedCategory;
      const matchesSource = selectedSource === 'all' ||
        (selectedSource === 'agent' ? f.source?.includes('agent') || f.source?.includes('chat') : f.source === selectedSource);
      const query = factsSearch.toLowerCase().trim();
      const matchesSearch = !query ||
        (f.key || '').toLowerCase().includes(query) ||
        (f.value || '').toLowerCase().includes(query) ||
        (f.category || '').toLowerCase().includes(query);
      return matchesCat && matchesSource && matchesSearch;
    });

    return list.sort((a, b) => {
      if (sortBy === 'pinned') {
        if ((b.is_pinned || 0) !== (a.is_pinned || 0)) {
          return (b.is_pinned || 0) - (a.is_pinned || 0);
        }
        return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
      }
      if (sortBy === 'recent') {
        return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0);
      }
      if (sortBy === 'alpha') {
        return (a.key || '').localeCompare(b.key || '');
      }
      if (sortBy === 'category') {
        return (a.category || '').localeCompare(b.category || '');
      }
      return 0;
    });
  }, [facts, selectedCategory, selectedSource, factsSearch, sortBy]);

  const toggleSelectFact = (id) => {
    setSelectedFactIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFactIds.size === filteredFacts.length) {
      setSelectedFactIds(new Set());
    } else {
      setSelectedFactIds(new Set(filteredFacts.map(f => f.id)));
    }
  };

  const getCategoryTheme = (cat) => {
    switch (cat) {
      case 'user_profile':
        return {
          border: 'border-purple-500/40',
          bg: 'bg-purple-500/10',
          text: 'text-purple-300',
          dot: 'bg-purple-400',
          badge: 'bg-purple-500/20 text-purple-200 border-purple-500/30'
        };
      case 'preference':
        return {
          border: 'border-cyan-500/40',
          bg: 'bg-cyan-500/10',
          text: 'text-cyan-300',
          dot: 'bg-cyan-400',
          badge: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/30'
        };
      case 'project_rule':
        return {
          border: 'border-amber-500/40',
          bg: 'bg-amber-500/10',
          text: 'text-amber-300',
          dot: 'bg-amber-400',
          badge: 'bg-amber-500/20 text-amber-200 border-amber-500/30'
        };
      case 'knowledge':
      default:
        return {
          border: 'border-emerald-500/40',
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-300',
          dot: 'bg-emerald-400',
          badge: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/30'
        };
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0a0c14] text-gray-100 font-sans">
      
      {/* 1. Left Sub-Navigation */}
      <div className="w-64 border-r border-card-border/80 bg-[#0d101a] p-4 flex flex-col justify-between shrink-0 select-none">
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <BrainCircuit className="w-5 h-5 text-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-200 font-mono">
              Memory & Facts OS
            </span>
          </div>

          <div className="space-y-1.5">
            {[
              { id: 'facts', label: 'Long-Term Memory Facts', icon: BrainCircuit, count: facts.length, color: 'emerald' },
              { id: 'rules', label: 'Global Rules (AGENTS.md)', icon: FileText, count: rules.length, color: 'cyan' },
              { id: 'sessions', label: 'Pi Session Archives', icon: History, count: sessions.length, color: 'amber' },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 font-bold'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#151928]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-gray-500'}`} />
                    <span className="truncate">{tab.label}</span>
                  </div>
                  {tab.count !== undefined && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                      isActive ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-500/40' : 'bg-card-border/50 text-gray-500'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Info Box */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-b from-[#121626] to-[#0d101a] border border-emerald-500/20 text-xs text-gray-400 space-y-2">
          <div className="font-bold text-gray-200 flex items-center gap-1.5 font-mono text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Autonomous Context</span>
          </div>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            All stored memory facts, pinned preferences, and rules are injected live into every model & agent conversation.
          </p>
          <div className="pt-1 flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>{facts.length} Active Memories Loaded</span>
          </div>
        </div>
      </div>

      {/* 2. Main Content View Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* TAB 1: MEMORY FACTS STORE */}
        {activeTab === 'facts' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Top Hero Banner */}
            <div className="p-4 md:p-5 border-b border-card-border/80 bg-gradient-to-r from-[#101424] via-[#0d101c] to-[#0a0c16] flex items-center justify-between flex-wrap gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Long-Term Persistent Memory Facts</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                        {facts.length} Facts
                      </span>
                    </h2>
                    <p className="text-xs text-gray-400 font-sans">
                      Universal memory store: user profile, coding preferences, project architecture, and learned agent facts.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchFacts}
                  disabled={loadingFacts}
                  className="p-2 rounded-xl bg-[#151928] hover:bg-[#1f253c] text-gray-400 hover:text-white border border-card-border transition-colors cursor-pointer"
                  title="Refresh Memory Facts"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingFacts ? 'animate-spin text-emerald-400' : ''}`} />
                </button>

                <button
                  onClick={handleExportJson}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#151928] hover:bg-[#1f253c] text-gray-300 hover:text-white text-xs font-mono border border-card-border transition-colors cursor-pointer"
                  title="Export Backup JSON"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Export</span>
                </button>

                <button
                  onClick={() => {
                    setImportJsonText('');
                    setImportResult(null);
                    setShowImportExportModal(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#151928] hover:bg-[#1f253c] text-gray-300 hover:text-white text-xs font-mono border border-card-border transition-colors cursor-pointer"
                  title="Import Facts JSON"
                >
                  <Upload className="w-3.5 h-3.5 text-purple-400" />
                  <span>Import</span>
                </button>

                <button
                  onClick={handleOpenCreateFact}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-gray-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Memory Fact</span>
                </button>
              </div>
            </div>

            {/* Smart Quick Capture Ingestion Bar */}
            <div className="p-3 border-b border-card-border/60 bg-[#0e121e]">
              <form onSubmit={handleQuickCapture} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono shrink-0">
                  <Zap className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden sm:inline">Quick Ingest</span>
                </div>

                <div className="relative flex-1">
                  <input
                    type="text"
                    value={quickInput}
                    onChange={(e) => setQuickInput(e.target.value)}
                    placeholder="Type or paste any fact to remember (e.g. 'Database: PostgreSQL on port 5432' or 'Preferred UI: Tailwind + Dark Mode')..."
                    className="w-full bg-[#131728] border border-card-border/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors font-sans"
                  />
                </div>

                <select
                  value={quickCategory}
                  onChange={(e) => setQuickCategory(e.target.value)}
                  className="bg-[#131728] border border-card-border/80 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono focus:outline-none focus:border-purple-500 shrink-0 cursor-pointer"
                >
                  <option value="user_profile">👤 User Profile</option>
                  <option value="preference">⚙️ Preferences</option>
                  <option value="project_rule">📐 Project Rule</option>
                  <option value="knowledge">📚 Knowledge</option>
                </select>

                <button
                  type="submit"
                  disabled={quickSaving || !quickInput.trim()}
                  className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                    quickInput.trim() && !quickSaving
                      ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30'
                      : 'bg-[#181d30] text-gray-500 border border-white/5 cursor-not-allowed'
                  }`}
                >
                  {quickSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Save Fact</span>
                </button>
              </form>
            </div>

            {/* Filter, Search & View Control Bar */}
            <div className="p-3 border-b border-card-border/60 bg-[#0a0c16] flex items-center justify-between gap-3 flex-wrap">
              
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const count = categoryCounts[cat.id] || 0;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                        isSelected
                          ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold shadow-sm'
                          : 'bg-[#111422] border border-card-border/60 text-gray-400 hover:text-gray-200 hover:bg-[#181d30]'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-400' : 'text-gray-500'}`} />
                      <span>{cat.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected ? 'bg-emerald-500/30 text-emerald-200 font-bold' : 'bg-card-border/40 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Controls: Search, Source, Sort, View Mode */}
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                <div className="relative w-48 sm:w-60">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={factsSearch}
                    onChange={(e) => setFactsSearch(e.target.value)}
                    placeholder="Search facts..."
                    className="w-full bg-[#111422] border border-card-border/80 rounded-xl pl-8 pr-7 py-1.5 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/50"
                  />
                  {factsSearch && (
                    <button
                      onClick={() => setFactsSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="bg-[#111422] border border-card-border/80 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 font-mono focus:outline-none cursor-pointer"
                >
                  <option value="all">All Sources</option>
                  <option value="manual">Manual Entry</option>
                  <option value="agent">Chat Learned</option>
                  <option value="system">System Default</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-[#111422] border border-card-border/80 rounded-xl px-2.5 py-1.5 text-xs text-gray-300 font-mono focus:outline-none cursor-pointer"
                >
                  <option value="pinned">⭐ Pinned First</option>
                  <option value="recent">🕒 Recently Updated</option>
                  <option value="alpha">🔤 Alphabetical (A-Z)</option>
                  <option value="category">🏷️ Category</option>
                </select>

                <div className="flex items-center bg-[#111422] border border-card-border/80 rounded-xl p-0.5">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'grid' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-500 hover:text-gray-300'
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      viewMode === 'table' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-500 hover:text-gray-300'
                    }`}
                    title="Dense List View"
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Batch Action Bar if items selected */}
            {selectedFactIds.size > 0 && (
              <div className="px-5 py-2.5 bg-[#151a2e] border-b border-purple-500/30 flex items-center justify-between text-xs font-mono animate-fade-in">
                <div className="flex items-center gap-2 text-purple-300">
                  <CheckSquare className="w-4 h-4 text-purple-400" />
                  <span><strong>{selectedFactIds.size}</strong> memories selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleBatchDelete}
                    className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Selected</span>
                  </button>
                  <button
                    onClick={() => setSelectedFactIds(new Set())}
                    className="px-3 py-1 rounded-lg bg-[#1e2338] text-gray-400 hover:text-gray-200 transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            {/* Facts Display: Grid or Table */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              {filteredFacts.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#0e111d] border border-card-border/60 max-w-lg mx-auto space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                    <BrainCircuit className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-sm text-gray-200">No Memory Facts Found</h3>
                  <p className="text-xs text-gray-400">
                    {factsSearch
                      ? `No memory matched "${factsSearch}". Try clearing your search.`
                      : "You haven't added any memories in this category yet. Use the Quick Ingest bar above or click '+ New Memory Fact'."}
                  </p>
                  {factsSearch && (
                    <button
                      onClick={() => setFactsSearch('')}
                      className="px-3 py-1.5 rounded-xl bg-[#161a28] text-xs font-mono text-emerald-400 hover:bg-[#20263c]"
                    >
                      Clear Search Filter
                    </button>
                  )}
                </div>
              ) : viewMode === 'grid' ? (
                /* Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredFacts.map((fact) => {
                    const theme = getCategoryTheme(fact.category);
                    const isSelected = selectedFactIds.has(fact.id);
                    const isPinned = !!fact.is_pinned;

                    return (
                      <div
                        key={fact.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 group shadow-md relative ${
                          isSelected
                            ? 'bg-[#151a2d] border-purple-500 shadow-purple-500/10'
                            : isPinned
                            ? 'bg-[#111424] border-amber-500/40 shadow-amber-500/5 hover:border-amber-500/60'
                            : 'bg-[#0f121e] border-card-border/80 hover:border-emerald-500/40 hover:bg-[#121626]'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                onClick={() => toggleSelectFact(fact.id)}
                                className="text-gray-500 hover:text-purple-400 transition-colors shrink-0 cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-purple-400" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                              <span className="font-bold text-xs text-white font-mono flex items-center gap-1.5 truncate">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${theme.dot}`} />
                                <span className="truncate">{fact.key}</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleTogglePin(fact)}
                                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                                  isPinned
                                    ? 'text-amber-400 bg-amber-500/15 border border-amber-500/30'
                                    : 'text-gray-500 hover:text-amber-300 opacity-0 group-hover:opacity-100'
                                }`}
                                title={isPinned ? 'Unpin Fact' : 'Pin to Top'}
                              >
                                <Star className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400' : ''}`} />
                              </button>

                              <button
                                onClick={() => handleCopyFact(fact)}
                                className="p-1 rounded-lg text-gray-500 hover:text-cyan-300 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                title="Copy Fact"
                              >
                                {copiedId === fact.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                onClick={() => handleOpenEditFact(fact)}
                                className="p-1 rounded-lg text-gray-500 hover:text-emerald-300 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                title="Edit Memory"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteFact(fact.id, fact.key)}
                                className="p-1 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                title="Delete Memory"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-[#090b12] border border-white/5 text-xs text-gray-200 font-sans leading-relaxed whitespace-pre-wrap select-text max-h-36 overflow-y-auto">
                            {fact.value}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-gray-400">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${theme.badge}`}>
                            {fact.category?.replace('_', ' ')}
                          </span>

                          <div className="flex items-center gap-1.5 text-gray-500">
                            <span>Src: <strong className="text-gray-400">{fact.source || 'manual'}</strong></span>
                            {isPinned && <span className="text-amber-400">★ Pinned</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Dense Table View */
                <div className="rounded-2xl border border-card-border/80 bg-[#0f121e] overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                      <thead className="bg-[#141829] border-b border-card-border text-[11px] font-mono text-gray-400 uppercase tracking-wider">
                        <tr>
                          <th className="p-3.5 w-10 text-center">
                            <button
                              onClick={toggleSelectAll}
                              className="text-gray-500 hover:text-purple-400 cursor-pointer"
                            >
                              {selectedFactIds.size === filteredFacts.length && filteredFacts.length > 0 ? (
                                <CheckSquare className="w-4 h-4 text-purple-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </th>
                          <th className="p-3.5 w-48">Fact Key</th>
                          <th className="p-3.5">Value / Content</th>
                          <th className="p-3.5 w-32">Category</th>
                          <th className="p-3.5 w-24">Source</th>
                          <th className="p-3.5 w-28 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-card-border/40">
                        {filteredFacts.map((fact) => {
                          const theme = getCategoryTheme(fact.category);
                          const isSelected = selectedFactIds.has(fact.id);
                          const isPinned = !!fact.is_pinned;

                          return (
                            <tr
                              key={fact.id}
                              className={`transition-colors group ${
                                isSelected ? 'bg-purple-500/10' : 'hover:bg-[#14182a]'
                              }`}
                            >
                              <td className="p-3.5 text-center">
                                <button
                                  onClick={() => toggleSelectFact(fact.id)}
                                  className="text-gray-500 hover:text-purple-400 cursor-pointer"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-purple-400" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              </td>

                              <td className="p-3.5 font-mono font-bold text-white">
                                <div className="flex items-center gap-1.5">
                                  {isPinned && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                                  <span className="truncate">{fact.key}</span>
                                </div>
                              </td>

                              <td className="p-3.5 text-gray-300 font-sans leading-relaxed select-text">
                                <span className="line-clamp-2">{fact.value}</span>
                              </td>

                              <td className="p-3.5">
                                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${theme.badge}`}>
                                  {fact.category?.replace('_', ' ')}
                                </span>
                              </td>

                              <td className="p-3.5 text-[11px] font-mono text-gray-400">
                                {fact.source || 'manual'}
                              </td>

                              <td className="p-3.5 text-right">
                                <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                                  <button
                                    onClick={() => handleTogglePin(fact)}
                                    className={`p-1 rounded transition-colors cursor-pointer ${
                                      isPinned ? 'text-amber-400' : 'text-gray-500 hover:text-amber-300'
                                    }`}
                                    title="Toggle Pin"
                                  >
                                    <Star className={`w-3.5 h-3.5 ${isPinned ? 'fill-amber-400' : ''}`} />
                                  </button>
                                  <button
                                    onClick={() => handleCopyFact(fact)}
                                    className="p-1 rounded text-gray-500 hover:text-cyan-300 cursor-pointer"
                                    title="Copy"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditFact(fact)}
                                    className="p-1 rounded text-gray-500 hover:text-emerald-300 cursor-pointer"
                                    title="Edit"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteFact(fact.id, fact.key)}
                                    className="p-1 rounded text-gray-500 hover:text-rose-400 cursor-pointer"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: GLOBAL RULES EDITOR (AGENTS.md) */}
        {activeTab === 'rules' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-card-border bg-[#0e1018] flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Global Agent Rules & Principles</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-mono text-gray-400">Target File:</span>
                    <select
                      value={selectedFile || ''}
                      onChange={(e) => {
                        const rule = rules.find(r => r.file === e.target.value);
                        if (rule) {
                          setSelectedFile(rule.file);
                          setFileContent(rule.content);
                        }
                      }}
                      className="bg-[#141824] border border-card-border rounded-lg px-2 py-0.5 text-xs text-cyan-300 font-mono focus:outline-none"
                    >
                      {rules.map(r => (
                        <option key={r.file} value={r.file}>{r.filename} ({r.file})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={handleSaveRule}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                <span>{saved ? 'Saved!' : 'Save Rules'}</span>
              </button>
            </div>

            <div className="flex-1 p-4 bg-[#090b10] overflow-hidden">
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                className="w-full h-full bg-[#0d1017] border border-card-border rounded-2xl p-4 font-mono text-xs text-gray-200 focus:outline-none focus:border-emerald-500/50 resize-none leading-relaxed"
                placeholder="# Define project rules, coding standards, and agent guidelines..."
              />
            </div>
          </div>
        )}

        {/* TAB 3: PI SESSION ARCHIVES */}
        {activeTab === 'sessions' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-card-border">
              <History className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-gray-300 font-mono">
                Pi Native Session Archives ({sessions.length})
              </span>
            </div>
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className="p-3.5 rounded-xl border border-card-border bg-[#0f121e] flex items-center justify-between text-xs font-mono hover:border-amber-500/30 transition-all">
                  <div className="truncate mr-4 space-y-0.5">
                    <div className="text-gray-200 font-medium truncate">{s.rel_path}</div>
                    <div className="text-[10px] text-gray-500">{new Date(s.modified * 1000).toLocaleString()}</div>
                  </div>
                  <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {(s.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Add / Edit Fact Modal */}
      {showFactModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d101e] border border-card-border rounded-2xl p-5 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-card-border">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-emerald-400" />
                {editingFact ? `Edit Memory: ${editingFact.key}` : 'Create New Memory Fact'}
              </h3>
              <button onClick={() => setShowFactModal(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFact} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase text-gray-300">Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.filter(c => c.id !== 'all').map(cat => {
                    const isSelected = factCategory === cat.id;
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFactCategory(cat.id)}
                        className={`p-2 rounded-xl border text-left text-xs font-mono flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 font-bold shadow'
                            : 'bg-[#141829] border-card-border text-gray-400 hover:border-gray-500'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold uppercase text-gray-300">Fact Key / Title</label>
                <input
                  type="text"
                  required
                  value={factKey}
                  onChange={(e) => setFactKey(e.target.value)}
                  placeholder="e.g. User Name, Preferred Framework, Database Credentials"
                  className="w-full bg-[#141829] border border-card-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-bold uppercase text-gray-300">Memory Content / Value</label>
                <textarea
                  required
                  rows={4}
                  value={factValue}
                  onChange={(e) => setFactValue(e.target.value)}
                  placeholder="e.g. Alex (Senior Engineer, prefers concise responses, TypeScript on frontend, FastAPI backend)"
                  className="w-full bg-[#141829] border border-card-border rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none font-sans leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-[#141829] border border-card-border/60">
                <input
                  type="checkbox"
                  id="pinCheckbox"
                  checked={factPinned}
                  onChange={(e) => setFactPinned(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="pinCheckbox" className="text-xs text-gray-300 font-mono cursor-pointer flex items-center gap-1.5">
                  <Star className={`w-3.5 h-3.5 ${factPinned ? 'text-amber-400 fill-amber-400' : 'text-gray-500'}`} />
                  <span>Pin this fact to the top of memory list</span>
                </label>
              </div>

              <div className="pt-3 border-t border-card-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFactModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#1c2237] hover:bg-[#28314e] text-gray-300 text-xs font-mono transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-gray-950 font-bold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {editingFact ? 'Update Fact' : 'Save Fact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import / Export JSON Modal */}
      {showImportExportModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0d101e] border border-card-border rounded-2xl p-5 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-card-border">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-400" />
                <span>Import Memory Facts Backup (JSON)</span>
              </h3>
              <button onClick={() => setShowImportExportModal(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-mono text-gray-400 block">
                Paste JSON Array of memory facts below:
              </label>
              <textarea
                rows={8}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='[
  {
    "key": "User Name",
    "value": "Alex",
    "category": "user_profile",
    "is_pinned": 1
  }
]'
                className="w-full bg-[#090b12] border border-card-border rounded-xl p-3 font-mono text-xs text-cyan-300 focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>

            {importResult && (
              <div className={`p-3 rounded-xl text-xs font-mono ${
                importResult.success
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}>
                {importResult.message}
              </div>
            )}

            <div className="pt-2 border-t border-card-border flex items-center justify-between">
              <button
                type="button"
                onClick={handleExportJson}
                className="px-3 py-1.5 rounded-xl bg-[#141829] text-xs font-mono text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 cursor-pointer"
              >
                Download Current Backup
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportExportModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-[#1c2237] text-xs font-mono text-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportJson}
                  disabled={!importJsonText.trim()}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs font-mono shadow-md cursor-pointer disabled:opacity-50"
                >
                  Import JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Feedback Toast */}
      {feedbackToast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl shadow-2xl font-mono text-xs flex items-center gap-2 border animate-bounce ${
          feedbackToast.type === 'error'
            ? 'bg-rose-950 border-rose-500 text-rose-200'
            : 'bg-[#121626] border-emerald-500/40 text-emerald-200'
        }`}>
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{feedbackToast.msg}</span>
        </div>
      )}

    </div>
  );
}
