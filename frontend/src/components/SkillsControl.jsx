import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { 
  Puzzle, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  Code, 
  Sparkles, 
  Check, 
  FolderOpen, 
  X, 
  FileCode, 
  ExternalLink,
  ShieldCheck,
  Zap,
  Terminal,
  RefreshCw,
  BookOpen,
  Server,
  Layers,
  Globe,
  Database,
  Cpu,
  Radio,
  Play,
  Copy,
  ChevronRight,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  Power,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

const MCP_PRESETS = [
  {
    id: 'fs',
    name: 'Local Filesystem MCP',
    desc: 'Provides secure read/write directory and file access to workspace paths.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '$HOME'],
    icon: FolderOpen,
    color: 'emerald'
  },
  {
    id: 'fetch',
    name: 'Web Fetch & Research MCP',
    desc: 'Allows autonomous agents to fetch web pages, convert HTML to Markdown, and research APIs.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    icon: Globe,
    color: 'cyan'
  },
  {
    id: 'sqlite',
    name: 'SQLite Database MCP',
    desc: 'Direct schema exploration, table queries, and query planning on local SQLite databases.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path', '$DB_PATH'],
    icon: Database,
    color: 'purple'
  },
  {
    id: 'github',
    name: 'GitHub API MCP',
    desc: 'Search repositories, inspect commits, view pull requests, and manage issues.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    icon: Code,
    color: 'amber'
  }
];

const NATIVE_TOOLS = [
  {
    name: 'read_file / view_file',
    desc: 'Read file contents, inspect code with line slicing and syntax highlighting.',
    category: 'Filesystem',
    sandbox: 'Safe (ReadOnly)',
    icon: FileCode
  },
  {
    name: 'write_to_file / replace_file_content',
    desc: 'Create new files or execute surgical line replacements with diff tracking.',
    category: 'Filesystem',
    sandbox: 'Protected Workspace',
    icon: Edit3
  },
  {
    name: 'run_command (bash)',
    desc: 'Execute commands, compile code, test pipelines, and run background daemons.',
    category: 'Terminal',
    sandbox: 'Sandboxed by Default',
    icon: Terminal
  },
  {
    name: 'grep_search / find_by_name',
    desc: 'Blazing-fast ripgrep pattern search and directory traversal across projects.',
    category: 'Search',
    sandbox: 'Safe (ReadOnly)',
    icon: Search
  },
  {
    name: 'invoke_subagent / define_subagent',
    desc: 'Spawn specialized subagents for research, code review, and parallel tasks.',
    category: 'Orchestration',
    sandbox: 'Isolated Context',
    icon: Cpu
  },
  {
    name: 'web_search / read_url_content',
    desc: 'Live web scraping, search queries, and documentation fetching.',
    category: 'Research',
    sandbox: 'Outbound Network',
    icon: Globe
  }
];

export default function SkillsControl() {
  const { t, isRTL } = useLanguage();
  const [activeHubTab, setActiveHubTab] = useState('skills'); // 'skills' | 'mcp' | 'tools'
  const [systemInfo, setSystemInfo] = useState({ home_dir: '$HOME', db_path: '$DB_PATH' });

  useEffect(() => {
    fetch('/api/system/info')
      .then((r) => r.json())
      .then((info) => setSystemInfo(info))
      .catch(() => {});
  }, []);

  const mcpPresets = useMemo(() =>
    MCP_PRESETS.map((p) => ({
      ...p,
      args: p.args.map((a) => a.replace('$HOME', systemInfo.home_dir).replace('$DB_PATH', systemInfo.db_path))
    })),
    [systemInfo]
  );

  // Skills state
  const [skills, setSkills] = useState([]);
  const [skillsSearch, setSkillsSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [skillContent, setSkillContent] = useState('');
  const [isSavingSkill, setIsSavingSkill] = useState(false);
  const [isSkillsLoading, setIsSkillsLoading] = useState(false);
  const [skillFilter, setSkillFilter] = useState('all'); // 'all' | 'active' | 'disabled' | 'custom' | 'builtin'
  const [togglingSkill, setTogglingSkill] = useState(null);

  // Skill Create Modal
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [skillNameInput, setSkillNameInput] = useState('');
  const [skillContentInput, setSkillContentInput] = useState('');
  const [skillPathInput, setSkillPathInput] = useState('');

  // MCP Servers state
  const [mcpServers, setMcpServers] = useState([]);
  const [isMcpLoading, setIsMcpLoading] = useState(false);
  const [showMcpModal, setShowMcpModal] = useState(false);
  const [mcpNameInput, setMcpNameInput] = useState('');
  const [mcpTransportInput, setMcpTransportInput] = useState('stdio');
  const [mcpCommandInput, setMcpCommandInput] = useState('npx');
  const [mcpArgsInput, setMcpArgsInput] = useState('');
  const [mcpUrlInput, setMcpUrlInput] = useState('');

  // MCP Web Search Tester
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [testSearchResults, setTestSearchResults] = useState(null);
  const [isSearchingMcp, setIsSearchingMcp] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchSkills = async () => {
    setIsSkillsLoading(true);
    try {
      const res = await fetch('/api/memory/skills');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSkills(data);
        if (data.length > 0 && !selectedSkill) {
          loadSkillDetail(data[0]);
        } else if (selectedSkill) {
          const updated = data.find(s => s.name === selectedSkill.name);
          if (updated) setSelectedSkill(prev => ({ ...prev, is_active: updated.is_active }));
        }
      }
    } catch (err) {
      console.error('Failed to load skills:', err);
    } finally {
      setIsSkillsLoading(false);
    }
  };

  const loadSkillDetail = async (skill) => {
    try {
      const res = await fetch(`/api/memory/skills/${encodeURIComponent(skill.name)}`);
      if (res.ok) {
        const detail = await res.json();
        setSelectedSkill({ ...detail, is_active: skill.is_active });
        setSkillContent(detail.content || '');
      } else {
        setSelectedSkill(skill);
        setSkillContent(skill.description || '');
      }
    } catch (e) {
      setSelectedSkill(skill);
      setSkillContent(skill.description || '');
    }
  };

  const handleToggleSkillActive = async (skillName, currentActive) => {
    setTogglingSkill(skillName);
    const newActiveState = !currentActive;
    try {
      const res = await fetch(`/api/memory/skills/${encodeURIComponent(skillName)}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newActiveState })
      });
      if (res.ok) {
        setSkills(prev => prev.map(s => s.name === skillName ? { ...s, is_active: newActiveState } : s));
        if (selectedSkill?.name === skillName) {
          setSelectedSkill(prev => ({ ...prev, is_active: newActiveState }));
        }
        showToast(newActiveState ? `Skill "${skillName}" Activated` : `Skill "${skillName}" Disabled`);
      }
    } catch (err) {
      showToast(`Failed to toggle: ${err.message}`, 'error');
    } finally {
      setTogglingSkill(null);
    }
  };

  const fetchMcpServers = async () => {
    setIsMcpLoading(true);
    try {
      const res = await fetch('/api/mcp/servers');
      const data = await res.json();
      if (Array.isArray(data)) {
        setMcpServers(data);
      }
    } catch (err) {
      console.error('Failed to load MCP servers:', err);
    } finally {
      setIsMcpLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
    fetchMcpServers();
  }, []);

  const handleSaveCurrentSkill = async () => {
    if (!selectedSkill?.name) return;
    setIsSavingSkill(true);
    try {
      const res = await fetch('/api/memory/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedSkill.name,
          content: skillContent,
          target_path: selectedSkill.path || undefined
        })
      });
      if (res.ok) {
        showToast(`Saved skill "${selectedSkill.name}"`);
        fetchSkills();
      }
    } catch (err) {
      showToast(`Failed to save: ${err.message}`, 'error');
    } finally {
      setIsSavingSkill(false);
    }
  };

  const handleOpenCreateSkill = () => {
    setSkillNameInput('');
    setSkillPathInput('');
    setSkillContentInput(`---
name: custom-workflow
description: Enter a clear description of what this autonomous capability provides.
---

# Instructions
1. Step one of workflow.
2. Step two of workflow.
`);
    setShowSkillModal(true);
  };

  const handleModalSaveSkill = async (e) => {
    e.preventDefault();
    if (!skillNameInput.trim() || !skillContentInput.trim()) return;

    try {
      const res = await fetch('/api/memory/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: skillNameInput.trim(),
          content: skillContentInput,
          target_path: skillPathInput || undefined
        })
      });
      if (res.ok) {
        setShowSkillModal(false);
        showToast('Skill created successfully');
        await fetchSkills();
      }
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteSkill = async (skillName) => {
    if (!confirm(`Are you sure you want to delete skill "${skillName}"?`)) return;
    try {
      const res = await fetch(`/api/memory/skills/${encodeURIComponent(skillName)}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Deleted skill "${skillName}"`);
        if (selectedSkill?.name === skillName) setSelectedSkill(null);
        fetchSkills();
      }
    } catch (err) {
      showToast(`Failed to delete: ${err.message}`, 'error');
    }
  };

  const handleAddMcpServer = async (e) => {
    if (e) e.preventDefault();
    if (!mcpNameInput.trim()) return;

    let parsedArgs = [];
    if (mcpArgsInput.trim()) {
      try {
        parsedArgs = JSON.parse(mcpArgsInput);
      } catch {
        parsedArgs = mcpArgsInput.split(' ').filter(Boolean);
      }
    }

    try {
      const res = await fetch('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mcpNameInput.trim(),
          transport: mcpTransportInput,
          command: mcpCommandInput.trim(),
          args: parsedArgs,
          url: mcpUrlInput.trim()
        })
      });
      if (res.ok) {
        showToast(`Connected MCP Server "${mcpNameInput}"`);
        setShowMcpModal(false);
        setMcpNameInput('');
        setMcpArgsInput('');
        fetchMcpServers();
      }
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    }
  };

  const handleConnectPreset = async (preset) => {
    try {
      const res = await fetch('/api/mcp/servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: preset.name,
          transport: preset.transport,
          command: preset.command,
          args: preset.args,
          url: ''
        })
      });
      if (res.ok) {
        showToast(`Connected preset "${preset.name}"`);
        fetchMcpServers();
      }
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    }
  };

  const handleDeleteMcpServer = async (serverId, name) => {
    if (!confirm(`Disconnect MCP Server "${name}"?`)) return;
    try {
      const res = await fetch(`/api/mcp/servers/${serverId}`, { method: 'DELETE' });
      if (res.ok) {
        showToast(`Disconnected "${name}"`);
        fetchMcpServers();
      }
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
    }
  };

  const handleTestMcpSearch = async (e) => {
    if (e) e.preventDefault();
    if (!testSearchQuery.trim()) return;
    setIsSearchingMcp(true);
    try {
      const res = await fetch(`/api/mcp/search?q=${encodeURIComponent(testSearchQuery)}`);
      const data = await res.json();
      setTestSearchResults(data.results || []);
    } catch (err) {
      showToast(`Search failed: ${err.message}`, 'error');
    } finally {
      setIsSearchingMcp(false);
    }
  };

  // Counts
  const activeCount = useMemo(() => skills.filter(s => s.is_active !== false).length, [skills]);
  const disabledCount = useMemo(() => skills.filter(s => s.is_active === false).length, [skills]);

  // Filter skills
  const filteredSkills = useMemo(() => {
    return skills.filter(s => {
      const query = skillsSearch.toLowerCase().trim();
      const matchesSearch = !query ||
        s.name.toLowerCase().includes(query) ||
        (s.description || '').toLowerCase().includes(query);
      
      const isBuiltin = s.path?.includes('gemini') || s.path?.includes('builtin');
      const isActive = s.is_active !== false;

      if (skillFilter === 'active') return matchesSearch && isActive;
      if (skillFilter === 'disabled') return matchesSearch && !isActive;
      if (skillFilter === 'custom') return matchesSearch && !isBuiltin;
      if (skillFilter === 'builtin') return matchesSearch && isBuiltin;

      return matchesSearch;
    });
  }, [skills, skillsSearch, skillFilter]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0c14] text-gray-100 font-sans overflow-hidden">
      
      {/* 1. TOP HEADER BANNER */}
      <div className="p-4 md:p-5 border-b border-card-border/80 bg-gradient-to-r from-[#101424] via-[#0d101c] to-[#0a0c16] flex items-center justify-between flex-wrap gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 shadow-md shadow-purple-500/10">
            <Puzzle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
              <span>Skills & MCP Tools Hub</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                {activeCount} Active Skills
              </span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Activate or disable agent capability modules, configure Model Context Protocol (MCP) servers, and inspect native tools.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchSkills();
              fetchMcpServers();
            }}
            className="p-2 rounded-xl bg-[#151928] hover:bg-[#1f253c] text-gray-400 hover:text-white border border-card-border transition-colors cursor-pointer"
            title="Refresh All Skills & MCP Servers"
          >
            <RefreshCw className={`w-4 h-4 ${isSkillsLoading || isMcpLoading ? 'animate-spin text-purple-400' : ''}`} />
          </button>

          {activeHubTab === 'skills' && (
            <button
              onClick={handleOpenCreateSkill}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-purple-600/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Skill</span>
            </button>
          )}

          {activeHubTab === 'mcp' && (
            <button
              onClick={() => {
                setMcpNameInput('');
                setMcpArgsInput('');
                setShowMcpModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-cyan-600/25 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Connect MCP Server</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. SUBNAV TABS BAR */}
      <div className="px-5 py-2 border-b border-card-border/60 bg-[#0d101a] flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2">
          {[
            { id: 'skills', label: 'Agent Skills (SKILL.md)', icon: Puzzle, count: `${activeCount}/${skills.length} Active`, color: 'purple' },
            { id: 'mcp', label: 'Model Context Protocol (MCP)', icon: Server, count: `${mcpServers.length} Servers`, color: 'cyan' },
            { id: 'tools', label: 'Built-in Native Tools', icon: Cpu, count: `${NATIVE_TOOLS.length} Core`, color: 'emerald' },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeHubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveHubTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#181d32] text-white border border-purple-500/50 shadow-md'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#131726]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-purple-400' : 'text-gray-500'}`} />
                <span>{tab.label}</span>
                <span className={`text-[10px] px-2 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-purple-500/30 text-purple-200' : 'bg-card-border/40 text-gray-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="text-[11px] font-mono text-gray-400 hidden sm:flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Active Skills Injected into Agents</span>
        </div>
      </div>

      {/* 3. MAIN TAB CONTENT */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* TAB 1: AGENT SKILLS WITH ACTIVATION TOGGLE & SPLIT-VIEW INSPECTOR */}
        {activeHubTab === 'skills' && (
          <div className="flex-1 flex overflow-hidden">
            
            {/* Left 42%: Skills List with Toggle Switch */}
            <div className="w-full lg:w-[440px] border-r border-card-border/80 bg-[#0c0e18] flex flex-col shrink-0 overflow-hidden">
              
              {/* Search & Filter */}
              <div className="p-3 border-b border-card-border/60 bg-[#0f1220] space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={skillsSearch}
                    onChange={(e) => setSkillsSearch(e.target.value)}
                    placeholder={`Search ${skills.length} skills...`}
                    className="w-full bg-[#141829] border border-card-border rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono"
                  />
                  {skillsSearch && (
                    <button
                      onClick={() => setSkillsSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 text-[11px] font-mono flex-wrap">
                  {[
                    { id: 'all', label: `All (${skills.length})` },
                    { id: 'active', label: `Active (${activeCount})` },
                    { id: 'disabled', label: `Disabled (${disabledCount})` },
                    { id: 'custom', label: 'Custom Pi' },
                    { id: 'builtin', label: 'Built-in' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setSkillFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        skillFilter === tab.id
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#181d30]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skills Scroll List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredSkills.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-xs font-mono">
                    No skills matched your search filter.
                  </div>
                ) : (
                  filteredSkills.map(skill => {
                    const isSelected = selectedSkill?.name === skill.name;
                    const isBuiltin = skill.path?.includes('gemini') || skill.path?.includes('builtin');
                    const isActive = skill.is_active !== false;
                    const isToggling = togglingSkill === skill.name;

                    return (
                      <div
                        key={skill.name}
                        onClick={() => loadSkillDetail(skill)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                          isSelected
                            ? 'bg-[#181d32] border-purple-500/70 shadow-lg shadow-purple-500/10'
                            : isActive
                            ? 'bg-[#101322] border-card-border/80 hover:bg-[#141829] hover:border-gray-600'
                            : 'bg-[#090b12] border-white/5 opacity-60 hover:opacity-100 hover:bg-[#101320]'
                        }`}
                      >
                        {/* Title Bar & Toggle Switch */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 truncate">
                            <Puzzle className={`w-3.5 h-3.5 shrink-0 ${
                              isActive ? (isSelected ? 'text-purple-400' : 'text-emerald-400') : 'text-gray-600'
                            }`} />
                            <span className={`font-bold text-xs font-mono truncate ${
                              isActive ? 'text-white' : 'text-gray-400 line-through'
                            }`}>
                              {skill.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* Source Pill */}
                            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                              isBuiltin
                                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                                : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                            }`}>
                              {isBuiltin ? 'Built-in' : 'Custom'}
                            </span>

                            {/* Activation Toggle Switch Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleSkillActive(skill.name, isActive)}
                              disabled={isToggling}
                              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                isActive ? 'bg-emerald-500' : 'bg-gray-700'
                              }`}
                              title={isActive ? 'Click to Disable Skill' : 'Click to Activate Skill'}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                  isActive ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-[11px] text-gray-300 font-sans line-clamp-2 leading-relaxed">
                          {skill.description}
                        </p>

                        {/* Status Footer */}
                        <div className="pt-1 flex items-center justify-between text-[9px] font-mono border-t border-white/5">
                          <span className="truncate max-w-[200px] text-gray-500">{skill.path}</span>
                          
                          <span className={`font-bold flex items-center gap-1 ${
                            isActive ? 'text-emerald-400' : 'text-gray-500'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                            <span>{isActive ? 'Active' : 'Disabled'}</span>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right 58%: Skill Markdown Inspector & Editor */}
            <div className="flex-1 flex flex-col bg-[#090b12] overflow-hidden">
              {selectedSkill ? (
                <>
                  {/* Inspector Header with Status Toggle */}
                  <div className="p-3.5 border-b border-card-border/80 bg-[#0e111d] flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className={`p-2 rounded-xl border shrink-0 ${
                        selectedSkill.is_active !== false
                          ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                          : 'bg-gray-800/40 border-gray-700 text-gray-500'
                      }`}>
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-xs text-white font-mono truncate">{selectedSkill.name}</h3>
                          <span className={`text-[9px] font-mono px-2 py-0.2 rounded-full border ${
                            selectedSkill.is_active !== false
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold'
                              : 'bg-gray-700/30 text-gray-400 border-gray-600'
                          }`}>
                            {selectedSkill.is_active !== false ? '● Active' : '○ Disabled'}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono truncate">{selectedSkill.path}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Active Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleSkillActive(selectedSkill.name, selectedSkill.is_active !== false)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                          selectedSkill.is_active !== false
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{selectedSkill.is_active !== false ? 'Active' : 'Disabled'}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteSkill(selectedSkill.name)}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                        title="Delete Skill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={handleSaveCurrentSkill}
                        disabled={isSavingSkill}
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-bold text-xs font-mono shadow-md shadow-purple-600/20 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSavingSkill ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>Save SKILL.md</span>
                      </button>
                    </div>
                  </div>

                  {/* Editor Body */}
                  <div className="flex-1 p-4 overflow-hidden flex flex-col">
                    <textarea
                      value={skillContent}
                      onChange={(e) => setSkillContent(e.target.value)}
                      className="w-full flex-1 bg-[#0d101b] border border-card-border rounded-2xl p-4 font-mono text-xs text-gray-200 focus:outline-none focus:border-purple-500 resize-none leading-relaxed select-text"
                      placeholder="# Skill Definition Markdown..."
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-500 space-y-3">
                  <Puzzle className="w-10 h-10 text-gray-600 animate-pulse" />
                  <div className="text-xs font-mono">Select a skill from the list on the left to inspect, toggle active status, and edit its instructions.</div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: MODEL CONTEXT PROTOCOL (MCP) SERVERS */}
        {activeHubTab === 'mcp' && (
          <div className="flex-1 flex flex-col overflow-y-auto p-4 md:p-6 space-y-6">
            
            {/* Active MCP Servers Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold font-mono uppercase text-gray-300 flex items-center gap-2">
                  <Server className="w-4 h-4 text-cyan-400" />
                  <span>Connected MCP Servers ({mcpServers.length})</span>
                </h3>
                <span className="text-[11px] font-mono text-cyan-400">STDIO / SSE Protocol Active</span>
              </div>

              {mcpServers.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-[#0f121e] border border-card-border space-y-2">
                  <Server className="w-8 h-8 text-gray-500 mx-auto" />
                  <div className="text-xs text-gray-300 font-bold">No MCP Servers Connected</div>
                  <div className="text-[11px] text-gray-500">Connect a preset below or click 'Connect MCP Server' to link custom tool protocols.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mcpServers.map(srv => (
                    <div
                      key={srv.id}
                      className="p-4 rounded-2xl border border-card-border/80 bg-[#0f121e] hover:bg-[#121626] transition-all space-y-3 shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
                            <Server className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <h4 className="font-bold text-xs text-white font-mono truncate">{srv.name}</h4>
                            <div className="text-[10px] text-gray-400 font-mono">Transport: {srv.transport}</div>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[9px] font-mono font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Active</span>
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-[#090b12] border border-white/5 space-y-1 font-mono text-[10px] text-gray-300 truncate">
                        <div>Command: <code className="text-cyan-300">{srv.command || 'npx'}</code></div>
                        <div className="truncate text-gray-400">Args: {srv.args}</div>
                        {srv.url && <div className="text-purple-300 truncate">URL: {srv.url}</div>}
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-gray-500 border-t border-white/5">
                        <span>ID: {srv.id}</span>
                        <button
                          onClick={() => handleDeleteMcpServer(srv.id, srv.name)}
                          className="text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Disconnect</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Connect Presets */}
            <div className="space-y-3 pt-2 border-t border-card-border/60">
              <h3 className="text-xs font-bold font-mono uppercase text-gray-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Instant MCP Server Presets</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {mcpPresets.map(preset => {
                  const Icon = preset.icon;
                  const isConnected = mcpServers.some(s => s.name === preset.name);

                  return (
                    <div
                      key={preset.id}
                      className="p-4 rounded-2xl border border-card-border/80 bg-[#0f121e] flex flex-col justify-between space-y-3 shadow-md hover:border-gray-500 transition-all"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                            <Icon className="w-4 h-4" />
                          </div>
                          <h4 className="font-bold text-xs text-white font-mono">{preset.name}</h4>
                        </div>
                        <p className="text-[11px] text-gray-300 font-sans leading-relaxed">
                          {preset.desc}
                        </p>
                      </div>

                      <button
                        onClick={() => handleConnectPreset(preset)}
                        disabled={isConnected}
                        className={`w-full py-1.5 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isConnected
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 cursor-default'
                            : 'bg-[#181d30] hover:bg-purple-600 text-gray-200 hover:text-white border border-card-border'
                        }`}
                      >
                        {isConnected ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Connected</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Connect Preset</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live MCP Tool Tester */}
            <div className="p-4 rounded-2xl bg-[#0f121e] border border-cyan-500/30 space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-xs text-white font-mono uppercase">
                    Live MCP Web Search & Tool Tester
                  </span>
                </div>
                <span className="text-[10px] font-mono text-gray-400">DuckDuckGo / MCP Search Provider</span>
              </div>

              <form onSubmit={handleTestMcpSearch} className="flex items-center gap-2">
                <input
                  type="text"
                  value={testSearchQuery}
                  onChange={(e) => setTestSearchQuery(e.target.value)}
                  placeholder="Test live MCP search tool (e.g. 'FastAPI lifespan events documentation')..."
                  className="flex-1 bg-[#131728] border border-card-border rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-sans"
                />
                <button
                  type="submit"
                  disabled={isSearchingMcp || !testSearchQuery.trim()}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs font-mono flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSearchingMcp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Execute Search</span>
                </button>
              </form>

              {testSearchResults && (
                <div className="p-3 rounded-xl bg-[#090b12] border border-white/5 space-y-2 text-xs max-h-52 overflow-y-auto font-sans">
                  <div className="font-mono text-[10px] text-gray-400">
                    Results returned for: <code className="text-cyan-300">{testSearchQuery}</code>
                  </div>
                  {testSearchResults.map((res, i) => (
                    <div key={i} className="p-2 rounded-lg bg-[#121522] border border-white/5 space-y-0.5">
                      <a href={res.url} target="_blank" rel="noreferrer" className="font-bold text-cyan-300 hover:underline flex items-center gap-1 text-[11px]">
                        <span>{res.title}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                      <p className="text-[11px] text-gray-300 leading-relaxed">{res.snippet}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: BUILT-IN SYSTEM TOOLS */}
        {activeHubTab === 'tools' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-card-border">
              <h3 className="text-xs font-bold font-mono uppercase text-gray-300 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <span>Native Autonomous Agent Tools ({NATIVE_TOOLS.length})</span>
              </h3>
              <span className="text-[11px] font-mono text-emerald-400">Built-in Python & Bash Toolchain</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {NATIVE_TOOLS.map((tool, idx) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-card-border/80 bg-[#0f121e] hover:bg-[#121626] transition-all space-y-3 shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-white font-mono">{tool.name}</h4>
                          <span className="text-[10px] text-gray-500 font-mono">{tool.category}</span>
                        </div>
                      </div>

                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                        {tool.sandbox}
                      </span>
                    </div>

                    <p className="text-xs text-gray-300 font-sans leading-relaxed">
                      {tool.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* CREATE SKILL MODAL */}
      {showSkillModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0d101e] border border-card-border rounded-2xl p-5 space-y-4 shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-card-border">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Puzzle className="w-4 h-4 text-purple-400" />
                <span>Create New Agent Skill</span>
              </h3>
              <button onClick={() => setShowSkillModal(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleModalSaveSkill} className="space-y-4 flex-1 flex flex-col overflow-hidden">
              <div className="space-y-1">
                <label className="text-[11px] font-mono uppercase text-gray-400">Skill Name (Slug)</label>
                <input
                  type="text"
                  required
                  value={skillNameInput}
                  onChange={(e) => setSkillNameInput(e.target.value)}
                  placeholder="e.g. redis-cache-optimizer or playwright-testing"
                  className="w-full bg-[#141829] border border-card-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="space-y-1 flex-1 flex flex-col overflow-hidden">
                <label className="text-[11px] font-mono uppercase text-gray-400">
                  Skill Markdown Definition (SKILL.md)
                </label>
                <textarea
                  required
                  value={skillContentInput}
                  onChange={(e) => setSkillContentInput(e.target.value)}
                  className="w-full flex-1 bg-[#090b10] border border-card-border rounded-xl p-3 text-xs text-gray-200 focus:outline-none focus:border-purple-500 resize-none font-mono leading-relaxed min-h-[250px]"
                />
              </div>

              <div className="pt-2 border-t border-card-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSkillModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#1c2237] text-gray-300 text-xs font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Create Skill</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONNECT MCP MODAL */}
      {showMcpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d101e] border border-card-border rounded-2xl p-5 space-y-4 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-2 border-b border-card-border">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>Connect Custom MCP Server</span>
              </h3>
              <button onClick={() => setShowMcpModal(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMcpServer} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-mono text-gray-400 uppercase">Server Name</label>
                <input
                  type="text"
                  required
                  value={mcpNameInput}
                  onChange={(e) => setMcpNameInput(e.target.value)}
                  placeholder="e.g. Postgres MCP Server"
                  className="w-full bg-[#141829] border border-card-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-mono text-gray-400 uppercase">Transport</label>
                  <select
                    value={mcpTransportInput}
                    onChange={(e) => setMcpTransportInput(e.target.value)}
                    className="w-full bg-[#141829] border border-card-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 cursor-pointer"
                  >
                    <option value="stdio">stdio (Local Command)</option>
                    <option value="sse">sse (HTTP Server-Sent Events)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-mono text-gray-400 uppercase">Command</label>
                  <input
                    type="text"
                    value={mcpCommandInput}
                    onChange={(e) => setMcpCommandInput(e.target.value)}
                    placeholder="npx / python / node"
                    className="w-full bg-[#141829] border border-card-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-gray-400 uppercase">Arguments (JSON or space-separated)</label>
                <input
                  type="text"
                  value={mcpArgsInput}
                  onChange={(e) => setMcpArgsInput(e.target.value)}
                  placeholder='["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost/db"]'
                  className="w-full bg-[#141829] border border-card-border rounded-xl px-3 py-2 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {mcpTransportInput === 'sse' && (
                <div className="space-y-1">
                  <label className="text-xs font-mono text-gray-400 uppercase">SSE Server URL</label>
                  <input
                    type="text"
                    value={mcpUrlInput}
                    onChange={(e) => setMcpUrlInput(e.target.value)}
                    placeholder="http://localhost:3001/sse"
                    className="w-full bg-[#141829] border border-card-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              )}

              <div className="pt-2 border-t border-card-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowMcpModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#1c2237] text-gray-300 text-xs font-mono cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md cursor-pointer font-mono"
                >
                  Connect Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Feedback Toast */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl shadow-2xl font-mono text-xs flex items-center gap-2 border animate-bounce ${
          toastMessage.type === 'error'
            ? 'bg-rose-950 border-rose-500 text-rose-200'
            : 'bg-[#121626] border-purple-500/40 text-purple-200'
        }`}>
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>{toastMessage.msg}</span>
        </div>
      )}

    </div>
  );
}
