import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard,
  MessageSquare, 
  Users, 
  FileText, 
  BrainCircuit, 
  Bot, 
  History, 
  Plus, 
  Trash2, 
  Clock, 
  Sparkles, 
  Zap, 
  FolderGit2, 
  Puzzle, 
  Database, 
  Swords, 
  BookOpen,
  Activity,
  Target
} from 'lucide-react';
import { sessionStreamManager } from '../services/sessionStreamManager';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  agents = [], 
  activeAgentId, 
  setActiveAgentId,
  onSelectAgent,
  activeModel,
  documentCount = 0,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onDeleteSession,
  onNewSession
}) {
  const { t } = useLanguage();
  const [sessionSearch, setSessionSearch] = useState('');
  const [, setStreamTick] = useState(0);

  useEffect(() => {
    const unsub = sessionStreamManager.subscribe(() => {
      setStreamTick(t => t + 1);
    });
    return () => unsub();
  }, []);

  const tabs = [
    { id: 'overview', label: t('nav.overview', 'Overview'), icon: LayoutDashboard, badge: null },
    { id: 'chat', label: t('nav.chat', 'Chat Workspace'), icon: MessageSquare, badge: null },
    { id: 'projects', label: t('nav.projects', 'Projects & Code'), icon: FolderGit2, badge: null },
    { id: 'finetuning', label: t('nav.finetuning', 'Fine-Tuning Studio'), icon: Target, badge: null },
    { id: 'studio', label: t('nav.agents', 'Agent Studio'), icon: Users, badge: agents.length },
    { id: 'debate', label: t('nav.debate', 'Agent Debate'), icon: Swords, badge: null },
    { id: 'skills', label: t('nav.skills', 'Skills & Tools'), icon: Puzzle, badge: null },
    { id: 'docs', label: t('nav.library', 'Library'), icon: BookOpen, badge: documentCount || null },
    { id: 'memory', label: t('nav.memory', 'Memory & Facts'), icon: BrainCircuit, badge: null },
    { id: 'resources', label: t('nav.resources', 'System Resources'), icon: Activity, badge: null },
  ];

  const activeAgent = agents.find(a => a.id === activeAgentId) || agents[0];
  const isAgentNativeModel = activeModel?.model === activeAgent?.model_id;

  const filteredSessions = sessions.filter(s => 
    (s.title || '').toLowerCase().includes(sessionSearch.toLowerCase())
  );

  return (
    <aside className="w-64 border-r border-card-border bg-[#0d0f17] flex flex-col justify-between select-none shrink-0 overflow-hidden">
      {/* Top Section */}
      <div className="p-3 space-y-4 flex-1 flex flex-col overflow-hidden">
        {/* Navigation Tabs */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 font-mono">
            {t('nav.navigation', 'Navigation')}
          </div>
          <nav className="space-y-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#151822]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-gray-500'}`} />
                    <span>{tab.label}</span>
                  </div>
                  {tab.badge !== null && tab.badge > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold ${
                      isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-card-border text-gray-400'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Chat History & Sessions Section */}
        <div className="flex-1 flex flex-col overflow-hidden pt-2 border-t border-card-border/60">
          <div className="flex items-center justify-between px-3 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 font-mono flex items-center gap-1">
              <History className="w-3 h-3 text-gray-400" />
              {t('chat.sessions', 'Chat History')}
            </span>
            <button
              onClick={onNewSession}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-0.5 transition-colors cursor-pointer"
              title="Start New Chat"
            >
              <Plus className="w-3 h-3" />
              <span>{t('chat.new_chat', 'New Chat')}</span>
            </button>
          </div>

          {/* Session List */}
          <div className="space-y-1 flex-1 overflow-y-auto pr-1">
            {filteredSessions.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-gray-500 font-mono">
                No past sessions yet.
              </div>
            ) : (
              filteredSessions.map((s) => {
                const isCurrent = activeSessionId === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSelectSession(s.id);
                      if (activeTab !== 'chat') setActiveTab('chat');
                    }}
                    className={`group w-full text-left px-2.5 py-1.5 rounded-lg text-xs cursor-pointer flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-[#1a1f2e] border border-emerald-500/30 text-emerald-200 font-medium'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#141720]'
                    }`}
                  >
                    <div className="truncate mr-2">
                      <div className="truncate text-xs flex items-center gap-1.5">
                        <span className="truncate">{s.title || 'Untitled Session'}</span>
                        {sessionStreamManager.isSessionStreaming(s.id) && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Agent generating in background" />
                        )}
                      </div>
                      <div className="text-[9px] text-gray-500 font-mono flex items-center gap-1.5">
                        <span>{new Date(s.updated_at || s.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {sessionStreamManager.isSessionStreaming(s.id) && (
                          <span className="text-emerald-400 font-bold">• working...</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all shrink-0"
                      title="Delete session"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Quick Agent Switcher for Main Chat */}
        <div className="pt-2 border-t border-card-border/60 shrink-0">
          <div className="flex items-center justify-between px-3 pb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 font-mono">
              {t('nav.active_agents', 'Active Agent')} ({agents.length})
            </span>
            {isAgentNativeModel ? (
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active
              </span>
            ) : (
              <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                Overridden
              </span>
            )}
          </div>

          {/* All Agents List - No scroll, shows all agents */}
          <div className="space-y-1">
            {agents.map((agent) => {
              const isSelected = activeAgentId === agent.id;
              const matchesActiveModel = activeModel?.model === agent.model_id;
              
              return (
                <button
                  key={agent.id}
                  onClick={() => {
                    if (onSelectAgent) {
                      onSelectAgent(agent.id);
                    } else if (setActiveAgentId) {
                      setActiveAgentId(agent.id);
                    }
                    if (activeTab !== 'chat') setActiveTab('chat');
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-[#181d2a] border border-card-border text-gray-100 font-medium shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#141720]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-base leading-none shrink-0">{agent.avatar || '🤖'}</span>
                    <div className="truncate">
                      <div className="truncate text-xs flex items-center gap-1.5">
                        <span className="truncate">{agent.name}</span>
                        {isSelected && !matchesActiveModel && (
                          <span className="text-[9px] font-mono text-gray-400 px-1 rounded bg-[#10131d] border border-white/5 shrink-0">
                            custom
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-gray-500 truncate font-mono">
                        {agent.model_id}
                      </div>
                    </div>
                  </div>

                  {/* Status Indicator Pill */}
                  {isSelected && (
                    matchesActiveModel ? (
                      <span 
                        className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 shrink-0 ml-1" 
                        title="Agent running on assigned model"
                      />
                    ) : (
                      <span 
                        className="w-2 h-2 rounded-full bg-gray-500 border border-gray-400/40 shrink-0 ml-1" 
                        title="Using custom model override"
                      />
                    )
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Status / Summary */}
      <div className="p-3 border-t border-card-border bg-[#0b0c13]/50">
        <div className="p-2 rounded-lg bg-[#12151e] border border-card-border/60 text-xs">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-sm">{activeAgent?.avatar || '⚡'}</span>
              <span className="font-semibold text-gray-200 truncate">{activeAgent?.name}</span>
            </div>
            {isAgentNativeModel ? (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Native
              </span>
            ) : (
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-gray-500/10 text-gray-400 border border-gray-500/20">
                Custom Model
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 line-clamp-1">
            Engine: {activeModel?.model} {isAgentNativeModel ? '' : `(Default: ${activeAgent?.model_id})`}
          </p>
        </div>
      </div>
    </aside>
  );
}
