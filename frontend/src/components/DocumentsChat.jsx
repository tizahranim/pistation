import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Users, 
  Sparkles, 
  Play, 
  CheckCircle2, 
  MessageSquare, 
  FileCode,
  File,
  Layers,
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
  Download
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

export default function DocumentsChat({ 
  documents = [], 
  agents = [], 
  onRefreshDocs 
}) {
  const [uploading, setUploading] = useState(false);
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

  const fileInputRef = useRef(null);
  const streamEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Load past discussions on mount
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (data.document?.id) {
          setSelectedDocIds(prev => [...prev, data.document.id]);
        }
        onRefreshDocs();
      }
    } catch (err) {
      console.error('File upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDoc = async (docId) => {
    try {
      await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      setSelectedDocIds(prev => prev.filter(id => id !== docId));
      onRefreshDocs();
    } catch (err) {
      console.error('Failed to delete doc:', err);
    }
  };

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
          human_guidance: humanGuidance.trim() || undefined,
          rounds: parseInt(rounds, 10)
        })
      });

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
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === 'start') {
                setActiveDiscussionId(event.discussion_id);
                fetchDiscussions();
              } else if (event.type === 'round_start') {
                setCurrentRound(event.round);
              } else if (event.type === 'human_intervention') {
                setStreamTurns(prev => [...prev, {
                  speaker: 'Human Supervisor',
                  role: 'Executive Direction',
                  content: event.content,
                  is_human: true
                }]);
              } else if (event.type === 'agent_turn_start') {
                setCurrentTurn({
                  agent_id: event.agent.id,
                  agent_name: event.agent.name,
                  agent_avatar: event.agent.avatar,
                  role: event.agent.role,
                  model: event.agent.model,
                  is_leader: event.agent.is_leader,
                  round: event.round,
                  content: ''
                });
              } else if (event.type === 'agent_token') {
                setCurrentTurn(prev => prev ? { ...prev, content: prev.content + event.content } : prev);
              } else if (event.type === 'agent_turn_end') {
                setStreamTurns(prev => [...prev, {
                  ...currentTurn,
                  content: event.full_content
                }]);
                setCurrentTurn(null);
              } else if (event.type === 'synthesis_token') {
                setFinalSynthesis(prev => prev + event.content);
              } else if (event.type === 'complete') {
                fetchDiscussions();
              }
            } catch (e) {
              // Parse error
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Debate streaming error:', err);
      }
    } finally {
      setIsStreaming(false);
      setCurrentTurn(null);
      abortControllerRef.current = null;
      fetchDiscussions();
    }
  };

  // Handle Human Live Intervention in the Chamber
  const handleSendIntervention = async (e) => {
    e?.preventDefault();
    if (!interventionInput.trim() || isStreaming || !activeDiscussionId) return;

    const message = interventionInput.trim();
    setInterventionInput('');
    setIsStreaming(true);

    const targetAgent = targetInterventionAgentId === 'leader' ? undefined : targetInterventionAgentId;

    try {
      const response = await fetch(`/api/chat/discussions/${activeDiscussionId}/participate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          target_agent_id: targetAgent
        })
      });

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
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === 'human_intervention') {
                setStreamTurns(prev => [...prev, {
                  speaker: 'Human Supervisor',
                  role: 'Executive Direction',
                  content: event.content,
                  is_human: true
                }]);
              } else if (event.type === 'agent_turn_start') {
                setCurrentTurn({
                  agent_id: event.agent.id,
                  agent_name: event.agent.name,
                  agent_avatar: event.agent.avatar,
                  role: event.agent.role,
                  model: event.agent.model,
                  is_leader: event.agent.is_leader,
                  content: ''
                });
              } else if (event.type === 'agent_token') {
                setCurrentTurn(prev => prev ? { ...prev, content: prev.content + event.content } : prev);
              } else if (event.type === 'agent_turn_end') {
                setStreamTurns(prev => [...prev, {
                  ...currentTurn,
                  content: event.full_content
                }]);
                setCurrentTurn(null);
              } else if (event.type === 'complete') {
                fetchDiscussions();
              }
            } catch (e) {
              // Ignore parse error
            }
          }
        }
      }
    } catch (err) {
      console.error('Intervention error:', err);
    } finally {
      setIsStreaming(false);
      setCurrentTurn(null);
      fetchDiscussions();
    }
  };

  const handleExportReport = (targetDisc = null) => {
    let reportTopic = topic;
    let reportRounds = currentRound;
    let reportSynthesis = finalSynthesis;
    let reportTurns = streamTurns;

    if (targetDisc && targetDisc.id) {
      reportTopic = targetDisc.topic || targetDisc.title;
      reportRounds = targetDisc.rounds || 1;
      reportSynthesis = targetDisc.summary || "";
      try {
        reportTurns = JSON.parse(targetDisc.transcript || '[]');
      } catch (e) {
        reportTurns = [];
      }
    }

    const lines = [
      `# Executive Multi-Agent Roundtable Report`,
      `**Topic**: ${reportTopic}`,
      `**Generated On**: ${new Date().toLocaleString()}`,
      `**Rounds**: ${reportRounds}`,
      ``,
      `---`,
      `## Executive Consensus & Verdict`,
      reportSynthesis || "Debate completed / no final synthesis recorded.",
      ``,
      `---`,
      `## Debate Transcript`,
      ...reportTurns.map(t => `### ${t.speaker || t.agent_name || (t.is_human ? 'Human Supervisor' : 'Agent')} (${t.role || 'Participant'})\n${t.content}\n`)
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debate-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-background">
      {/* Left Column: Documents & Saved Debates Navigation */}
      <div className="w-80 border-r border-card-border bg-[#0d0f17] flex flex-col justify-between shrink-0 overflow-hidden">
        {/* Upload & Doc Library */}
        <div className="p-4 border-b border-card-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 font-mono flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              Knowledge Library
            </span>
            <span className="text-[10px] text-gray-500 font-mono">{documents.length} docs</span>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-dashed border-indigo-500/40 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-300 text-xs font-medium transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>{uploading ? 'Uploading & Indexing...' : 'Upload Document'}</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.txt,.md,.json,.py,.js,.csv"
          />

          {/* Doc Checklist */}
          <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
            {documents.length === 0 ? (
              <div className="text-[11px] text-gray-500 font-mono text-center py-2">No documents yet.</div>
            ) : (
              documents.map(doc => {
                const isSelected = selectedDocIds.includes(doc.id);
                return (
                  <div
                    key={doc.id}
                    onClick={() => {
                      setSelectedDocIds(prev => 
                        isSelected ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
                      );
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-200'
                        : 'hover:bg-card-border/50 text-gray-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate mr-1">
                      <FileCode className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate text-[11px] font-mono">{doc.filename}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDoc(doc.id);
                      }}
                      className="p-1 text-gray-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Saved Debate Sessions List */}
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 font-mono flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-emerald-400" />
              Past Debates ({discussions.length})
            </span>
            <button
              onClick={handleStartNewDebate}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-0.5 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20"
              title="Configure and start new debate"
            >
              <Plus className="w-3 h-3" />
              <span>New Debate</span>
            </button>
          </div>

          <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
            {discussions.length === 0 ? (
              <div className="text-[11px] text-gray-500 font-mono text-center py-4">No debates run yet.</div>
            ) : (
              discussions.map(disc => {
                const isCurrent = activeDiscussionId === disc.id;
                return (
                  <div
                    key={disc.id}
                    onClick={() => handleSelectPastDiscussion(disc)}
                    className={`group p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between ${
                      isCurrent && viewMode === 'chamber'
                        ? 'bg-[#181e2b] border-emerald-500/40 text-emerald-200 shadow-sm'
                        : 'bg-card/40 border-card-border hover:bg-card text-gray-300'
                    }`}
                  >
                    <div className="truncate mr-2">
                      <div className="font-medium truncate text-xs">{disc.title || disc.topic}</div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5 flex items-center gap-2">
                        <span>{disc.rounds} Rounds</span>
                        <span>•</span>
                        <span className={disc.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'}>
                          {disc.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportReport(disc);
                        }}
                        className="p-1 text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/20 rounded transition-all"
                        title="Export this debate as Markdown report"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteDiscussion(e, disc.id)}
                        className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-all"
                        title="Delete debate"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Center / Right: Debate Chamber or Configuration */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {viewMode === 'config' ? (
          /* Configuration View */
          <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-400" />
                Multi-Agent Roundtable & Executive Debate
              </h2>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Assemble a specialized team of autonomous agents with designated roles and an executive leader to debate complex topics, stress-test architectures, analyze documents, and synthesize actionable consensus.
              </p>
            </div>

            <form onSubmit={handleLaunchDebate} className="space-y-6">
              {/* Debate Topic */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-gray-300 font-mono">
                  1. Debate Topic / Core Question
                </label>
                <textarea
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Analyze and debate the key tradeoffs, failure modes, cost, and developer velocity..."
                  className="w-full bg-[#131622] border border-card-border rounded-xl p-3.5 text-xs text-gray-100 focus:outline-none focus:border-emerald-500/50 resize-none font-sans"
                />
              </div>

              {/* Team Assembly & Roles Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase text-gray-300 font-mono flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    2. Assemble Team, Assign Leader & Specific Roles
                  </label>
                  <span className="text-[11px] text-gray-400 font-mono">
                    {selectedAgentIds.length} agents selected
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {agents.map((agent) => {
                    const isSelected = selectedAgentIds.includes(agent.id);
                    const isLeader = leaderId === agent.id;
                    const currentRole = rolesMap[agent.id] || agent.role;

                    return (
                      <div
                        key={agent.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-3 ${
                          isSelected
                            ? 'bg-[#151926] border-emerald-500/40 shadow-sm'
                            : 'bg-card/40 border-card-border opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAgentIds(prev => 
                                  isSelected ? prev.filter(id => id !== agent.id) : [...prev, agent.id]
                                );
                              }}
                              className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                isSelected ? 'bg-emerald-500 border-emerald-500 text-gray-950' : 'border-card-border'
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                            <span className="text-lg">{agent.avatar || '🤖'}</span>
                            <div>
                              <div className="text-xs font-semibold text-gray-200">{agent.name}</div>
                              <div className="text-[10px] text-gray-500 font-mono">{agent.model_id}</div>
                            </div>
                          </div>

                          {/* Leader Toggle Button */}
                          {isSelected && (
                            <button
                              type="button"
                              onClick={() => setLeaderId(agent.id)}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-mono flex items-center gap-1 transition-all ${
                                isLeader
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold'
                                  : 'text-gray-500 hover:text-amber-300 bg-card-border/40'
                              }`}
                            >
                              <Crown className="w-3 h-3" />
                              <span>{isLeader ? 'Leader' : 'Make Lead'}</span>
                            </button>
                          )}
                        </div>

                        {/* Role Assignment Dropdown */}
                        {isSelected && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-mono uppercase text-gray-400">Assigned Role in Debate</label>
                            <input
                              type="text"
                              value={currentRole}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRolesMap(prev => ({ ...prev, [agent.id]: val }));
                              }}
                              placeholder="e.g. Devil's Advocate / Security Auditor"
                              className="w-full bg-[#10131e] border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-gray-200 font-sans focus:outline-none focus:border-indigo-500/50"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Human Intervention / Guidance */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-gray-300 font-mono flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  3. Initial Human Guidance / Directives (Optional)
                </label>
                <input
                  type="text"
                  value={humanGuidance}
                  onChange={(e) => setHumanGuidance(e.target.value)}
                  placeholder="e.g. Make sure to consider memory constraints and prioritize reliability over raw throughput."
                  className="w-full bg-[#131622] border border-card-border rounded-xl px-3.5 py-2.5 text-xs text-gray-100 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              {/* Rounds & Launch Button */}
              <div className="flex items-center justify-between pt-2 border-t border-card-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400">Debate Rounds:</span>
                  <select
                    value={rounds}
                    onChange={(e) => setRounds(e.target.value)}
                    className="bg-[#131622] border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-gray-200 font-mono focus:outline-none"
                  >
                    <option value={1}>1 Round (Fast Take)</option>
                    <option value={2}>2 Rounds (Standard Debate)</option>
                    <option value={3}>3 Rounds (Deep Stress Test)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={(!topic.trim() && !humanGuidance.trim() && selectedDocIds.length === 0) || selectedAgentIds.length < 1}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-gray-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Launch Executive Debate</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Live Stream & Debate Chamber View */
          <div className="flex-1 flex flex-col justify-between overflow-hidden">
            {/* Debate Chamber Header */}
            <div className="p-4 border-b border-card-border bg-[#0e111a] flex items-center justify-between">
              <div className="flex items-center gap-3 truncate mr-4">
                <button
                  onClick={() => setViewMode('config')}
                  className="p-1.5 rounded-lg border border-card-border hover:bg-card-border/60 text-gray-400 hover:text-gray-200 transition-colors"
                  title="Back to Debate Setup"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-semibold border ${
                      isStreaming
                        ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 animate-pulse'
                        : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                    }`}>
                      {isStreaming ? `Round ${currentRound} in Progress` : 'Debate Chamber'}
                    </span>
                    <h3 className="font-bold text-sm text-gray-100 truncate">{topic}</h3>
                  </div>
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-2">
                {streamTurns.length > 0 && (
                  <button
                    onClick={handleExportReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-300 text-xs font-mono font-semibold transition-colors"
                    title="Export full debate transcript and executive consensus as Markdown"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Report</span>
                  </button>
                )}

                {isStreaming ? (
                  <button
                    onClick={handleStopDebate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-mono font-semibold transition-colors"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Debate</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStartNewDebate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-semibold transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>New Debate</span>
                  </button>
                )}
              </div>
            </div>

            {/* Transcript Timeline */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {streamTurns.map((turn, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl p-4 border text-xs leading-relaxed space-y-2 max-w-4xl mx-auto shadow-sm ${
                    turn.is_human
                      ? 'bg-emerald-600/15 border-emerald-500/30 text-emerald-100'
                      : 'bg-card border-card-border text-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-card-border/40 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{turn.is_human ? '🧑‍💼' : (turn.agent_avatar || '🗣️')}</span>
                      <span className="font-bold text-gray-100">{turn.is_human ? 'You (Human Supervisor)' : (turn.agent_name || turn.speaker)}</span>
                      {turn.role && (
                        <span className={`px-2 py-0.5 rounded border text-[10px] ${
                          turn.is_human 
                            ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 font-semibold' 
                            : 'bg-[#161a26] border-card-border text-emerald-300'
                        }`}>
                          {turn.role}
                        </span>
                      )}
                      {turn.is_leader && (
                        <span className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px]">
                          <Crown className="w-2.5 h-2.5" />
                          <span>Team Lead</span>
                        </span>
                      )}
                    </div>
                    {turn.round && (
                      <span className="text-gray-500">Round {turn.round}</span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed pt-1">
                    {turn.content}
                  </div>
                </div>
              ))}

              {/* Active Streaming Turn */}
              {currentTurn && (
                <div className="rounded-2xl p-4 border border-emerald-500/40 bg-[#121624] text-xs leading-relaxed space-y-2 max-w-4xl mx-auto shadow-md">
                  <div className="flex items-center justify-between pb-1.5 border-b border-card-border/40 font-mono text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{currentTurn.agent_avatar || '🤖'}</span>
                      <span className="font-bold text-emerald-300">{currentTurn.agent_name}</span>
                      <span className="px-2 py-0.5 rounded bg-[#161a26] border border-card-border text-emerald-300 text-[10px]">
                        {currentTurn.role}
                      </span>
                    </div>
                    <span className="text-emerald-400 text-[10px] animate-pulse">Speaking...</span>
                  </div>
                  <div className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed pt-1 text-gray-200">
                    {currentTurn.content || 'Formulating argument...'}
                  </div>
                </div>
              )}

              {/* Final Synthesis Card */}
              {finalSynthesis && (
                <div className="rounded-2xl p-5 border border-amber-500/40 bg-[#17141f] text-xs leading-relaxed space-y-3 max-w-4xl mx-auto shadow-2xl">
                  <div className="flex items-center gap-2 pb-2 border-b border-amber-500/20">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <h4 className="font-bold text-sm text-amber-200">Executive Team Consensus & Verdict</h4>
                  </div>
                  <div className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-gray-200">
                    {finalSynthesis}
                  </div>
                </div>
              )}

              <div ref={streamEndRef} />
            </div>

            {/* Live Human Intervention Bar inside Chamber */}
            {activeDiscussionId && (
              <div className="p-4 border-t border-card-border bg-[#0b0e16]/90 backdrop-blur-md">
                <form onSubmit={handleSendIntervention} className="max-w-4xl mx-auto space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5" />
                        Human Intervention:
                      </span>
                      <span>Direct to:</span>
                      <select
                        value={targetInterventionAgentId}
                        onChange={(e) => setTargetInterventionAgentId(e.target.value)}
                        className="bg-[#151928] border border-card-border text-gray-200 rounded px-2 py-0.5 text-[11px] focus:outline-none"
                      >
                        <option value="leader">👑 Team Leader</option>
                        {agents
                          .filter(a => selectedAgentIds.includes(a.id))
                          .map(a => (
                            <option key={a.id} value={a.id}>
                              {a.name} ({rolesMap[a.id] || a.role})
                            </option>
                          ))}
                      </select>
                    </div>
                    <span className="text-gray-500">Press Enter to participate</span>
                  </div>

                  <div className="relative rounded-xl bg-[#141824] border border-card-border focus-within:border-emerald-500/50 flex items-center shadow-inner">
                    <input
                      type="text"
                      value={interventionInput}
                      onChange={(e) => setInterventionInput(e.target.value)}
                      placeholder="Intervene in debate (e.g. '@Leader, ask the Security Auditor to address zero-day risks' or 'Focus on latency')..."
                      disabled={isStreaming}
                      className="w-full bg-transparent px-4 py-3 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none font-sans"
                    />
                    <button
                      type="submit"
                      disabled={!interventionInput.trim() || isStreaming}
                      className="m-1.5 p-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-gray-950 transition-all font-semibold"
                      title="Send Human Intervention"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
