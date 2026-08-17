import React, { useState, useRef, useEffect } from 'react';
import { 
  Users, 
  Sparkles, 
  Play, 
  CheckCircle2, 
  MessageSquare, 
  ChevronRight, 
  ShieldAlert, 
  Crown, 
  UserCheck, 
  History, 
  Plus, 
  Send, 
  MessageCircle, 
  HelpCircle, 
  Clock, 
  RotateCcw, 
  Square, 
  Zap, 
  Globe, 
  ArrowLeft, 
  User, 
  Download,
  Trash2,
  FileText,
  Loader2,
  Swords
} from 'lucide-react';

const PRESET_ROLES = [
  "Executive Moderator & Synthesizer",
  "Lead Proponent & Solution Architect",
  "Devil's Advocate & Critical Skeptic",
  "Security & Vulnerability Auditor",
  "Performance & Latency Optimizer",
  "Cost & Infrastructure Analyst",
  "Product & User Experience Champion"
];

export default function AgentDebate({ 
  documents = [], 
  agents = []
}) {
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const [leaderId, setLeaderId] = useState(null);
  const [rolesMap, setRolesMap] = useState({});
  const [topic, setTopic] = useState('');
  const [humanGuidance, setHumanGuidance] = useState('');
  const [rounds, setRounds] = useState(2);

  // Debates List & Persistence
  const [discussions, setDiscussions] = useState([]);
  const [activeDiscussionId, setActiveDiscussionId] = useState(null);
  const [activeDiscussionData, setActiveDiscussionData] = useState(null);
  const [viewMode, setViewMode] = useState('config'); // 'config' | 'chamber'

  // Live Stream State
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamTurns, setStreamTurns] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [finalSynthesis, setFinalSynthesis] = useState('');

  // Human Live Intervention in Chamber
  const [interventionInput, setInterventionInput] = useState('');
  const [targetInterventionAgentId, setTargetInterventionAgentId] = useState('leader');

  const streamEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  const fetchDiscussions = async () => {
    try {
      const res = await fetch('/api/chat/discussions');
      const data = await res.json();
      if (Array.isArray(data)) {
        setDiscussions(data);
      }
    } catch (err) {
      console.error('Failed to load discussions:', err);
    }
  };

  useEffect(() => {
    fetchDiscussions();
  }, []);

  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamTurns, currentTurn, finalSynthesis]);

  // Set default leader and roles when agents are selected
  useEffect(() => {
    if (selectedAgentIds.length > 0) {
      if (!leaderId || !selectedAgentIds.includes(leaderId)) {
        setLeaderId(selectedAgentIds[0]);
      }
      setRolesMap(prev => {
        const next = { ...prev };
        selectedAgentIds.forEach((id, idx) => {
          if (!next[id]) {
            next[id] = PRESET_ROLES[idx % PRESET_ROLES.length];
          }
        });
        return next;
      });
    } else {
      setLeaderId(null);
    }
  }, [selectedAgentIds]);

  const handleSelectPastDiscussion = async (disc) => {
    if (isStreaming) {
      handleStopDebate();
    }

    setActiveDiscussionId(disc.id);
    setViewMode('chamber');
    try {
      const res = await fetch(`/api/chat/discussions/${disc.id}`);
      const data = await res.json();
      setActiveDiscussionData(data);
      
      let parsedTranscript = [];
      try {
        parsedTranscript = JSON.parse(data.transcript || '[]');
      } catch (e) {
        parsedTranscript = [];
      }
      setStreamTurns(parsedTranscript);
      setFinalSynthesis(data.summary || '');
      setTopic(data.topic || '');
      setCurrentRound(data.rounds || 2);
    } catch (err) {
      console.error('Failed to load discussion details:', err);
    }
  };

  const handleDeleteDiscussion = async (e, id) => {
    e.stopPropagation();
    if (confirm('Delete this debate session?')) {
      try {
        await fetch(`/api/chat/discussions/${id}`, { method: 'DELETE' });
        if (activeDiscussionId === id) {
          handleStartNewDebate();
        }
        fetchDiscussions();
      } catch (err) {
        console.error('Failed to delete discussion:', err);
      }
    }
  };

  const handleStopDebate = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setCurrentTurn(null);
    fetch('/api/chat/discussions/reset-stuck', { method: 'POST' }).catch(() => {});
    fetchDiscussions();
  };

  const handleStartNewDebate = () => {
    if (isStreaming) {
      handleStopDebate();
    }
    setActiveDiscussionId(null);
    setActiveDiscussionData(null);
    setStreamTurns([]);
    setFinalSynthesis('');
    setCurrentTurn(null);
    setViewMode('config');
  };

  const handleLaunchDebate = async (e) => {
    e?.preventDefault();
    const effectiveTopic = topic.trim() || humanGuidance.trim() || (selectedDocIds.length > 0 ? "Analyze, critique, and synthesize insights from the attached documents" : "");
    if (!effectiveTopic || selectedAgentIds.length < 1) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsStreaming(true);
    setViewMode('chamber');
    setStreamTurns([]);
    setCurrentTurn(null);
    setFinalSynthesis('');
    setActiveDiscussionId(null);
    setTopic(effectiveTopic);

    try {
      const response = await fetch('/api/chat/discussion/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          title: effectiveTopic.slice(0, 45),
          topic: effectiveTopic,
          agent_ids: selectedAgentIds,
          document_ids: selectedDocIds,
          leader_id: leaderId,
          roles_map: rolesMap,
          rounds: rounds,
          human_guidance: humanGuidance.trim() || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          const jsonStr = line.replace('data: ', '').trim();
          if (jsonStr === '[DONE]') break;

          try {
            const ev = JSON.parse(jsonStr);

            if (ev.type === 'start') {
              if (ev.discussion_id) setActiveDiscussionId(ev.discussion_id);
            } else if (ev.type === 'round_start') {
              setCurrentRound(ev.round);
            } else if (ev.type === 'turn_start') {
              setCurrentTurn({
                agent_id: ev.agent_id,
                agent_name: ev.agent_name,
                avatar: ev.avatar,
                role_label: ev.role_label,
                round: ev.round,
                content: ''
              });
            } else if (ev.type === 'chunk') {
              setCurrentTurn(prev => prev ? { ...prev, content: prev.content + (ev.content || '') } : prev);
            } else if (ev.type === 'turn_end') {
              setStreamTurns(prev => [...prev, {
                agent_id: ev.agent_id,
                agent_name: ev.agent_name,
                avatar: ev.avatar,
                role_label: ev.role_label,
                round: ev.round,
                content: ev.content
              }]);
              setCurrentTurn(null);
            } else if (ev.type === 'synthesis_start') {
              setCurrentTurn({
                is_synthesis: true,
                agent_name: ev.leader_name,
                avatar: ev.avatar || '👑',
                role_label: 'Executive Final Consensus',
                content: ''
              });
            } else if (ev.type === 'synthesis_chunk') {
              setFinalSynthesis(prev => prev + (ev.content || ''));
            } else if (ev.type === 'synthesis_end') {
              setCurrentTurn(null);
            } else if (ev.type === 'complete') {
              setIsStreaming(false);
              fetchDiscussions();
            } else if (ev.type === 'error') {
              console.error('Debate stream error:', ev.message);
              setIsStreaming(false);
            }
          } catch (err) {
            console.error('SSE JSON parse error:', err);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Debate streaming failure:', err);
      }
    } finally {
      setIsStreaming(false);
      setCurrentTurn(null);
      fetchDiscussions();
    }
  };

  const handleSendIntervention = async (e) => {
    e.preventDefault();
    if (!interventionInput.trim() || isStreaming || !activeDiscussionId) return;

    const text = interventionInput.trim();
    setInterventionInput('');

    setStreamTurns(prev => [...prev, {
      is_human: true,
      agent_name: 'Human Operator (You)',
      avatar: '👤',
      role_label: 'Live Direct Intervention',
      content: text
    }]);

    setIsStreaming(true);

    try {
      const res = await fetch('/api/chat/discussion/intervene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discussion_id: activeDiscussionId,
          target_agent_id: targetInterventionAgentId === 'leader' ? (leaderId || selectedAgentIds[0]) : targetInterventionAgentId,
          human_instruction: text
        })
      });

      if (res.ok) {
        const data = await res.json();
        setStreamTurns(prev => [...prev, {
          agent_id: data.agent_id,
          agent_name: data.agent_name,
          avatar: data.avatar,
          role_label: data.role_label || 'Executive Response',
          content: data.reply
        }]);
      }
    } catch (err) {
      console.error('Intervention error:', err);
    } finally {
      setIsStreaming(false);
      fetchDiscussions();
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      {/* Left Sidebar: Debate History & Quick Actions */}
      <div className="w-72 border-r border-card-border bg-[#0d0f17] flex flex-col justify-between shrink-0 select-none overflow-hidden">
        <div className="p-3 border-b border-card-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-gray-200 font-mono">DEBATE SESSIONS</span>
          </div>
          <button
            onClick={handleStartNewDebate}
            className="p-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono flex items-center gap-1 shadow"
            title="Start New Multi-Agent Debate"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {discussions.length === 0 ? (
            <div className="text-center py-10 px-4 text-xs text-gray-500 space-y-2">
              <Swords className="w-8 h-8 text-gray-600 mx-auto" />
              <p>No debate sessions yet.</p>
              <button
                onClick={handleStartNewDebate}
                className="text-indigo-400 hover:underline font-mono text-[11px]"
              >
                + Launch your first debate
              </button>
            </div>
          ) : (
            discussions.map(disc => {
              const isSelected = activeDiscussionId === disc.id;
              return (
                <div
                  key={disc.id}
                  onClick={() => handleSelectPastDiscussion(disc)}
                  className={`group p-2.5 rounded-xl cursor-pointer border transition-all ${
                    isSelected
                      ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-md'
                      : 'bg-[#121520] border-card-border/60 hover:border-card-border text-gray-300 hover:bg-[#161a28]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-mono text-xs font-bold truncate text-gray-200">{disc.title || disc.topic || 'Untitled Debate'}</div>
                    <button
                      onClick={(e) => handleDeleteDiscussion(e, disc.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-gray-500 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-[10px] font-mono text-gray-500 flex items-center gap-2 mt-1">
                    <span>{new Date(disc.created_at).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{disc.status || 'completed'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chamber / Configurator View */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#111420]">
        {viewMode === 'config' ? (
          /* Configuration Setup View */
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
            <div className="border-b border-card-border pb-4">
              <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2 font-mono">
                <Swords className="w-5 h-5 text-indigo-400" />
                <span>Multi-Agent Consensus & Debate Chamber</span>
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Pit multiple specialized AI agents against each other to dissect architectures, challenge assumptions, and synthesize bulletproof executive decisions.
              </p>
            </div>

            <form onSubmit={handleLaunchDebate} className="space-y-6">
              {/* Topic Input */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">
                  1. Central Debate Topic or Problem Statement:
                </label>
                <textarea
                  required
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Should we migrate our monolith backend to Dataproc Serverless Spark or Rust microservices? Focus on memory cost vs team velocity..."
                  className="w-full bg-[#151928] border border-card-border rounded-xl p-3 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 resize-none font-sans"
                />
              </div>

              {/* Agent Selection & Roles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">
                    2. Select Participating Agents & Assign Roles:
                  </label>
                  <span className="text-[11px] font-mono text-indigo-400">
                    {selectedAgentIds.length} Agents Selected
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {agents.map((agent, idx) => {
                    const isSelected = selectedAgentIds.includes(agent.id);
                    const isLeader = leaderId === agent.id;
                    return (
                      <div
                        key={agent.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedAgentIds(prev => prev.filter(id => id !== agent.id));
                          } else {
                            setSelectedAgentIds(prev => [...prev, agent.id]);
                          }
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-500/15 border-indigo-500/40 text-gray-100 shadow-md'
                            : 'bg-[#141824] border-card-border/60 hover:border-card-border text-gray-400'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{agent.avatar || '🤖'}</span>
                            <span className="font-mono text-xs font-bold text-gray-200">{agent.name}</span>
                          </div>
                          {isSelected && (
                            <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-[10px] font-mono text-indigo-300 font-bold">
                              {isLeader ? '👑 Moderator' : 'Participant'}
                            </span>
                          )}
                        </div>

                        {isSelected && (
                          <div className="mt-2.5 pt-2.5 border-t border-card-border/60 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                            <label className="text-[10px] font-mono text-gray-400">Assigned Role:</label>
                            <input
                              type="text"
                              value={rolesMap[agent.id] || ''}
                              onChange={(e) => setRolesMap(prev => ({ ...prev, [agent.id]: e.target.value }))}
                              className="w-full bg-[#0d101a] border border-card-border rounded px-2 py-1 text-xs text-indigo-300 font-mono focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Attach Documents (Optional) */}
              {documents.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">
                    3. Attach Reference Documents from Inventory (Optional):
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                    {documents.map(doc => {
                      const isSelected = selectedDocIds.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => {
                            setSelectedDocIds(prev => 
                              isSelected ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
                            );
                          }}
                          className={`p-2 rounded-lg border cursor-pointer text-xs font-mono flex items-center justify-between transition-colors ${
                            isSelected
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : 'bg-[#141824] border-card-border/60 text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{doc.filename}</span>
                          </div>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rounds & Launch */}
              <div className="flex items-center justify-between pt-4 border-t border-card-border">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-mono text-gray-400">Rounds of Argumentation:</label>
                  <select
                    value={rounds}
                    onChange={(e) => setRounds(Number(e.target.value))}
                    className="bg-[#151824] border border-card-border rounded px-2.5 py-1 text-xs text-gray-200 font-mono focus:outline-none"
                  >
                    <option value={1}>1 Round (Quick Review)</option>
                    <option value={2}>2 Rounds (Standard Debate & Rebuttal)</option>
                    <option value={3}>3 Rounds (Deep Adversarial Challenge)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={selectedAgentIds.length < 1 || !topic.trim()}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold font-mono flex items-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-40 transition-all"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Launch Live Debate</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Live Debate Chamber View */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chamber Topbar */}
            <div className="p-3 border-b border-card-border bg-[#0e111a] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setViewMode('config')}
                  className="p-1.5 rounded-lg border border-card-border hover:bg-[#151928] text-gray-400 hover:text-gray-200"
                  title="Back to Setup"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <h3 className="text-xs font-bold text-gray-100 font-mono truncate max-w-xl">
                    Topic: {topic}
                  </h3>
                  <div className="text-[10px] font-mono text-gray-500 flex items-center gap-2 mt-0.5">
                    <span>Round {currentRound} of {rounds}</span>
                    <span>•</span>
                    <span className={isStreaming ? 'text-indigo-400 animate-pulse' : 'text-emerald-400'}>
                      {isStreaming ? '● Debate In Progress...' : '✓ Debate Concluded'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isStreaming ? (
                  <button
                    onClick={handleStopDebate}
                    className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-mono flex items-center gap-1.5"
                  >
                    <Square className="w-3 h-3 fill-red-400" />
                    <span>Halt Debate</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStartNewDebate}
                    className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono flex items-center gap-1.5 shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Debate</span>
                  </button>
                )}
              </div>
            </div>

            {/* Chamber Turns Stream Viewport */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 select-text">
              {streamTurns.map((turn, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-[#0d0f17] border border-card-border space-y-2 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-card-border/60">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{turn.avatar || '🤖'}</span>
                      <div>
                        <span className="font-mono text-xs font-bold text-gray-100">{turn.agent_name}</span>
                        <span className="text-[10px] font-mono text-indigo-400 ml-2 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                          {turn.role_label}
                        </span>
                      </div>
                    </div>
                    {turn.round && (
                      <span className="text-[10px] font-mono text-gray-500">Round {turn.round}</span>
                    )}
                  </div>

                  <div className="text-xs text-gray-200 leading-relaxed font-sans whitespace-pre-wrap">
                    {turn.content}
                  </div>
                </div>
              ))}

              {/* Active Current Stream Turn */}
              {currentTurn && (
                <div className="p-4 rounded-2xl bg-[#141824] border border-indigo-500/40 space-y-2 shadow-lg animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-card-border/60">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{currentTurn.avatar || '🤖'}</span>
                      <div>
                        <span className="font-mono text-xs font-bold text-indigo-300">{currentTurn.agent_name}</span>
                        <span className="text-[10px] font-mono text-indigo-400 ml-2 px-2 py-0.5 rounded bg-indigo-500/20">
                          {currentTurn.role_label}
                        </span>
                      </div>
                    </div>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  </div>

                  <div className="text-xs text-gray-100 leading-relaxed font-sans whitespace-pre-wrap">
                    {currentTurn.content || <span className="text-gray-500 italic">Thinking and constructing argument...</span>}
                  </div>
                </div>
              )}

              {/* Final Synthesis Banner */}
              {finalSynthesis && (
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 shadow-xl">
                  <div className="flex items-center gap-2 text-emerald-400 font-mono font-bold text-xs uppercase tracking-wider pb-2 border-b border-emerald-500/20">
                    <Crown className="w-4 h-4" />
                    <span>Executive Consensus & Final Decision</span>
                  </div>
                  <div className="text-xs text-gray-100 leading-relaxed font-sans whitespace-pre-wrap">
                    {finalSynthesis}
                  </div>
                </div>
              )}

              <div ref={streamEndRef} />
            </div>

            {/* Live Human Operator Intervention Input */}
            {!isStreaming && (
              <form onSubmit={handleSendIntervention} className="p-3 border-t border-card-border bg-[#0e111a] flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono text-gray-400 pl-2 shrink-0">👤 Intervene:</span>
                <input
                  type="text"
                  value={interventionInput}
                  onChange={(e) => setInterventionInput(e.target.value)}
                  placeholder="Directly challenge or guide the agents (e.g. 'What if cloud budget is capped at $500/mo?')..."
                  className="flex-1 bg-[#151928] border border-card-border rounded-xl px-3 py-2 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 font-sans"
                />
                <button
                  type="submit"
                  disabled={!interventionInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold flex items-center gap-1 disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
