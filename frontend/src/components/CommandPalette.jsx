import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Bot, 
  FileText, 
  Zap, 
  MessageSquare, 
  BrainCircuit, 
  X,
  ArrowRight
} from 'lucide-react';

export default function CommandPalette({ 
  isOpen, 
  onClose, 
  agents = [], 
  models = {}, 
  onSelectAgent, 
  onSelectModel,
  onNavigateTab 
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(true);
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredAgents = agents.filter(a => 
    a.name.toLowerCase().includes(query.toLowerCase()) || 
    a.role.toLowerCase().includes(query.toLowerCase())
  );

  const filteredModels = (models?.ollama_models || []).filter(m => 
    m.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-24 p-4">
      <div className="w-full max-w-lg glass-dropdown rounded-2xl border border-card-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-card-border gap-2.5">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, summon an agent, or switch model..."
            className="w-full bg-transparent text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none font-sans"
          />
          <kbd className="text-[10px] font-mono bg-card-border px-1.5 py-0.5 rounded text-gray-400">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-3">
          {/* Quick Actions */}
          <div>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 font-mono">
              Quick Actions
            </div>
            <div className="space-y-0.5">
              {[
                { label: 'Go to Workspace Chat', tab: 'chat', icon: MessageSquare },
                { label: 'Open Agent Studio', tab: 'studio', icon: Bot },
                { label: 'Open Documents & Multi-Agent Debate', tab: 'docs', icon: FileText },
                { label: 'Manage Memory & AGENTS.md Rules', tab: 'memory', icon: BrainCircuit },
              ].map(action => (
                <button
                  key={action.tab}
                  onClick={() => {
                    onNavigateTab(action.tab);
                    onClose();
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-300 hover:text-gray-100 hover:bg-card-border/60 flex items-center justify-between transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <action.icon className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-400" />
                    <span>{action.label}</span>
                  </div>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity" />
                </button>
              ))}
            </div>
          </div>

          {/* Agents */}
          {filteredAgents.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 font-mono">
                Agents
              </div>
              <div className="space-y-0.5">
                {filteredAgents.map(agent => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      onSelectAgent(agent.id);
                      onNavigateTab('chat');
                      onClose();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-300 hover:text-gray-100 hover:bg-emerald-500/10 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{agent.avatar}</span>
                      <div>
                        <div className="font-medium text-gray-200">{agent.name}</div>
                        <div className="text-[10px] text-gray-500">{agent.role}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 opacity-0 group-hover:opacity-100">Select</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Models */}
          {filteredModels.length > 0 && (
            <div>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 font-mono">
                Switch Local Model
              </div>
              <div className="space-y-0.5">
                {filteredModels.map(model => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onSelectModel(model.id, 'ollama');
                      onClose();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-gray-300 hover:text-gray-100 hover:bg-indigo-500/10 flex items-center justify-between transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      <div>
                        <div className="font-mono text-xs text-gray-200">{model.name}</div>
                        <div className="text-[10px] text-gray-500">{model.parameter_size} • {model.family}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-400 opacity-0 group-hover:opacity-100">Activate</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
