import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Swords,
  Volume2,
  VolumeX,
  Radio,
  Bookmark,
  Check,
  Copy,
  ChevronDown,
  Layers,
  Award,
  AlertTriangle,
  Flame,
  ArrowRight,
  TrendingUp,
  Cpu,
  BrainCircuit,
  CornerDownRight,
  Pause,
  StepForward
} from 'lucide-react';

const DEBATE_TEMPLATES = [
  {
    id: 'arch',
    title: 'Architecture Review & Trade-offs',
    desc: 'Deep dive into microservices vs monolith, event streams, data replication, and high availability.',
    icon: Layers,
    color: 'emerald',
    topic: 'Should we migrate our backend monolith to event-driven microservices with Apache Kafka, or optimize the modular monolith with SQLite/PostgreSQL?',
    rounds: 2,
    suggestedRoles: [
      'Executive Moderator & System Architect',
      'Lead Proponent: Event-Driven Kafka Microservices',
      "Skeptic & Pragmatist: Modular Monolith Champion",
      'Security & Fault-Tolerance Auditor'
    ]
  },
  {
    id: 'security',
    title: 'Security & Threat Vector Audit',
    desc: 'Audit API surface, zero-trust architecture, auth flows, and potential OWASP Top 10 vulnerabilities.',
    icon: ShieldAlert,
    color: 'rose',
    topic: 'Comprehensive vulnerability audit of our auth flows, API rate limits, and zero-trust perimeter against token theft and prompt injection.',
    rounds: 2,
    suggestedRoles: [
      'Chief Information Security Officer (CISO)',
      'Offensive Penetration Tester & Red Teamer',
      'Defensive Infrastructure & IAM Specialist',
      'Compliance & Cryptographic Auditor'
    ]
  },
  {
    id: 'product',
    title: 'Product Strategy & Roadmap Launch',
    desc: 'Evaluate product-market fit, pricing tiers, developer UX, and go-to-market trade-offs.',
    icon: TrendingUp,
    color: 'purple',
    topic: 'Should we prioritize an autonomous AI developer agent with MCP tooling, or double down on local model inference with private fine-tuning?',
    rounds: 2,
    suggestedRoles: [
      'VP of Product & Executive Chair',
      'AI Agent & Developer Experience Lead',
      'Infrastructure & Local Compute Champion',
      'Customer Research & Growth Strategist'
    ]
  },
  {
    id: 'refactor',
    title: 'Code Refactoring & Tech Debt',
    desc: 'Evaluate tech debt payoff, framework migration, and modular code cleanup.',
    icon: Swords,
    color: 'cyan',
    topic: 'Strategy to eliminate legacy tech debt and transition state management to lightweight reactive primitives while maintaining 99.9% uptime.',
    rounds: 2,
    suggestedRoles: [
      'Principal Software Engineer',
      'Refactoring & Clean Code Advocate',
      'Release Reliability & DevOps Engineer',
      'QA & Regression Defense Lead'
    ]
  }
];

const PRESET_ROLES = [
  "Executive Moderator & Synthesizer",
  "Lead Proponent & Solution Architect",
  "Devil's Advocate & Critical Skeptic",
  "Security & Vulnerability Auditor",
  "Performance & Latency Optimizer",
  "Cost & Infrastructure Analyst",
  "Product & User Experience Champion"
];

const CURATED_VOICES = [
  { id: 'en-US-GuyNeural', name: 'Guy (Deep Male)', gender: 'Male', accent: 'US' },
  { id: 'en-US-JennyNeural', name: 'Jenny (Natural Female)', gender: 'Female', accent: 'US' },
  { id: 'en-US-AriaNeural', name: 'Aria (Expressive Female)', gender: 'Female', accent: 'US' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher (Professional Male)', gender: 'Male', accent: 'US' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (British Female)', gender: 'Female', accent: 'UK' },
  { id: 'en-GB-RyanNeural', name: 'Ryan (British Male)', gender: 'Male', accent: 'UK' },
  { id: 'en-US-EricNeural', name: 'Eric (Confident Male)', gender: 'Male', accent: 'US' },
  { id: 'en-AU-NatashaNeural', name: 'Natasha (Australian Female)', gender: 'Female', accent: 'AU' }
];

export default function AgentDebate({ 
  documents = [], 
  agents = []
}) {
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const [leaderId, setLeaderId] = useState(null);
  const [rolesMap, setRolesMap] = useState({});
  const [voiceMap, setVoiceMap] = useState({});
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
  const [currentPhase, setCurrentPhase] = useState('opening');
  const [consensusScore, setConsensusScore] = useState(50);
  const [finalSynthesis, setFinalSynthesis] = useState('');
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);

  // Global Multi-Agent Voiceover State
  const [globalVoiceEnabled, setGlobalVoiceEnabled] = useState(true);
  const [speakingTurnId, setSpeakingTurnId] = useState(null);
  const [speakingAgentId, setSpeakingAgentId] = useState(null);
  const audioQueueRef = useRef([]);
  const isPlayingAudioRef = useRef(false);
  const currentAudioRef = useRef(null);

  // Human Live Intervention in Chamber
  const [interventionInput, setInterventionInput] = useState('');
  const [targetInterventionAgentId, setTargetInterventionAgentId] = useState('leader');
  const [challengeModal, setChallengeModal] = useState(null); // { challenger, challenged }
  const [challengeMsg, setChallengeMsg] = useState('');

  // UI feedback & Copy state
  const [copiedSection, setCopiedSection] = useState(null);
  const [memorySavedFeedback, setMemorySavedFeedback] = useState(false);

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

  // Set default leader, roles, and unique voices when agents change
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
      setVoiceMap(prev => {
        const next = { ...prev };
        selectedAgentIds.forEach((id, idx) => {
          if (!next[id]) {
            next[id] = CURATED_VOICES[idx % CURATED_VOICES.length].id;
          }
        });
        return next;
      });
    } else {
      setLeaderId(null);
    }
  }, [selectedAgentIds]);

  // Cleanup audio on unmount or tab switch
  useEffect(() => {
    return () => {
      stopAllAudio();
    };
  }, []);

  const stopAllAudio = () => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.src = '';
      } catch (e) {}
      currentAudioRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingAudioRef.current = false;
    setSpeakingTurnId(null);
    setSpeakingAgentId(null);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  };

  const toggleGlobalVoice = () => {
    setGlobalVoiceEnabled(prev => {
      const next = !prev;
      if (!next) {
        stopAllAudio();
      }
      return next;
    });
  };

  // Play natural speech with agent's mapped voice
  const speakText = async (text, voiceId, turnIdentifier, agentId) => {
    if (!text || !globalVoiceEnabled) return;
    
    setSpeakingTurnId(turnIdentifier);
    if (agentId) setSpeakingAgentId(agentId);

    // Clean text for speech
    const cleanSpeechText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/\[STANCE\][^\n]*/gi, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[#*_\->]/g, '')
      .trim();

    try {
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanSpeechText.slice(0, 2500),
          voice: voiceId || 'en-US-JennyNeural'
        })
      });

      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        await new Promise((resolve) => {
          audio.onended = () => {
            setSpeakingTurnId(null);
            setSpeakingAgentId(null);
            currentAudioRef.current = null;
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          audio.onerror = () => {
            setSpeakingTurnId(null);
            setSpeakingAgentId(null);
            currentAudioRef.current = null;
            resolve();
          };
          audio.play().catch(() => {
            setSpeakingTurnId(null);
            setSpeakingAgentId(null);
            resolve();
          });
        });
        return;
      }
    } catch (e) {
      console.warn('Neural TTS play error, fallback to browser speech synthesis:', e);
    }

    // Fallback: browser SpeechSynthesis
    if ('speechSynthesis' in window) {
      await new Promise((resolve) => {
        const utt = new SpeechSynthesisUtterance(cleanSpeechText.slice(0, 1000));
        utt.onend = () => {
          setSpeakingTurnId(null);
          setSpeakingAgentId(null);
          resolve();
        };
        utt.onerror = () => {
          setSpeakingTurnId(null);
          setSpeakingAgentId(null);
          resolve();
        };
        window.speechSynthesis.speak(utt);
      });
    } else {
      setSpeakingTurnId(null);
      setSpeakingAgentId(null);
    }
  };

  const processAudioQueue = async () => {
    if (isPlayingAudioRef.current || audioQueueRef.current.length === 0 || !globalVoiceEnabled) return;
    isPlayingAudioRef.current = true;
    while (audioQueueRef.current.length > 0 && globalVoiceEnabled) {
      const item = audioQueueRef.current.shift();
      if (item) {
        await speakText(item.text, item.voice, item.turnId, item.agentId);
      }
    }
    isPlayingAudioRef.current = false;
  };

  const queueVoicePlayback = (text, voiceId, turnId, agentId) => {
    if (!globalVoiceEnabled) return;
    audioQueueRef.current.push({ text, voiceId, turnId, agentId });
    processAudioQueue();
  };

  const handlePlayTurnVoice = async (turn) => {
    if (speakingTurnId === turn.id) {
      stopAllAudio();
      return;
    }
    stopAllAudio();
    const targetAgentId = turn.agent_id || (turn.is_human ? null : leaderId);
    const voiceId = voiceMap[targetAgentId] || (turn.is_human ? 'en-US-GuyNeural' : 'en-US-JennyNeural');
    await speakText(turn.content, voiceId, turn.id, targetAgentId);
  };

  const handleApplyTemplate = (tpl) => {
    setTopic(tpl.topic);
    setRounds(tpl.rounds);
    
    // Select top 3 or 4 agents
    if (agents.length >= 2) {
      const selected = agents.slice(0, Math.min(4, agents.length)).map(a => a.id);
      setSelectedAgentIds(selected);
      setLeaderId(selected[0]);
      
      const newRoles = {};
      selected.forEach((id, idx) => {
        newRoles[id] = tpl.suggestedRoles[idx % tpl.suggestedRoles.length];
      });
      setRolesMap(newRoles);
    }
  };

  const handleStartDebate = async () => {
    if (!topic.trim() || selectedAgentIds.length < 2) return;
    stopAllAudio();
    setIsStreaming(true);
    setStreamTurns([]);
    setCurrentTurn(null);
    setFinalSynthesis('');
    setCurrentRound(1);
    setCurrentPhase('opening');
    setConsensusScore(50);
    setViewMode('chamber');

    const discussionId = `disc-${Date.now().toString(36)}`;
    setActiveDiscussionId(discussionId);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat/discussions/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discussion_id: discussionId,
          topic: topic.trim(),
          agent_ids: selectedAgentIds,
          document_ids: selectedDocIds,
          leader_id: leaderId,
          roles_map: rolesMap,
          human_guidance: humanGuidance.trim() || undefined,
          rounds: parseInt(rounds, 10) || 2
        }),
        signal: abortControllerRef.current.signal
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let activeTurnObject = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();
            if (!dataStr) continue;

            try {
              const event = JSON.parse(dataStr);

              if (event.type === 'start') {
                setActiveDiscussionData(event);
              } else if (event.type === 'round_start') {
                setCurrentRound(event.round);
                setCurrentPhase(event.phase || (event.round === 1 ? 'opening' : 'rebuttal'));
              } else if (event.type === 'human_intervention') {
                setStreamTurns(prev => [...prev, {
                  id: `human-${Date.now()}`,
                  speaker: 'Human Supervisor',
                  content: event.content,
                  is_human: true
                }]);
              } else if (event.type === 'agent_turn_start') {
                const aid = event.agent_id || event.agent?.id;
                const aname = event.agent_name || event.agent?.name || 'Agent';
                const aavatar = event.agent_avatar || event.agent?.avatar || '🤖';
                const arole = event.role || event.agent?.role || 'Debater';
                setActiveSpeakerId(aid);
                activeTurnObject = {
                  id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  agent_id: aid,
                  agent_name: aname,
                  agent_avatar: aavatar,
                  role: arole,
                  round: event.round || currentRound,
                  target_agent: event.target_agent,
                  target_agent_id: event.target_agent_id,
                  content: '',
                  stance: null
                };
                setCurrentTurn(activeTurnObject);
              } else if (event.type === 'agent_token') {
                if (activeTurnObject) {
                  activeTurnObject.content += event.content;
                  setCurrentTurn({ ...activeTurnObject });
                }
              } else if (event.type === 'stance') {
                if (activeTurnObject && (activeTurnObject.agent_id === event.agent_id || !event.agent_id)) {
                  activeTurnObject.stance = event.stance;
                  setCurrentTurn({ ...activeTurnObject });
                }
              } else if (event.type === 'agent_turn_end') {
                if (activeTurnObject) {
                  if (event.full_content) {
                    activeTurnObject.content = event.full_content;
                  }
                  const finalizedTurn = { ...activeTurnObject };
                  setStreamTurns(prev => [...prev, finalizedTurn]);
                  
                  // Queue voiceover playback with specific agent voice and agentId
                  const agentVoice = voiceMap[finalizedTurn.agent_id] || 'en-US-JennyNeural';
                  queueVoicePlayback(finalizedTurn.content, agentVoice, finalizedTurn.id, finalizedTurn.agent_id);

                  activeTurnObject = null;
                  setCurrentTurn(null);
                  setActiveSpeakerId(null);
                }
              } else if (event.type === 'consensus_update') {
                setConsensusScore(event.score);
              } else if (event.type === 'synthesis_start') {
                setCurrentPhase('synthesis');
                setActiveSpeakerId(leaderId);
              } else if (event.type === 'synthesis_token') {
                setFinalSynthesis(prev => prev + event.content);
              } else if (event.type === 'complete') {
                setIsStreaming(false);
                setActiveSpeakerId(null);
                if (event.summary) {
                  setFinalSynthesis(event.summary);
                  // Queue voiceover for synthesis with leader voice
                  const leaderVoice = voiceMap[leaderId] || 'en-US-GuyNeural';
                  queueVoicePlayback(event.summary, leaderVoice, 'synthesis', leaderId);
                }
                if (event.meta?.consensus_score) {
                  setConsensusScore(event.meta.consensus_score);
                }
                fetchDiscussions();
              }
            } catch (err) {
              console.error('Error parsing SSE event in debate:', err);
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Debate streaming failure:', err);
      }
    } finally {
      setIsStreaming(false);
      setActiveSpeakerId(null);
      fetchDiscussions();
    }
  };

  const handleStopDebate = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    stopAllAudio();
    setIsStreaming(false);
    setActiveSpeakerId(null);
    fetch('/api/chat/discussions/reset-stuck', { method: 'POST' }).catch(() => {});
  };

  const handleSelectPastDiscussion = async (disc) => {
    stopAllAudio();
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
      
      // Calculate or estimate consensus score from transcript
      const agreeCount = parsedTranscript.filter(t => t.stance?.type === 'AGREE').length;
      const totalStances = parsedTranscript.filter(t => t.stance).length;
      if (totalStances > 0) {
        setConsensusScore(Math.round((agreeCount / totalStances) * 100));
      } else {
        setConsensusScore(75);
      }
    } catch (err) {
      console.error('Failed to load discussion details:', err);
    }
  };

  const handleDeleteDiscussion = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this discussion record?')) return;
    try {
      await fetch(`/api/chat/discussions/${id}`, { method: 'DELETE' });
      if (activeDiscussionId === id) {
        setViewMode('config');
        setActiveDiscussionId(null);
      }
      fetchDiscussions();
    } catch (err) {
      console.error('Failed to delete discussion:', err);
    }
  };

  const handleSendIntervention = async (e) => {
    e.preventDefault();
    if (!interventionInput.trim() || !activeDiscussionId) return;

    const msg = interventionInput.trim();
    setInterventionInput('');
    setStreamTurns(prev => [...prev, {
      id: `human-${Date.now()}`,
      speaker: 'Human Supervisor',
      content: msg,
      is_human: true
    }]);

    try {
      const targetId = targetInterventionAgentId === 'leader' ? leaderId : targetInterventionAgentId;
      const res = await fetch(`/api/chat/discussions/${activeDiscussionId}/participate/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          target_agent_id: targetId || undefined
        })
      });

      if (res.ok) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let replyObj = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.replace('data: ', '').trim();
              if (!dataStr) continue;
              const event = JSON.parse(dataStr);
              if (event.type === 'agent_turn_start') {
                replyObj = {
                  id: `reply-${Date.now()}`,
                  agent_id: event.agent_id,
                  agent_name: event.agent_name,
                  agent_avatar: event.agent_avatar,
                  role: event.role,
                  content: ''
                };
                setCurrentTurn(replyObj);
              } else if (event.type === 'agent_token' && replyObj) {
                replyObj.content += event.content;
                setCurrentTurn({ ...replyObj });
              } else if (event.type === 'agent_turn_end' && replyObj) {
                const fin = { ...replyObj };
                setStreamTurns(prev => [...prev, fin]);
                queueVoicePlayback(fin.content, voiceMap[fin.agent_id] || 'en-US-JennyNeural', fin.id, fin.agent_id);
                setCurrentTurn(null);
                replyObj = null;
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Intervention stream failed:', err);
    }
  };

  const handleExportDiscussion = async (fmt = 'md') => {
    if (!activeDiscussionId) return;
    try {
      const res = await fetch(`/api/chat/discussions/${activeDiscussionId}/export?format=${fmt}`);
      if (fmt === 'json') {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debate_${activeDiscussionId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const text = await res.text();
        const blob = new Blob([text], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debate_${activeDiscussionId}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleSaveVerdictToMemory = async () => {
    if (!finalSynthesis || !topic) return;
    try {
      await fetch('/api/memory/facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: `Debate Verdict: ${topic.slice(0, 50)}`,
          value: finalSynthesis.slice(0, 1500),
          category: 'project_rule',
          source: 'debate_outcome',
          is_pinned: 1
        })
      });
      setMemorySavedFeedback(true);
      setTimeout(() => setMemorySavedFeedback(false), 2500);
    } catch (e) {
      console.error('Failed to save to memory:', e);
    }
  };

  const getStanceTheme = (stance) => {
    if (!stance || !stance.type) return { badge: 'bg-gray-700/40 text-gray-300 border-gray-600', label: 'NEUTRAL' };
    const t = stance.type.toUpperCase();
    if (t === 'AGREE') return { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', label: `AGREE (${stance.target || 'Team'})` };
    if (t === 'DISAGREE') return { badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40', label: `REBUTTAL (${stance.target || 'Claim'})` };
    if (t === 'PARTIAL') return { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', label: `PARTIAL (${stance.target || 'Trade-off'})` };
    return { badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', label: 'ANALYSIS' };
  };

  const selectedAgentsList = useMemo(() => {
    return selectedAgentIds.map(id => agents.find(a => a.id === id)).filter(Boolean);
  }, [selectedAgentIds, agents]);

  return (
    <div className="flex-1 flex overflow-hidden bg-[#090b12] text-gray-100 font-sans">
      
      {/* 1. Left Sidebar: Past Debates & Templates */}
      <div className="w-80 border-r border-card-border/80 bg-[#0d101c] flex flex-col justify-between shrink-0 select-none overflow-hidden">
        
        {/* Top Header */}
        <div className="p-4 border-b border-card-border/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Swords className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Executive Arena
              </h2>
              <p className="text-[10px] text-gray-400">Multi-Agent Deliberation</p>
            </div>
          </div>

          <button
            onClick={() => {
              setViewMode('config');
              setActiveDiscussionId(null);
            }}
            className={`p-2 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
              viewMode === 'config'
                ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/20'
                : 'bg-[#141829] border-card-border text-gray-400 hover:text-white'
            }`}
            title="Configure New Debate"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Discussions List & Templates */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          
          {/* Quick Presets Section */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold font-mono uppercase text-gray-400 px-1">
              Debate Presets
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {DEBATE_TEMPLATES.map(tpl => {
                const Icon = tpl.icon;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => {
                      handleApplyTemplate(tpl);
                      setViewMode('config');
                    }}
                    className="p-2 rounded-xl bg-[#111424] hover:bg-[#181d32] border border-card-border hover:border-purple-500/40 text-left transition-all group cursor-pointer flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-gray-300 group-hover:text-white truncate">
                      <Icon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate text-[11px]">{tpl.title.split(' ')[0]}</span>
                    </div>
                    <span className="text-[9px] text-gray-500 mt-1 line-clamp-1">{tpl.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Past Discussions */}
          <div className="space-y-2 pt-2 border-t border-card-border/60">
            <span className="text-[10px] font-bold font-mono uppercase text-gray-400 px-1 flex items-center justify-between">
              <span>Debate History</span>
              <span className="text-gray-500">{discussions.length}</span>
            </span>

            {discussions.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-xs font-mono">
                No past debates recorded yet.
              </div>
            ) : (
              discussions.map(disc => {
                const isActive = activeDiscussionId === disc.id;
                return (
                  <div
                    key={disc.id}
                    onClick={() => handleSelectPastDiscussion(disc)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between space-y-2 ${
                      isActive
                        ? 'bg-[#181d32] border-purple-500/70 shadow-lg shadow-purple-500/10'
                        : 'bg-[#101322] border-card-border/80 hover:bg-[#141829] hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-xs text-gray-200 line-clamp-2 leading-relaxed">
                        {disc.topic}
                      </h4>
                      <button
                        onClick={(e) => handleDeleteDiscussion(e, disc.id)}
                        className="p-1 rounded text-gray-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                        title="Delete record"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 pt-1 border-t border-white/5">
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{new Date(disc.created_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                      </span>

                      <span className={`px-1.5 py-0.2 rounded border text-[9px] font-bold ${
                        disc.status === 'completed'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}>
                        {disc.status || 'saved'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Global Voiceover Toggle in Sidebar Footer */}
        <div className="p-3.5 border-t border-card-border/60 bg-[#0a0c16] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {globalVoiceEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
              ) : (
                <VolumeX className="w-4 h-4 text-gray-500" />
              )}
              <div>
                <div className="text-xs font-bold text-gray-200 font-mono">Neural Voiceover</div>
                <div className="text-[10px] text-gray-500">Unique voice per agent</div>
              </div>
            </div>

            <button
              onClick={toggleGlobalVoice}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                globalVoiceEnabled ? 'bg-emerald-500' : 'bg-gray-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition duration-200 ease-in-out ${
                  globalVoiceEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

      </div>

      {/* 2. Main Work Area: Config vs Round-Table Chamber */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* =========================================================================
            VIEW 1: DEBATE CONFIGURATION SCREEN
           ========================================================================= */}
        {viewMode === 'config' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-5xl mx-auto w-full">
            
            {/* Header Banner */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-card-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <h1 className="text-lg font-bold text-white">Configure Executive Round-Table</h1>
                </div>
                <p className="text-xs text-gray-400">
                  Select participating specialist agents, assign perspectives, attach technical specs, and launch multi-round deliberation.
                </p>
              </div>

              <button
                onClick={handleStartDebate}
                disabled={isStreaming || !topic.trim() || selectedAgentIds.length < 2}
                className={`px-6 py-2.5 rounded-xl font-bold text-xs font-mono flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
                  topic.trim() && selectedAgentIds.length >= 2
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white shadow-purple-600/30'
                    : 'bg-[#181d30] text-gray-500 border border-white/5 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Enter Debate Chamber</span>
              </button>
            </div>

            {/* Step 1: Topic Definition */}
            <div className="p-5 rounded-2xl bg-[#0e111d] border border-card-border space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold font-mono uppercase text-purple-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-[10px]">1</span>
                  <span>Debate Topic / Strategic Proposal</span>
                </label>
                <span className="text-[10px] font-mono text-gray-400">Core question for deliberation</span>
              </div>

              <textarea
                rows={3}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Architecture trade-off: Should we migrate to microservices with Kafka, or stay on a modular monolith with SQLite/PostgreSQL?"
                className="w-full bg-[#131728] border border-card-border rounded-xl p-3.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none font-sans leading-relaxed"
              />
            </div>

            {/* Step 2: Lineup Selection & Role Customization */}
            <div className="p-5 rounded-2xl bg-[#0e111d] border border-card-border space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold font-mono uppercase text-purple-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-[10px]">2</span>
                  <span>Select Agents, Roles & Neural Voice Mapping ({selectedAgentIds.length} Selected)</span>
                </label>
                <span className="text-[10px] font-mono text-gray-400">Minimum 2 agents required</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {agents.map(agent => {
                  const isSelected = selectedAgentIds.includes(agent.id);
                  const isLeader = leaderId === agent.id;
                  const currentRole = rolesMap[agent.id] || agent.role || 'Debater';
                  const currentVoice = voiceMap[agent.id] || 'en-US-JennyNeural';

                  return (
                    <div
                      key={agent.id}
                      className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                        isSelected
                          ? 'bg-[#15192c] border-purple-500/80 shadow-md shadow-purple-500/10'
                          : 'bg-[#101322] border-card-border/70 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 truncate">
                          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-base shrink-0">
                            {agent.avatar || '🤖'}
                          </div>
                          <div className="truncate">
                            <h4 className="font-bold text-xs text-white truncate">{agent.name}</h4>
                            <div className="text-[10px] text-gray-400 font-mono truncate">{agent.model_id}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isSelected && (
                            <button
                              onClick={() => setLeaderId(agent.id)}
                              className={`p-1.5 rounded-lg border text-[10px] font-mono flex items-center gap-1 transition-colors cursor-pointer ${
                                isLeader
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                                  : 'bg-[#121526] text-gray-400 hover:text-amber-300 border-white/5'
                              }`}
                              title={isLeader ? 'Executive Moderator / Synthesizer' : 'Make Executive Leader'}
                            >
                              <Crown className={`w-3 h-3 ${isLeader ? 'text-amber-400 fill-amber-400' : ''}`} />
                              <span>{isLeader ? 'Lead' : 'Make Lead'}</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              if (isSelected) {
                                setSelectedAgentIds(prev => prev.filter(id => id !== agent.id));
                              } else {
                                setSelectedAgentIds(prev => [...prev, agent.id]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-[#161a2c] hover:bg-[#20263e] text-gray-300 border border-card-border'
                            }`}
                          >
                            {isSelected ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      </div>

                      {/* Role & Voice Customization when Selected */}
                      {isSelected && (
                        <div className="pt-2 border-t border-white/5 space-y-2">
                          <div className="space-y-1">
                            <span className="text-[9px] font-mono uppercase text-gray-400 block">Assigned Perspective</span>
                            <input
                              type="text"
                              value={currentRole}
                              onChange={(e) => setRolesMap({ ...rolesMap, [agent.id]: e.target.value })}
                              placeholder="e.g. Lead Proponent or Security Auditor"
                              className="w-full bg-[#0c0e18] border border-card-border/80 rounded-xl px-2.5 py-1 text-xs text-purple-200 focus:outline-none focus:border-purple-500 font-sans"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-mono uppercase text-gray-400 flex items-center gap-1">
                              <Volume2 className="w-3 h-3 text-cyan-400" />
                              <span>Voice</span>
                            </span>

                            <select
                              value={currentVoice}
                              onChange={(e) => setVoiceMap({ ...voiceMap, [agent.id]: e.target.value })}
                              className="bg-[#0c0e18] border border-card-border/80 rounded-lg px-2 py-0.5 text-[10px] text-cyan-300 font-mono focus:outline-none cursor-pointer"
                            >
                              {CURATED_VOICES.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Attached Documents & Rounds */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Document Attachments */}
              <div className="md:col-span-2 p-5 rounded-2xl bg-[#0e111d] border border-card-border space-y-3 shadow-md">
                <label className="text-xs font-bold font-mono uppercase text-purple-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-[10px]">3</span>
                  <span>Attach Knowledge & Specs ({selectedDocIds.length})</span>
                </label>

                {documents.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-xs font-mono">
                    No documents uploaded in Document Inventory yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {documents.map(doc => {
                      const isAttached = selectedDocIds.includes(doc.id);
                      return (
                        <button
                          key={doc.id}
                          onClick={() => {
                            if (isAttached) setSelectedDocIds(prev => prev.filter(id => id !== doc.id));
                            else setSelectedDocIds(prev => [...prev, doc.id]);
                          }}
                          className={`p-2.5 rounded-xl border text-left text-xs font-mono flex items-center justify-between transition-all cursor-pointer ${
                            isAttached
                              ? 'bg-purple-500/20 border-purple-500 text-purple-200 font-bold'
                              : 'bg-[#121526] border-card-border text-gray-400 hover:border-gray-500'
                          }`}
                        >
                          <span className="truncate mr-2">{doc.filename}</span>
                          <span className="text-[9px] opacity-70">{(doc.size / 1024).toFixed(0)} KB</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Rounds & Settings */}
              <div className="p-5 rounded-2xl bg-[#0e111d] border border-card-border space-y-3 shadow-md flex flex-col justify-between">
                <div className="space-y-2">
                  <label className="text-xs font-bold font-mono uppercase text-purple-400 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-[10px]">4</span>
                    <span>Debate Rounds</span>
                  </label>

                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map(r => (
                      <button
                        key={r}
                        onClick={() => setRounds(r)}
                        className={`flex-1 py-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                          rounds === r
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'bg-[#141829] border border-card-border text-gray-400 hover:text-white'
                        }`}
                      >
                        {r} {r === 1 ? 'Round' : 'Rounds'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[10px] text-gray-400 font-mono space-y-1">
                  <div>• Round 1: Parallel Opening Statements</div>
                  <div>• Round 2: Targeted Rebuttals</div>
                  <div>• Final: Executive Synthesis & Verdict</div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* =========================================================================
            VIEW 2: ROUND-TABLE DEBATE CHAMBER & LIVE AUDIO ARENA
           ========================================================================= */}
        {viewMode === 'chamber' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0c16]">
            
            {/* Top Chamber Header & Consensus Bar */}
            <div className="p-4 border-b border-card-border/80 bg-gradient-to-r from-[#101424] via-[#0d101c] to-[#0a0c16] flex items-center justify-between flex-wrap gap-4 shrink-0">
              
              {/* Topic & Round Indicator */}
              <div className="flex items-center gap-3 truncate max-w-2xl">
                <button
                  onClick={() => {
                    stopAllAudio();
                    setViewMode('config');
                  }}
                  className="p-2 rounded-xl bg-[#141829] hover:bg-[#1f253e] text-gray-400 hover:text-white border border-card-border transition-colors cursor-pointer shrink-0"
                  title="Back to Config"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-white truncate">{topic || 'Executive Roundtable Debate'}</h2>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold shrink-0 ${
                      isStreaming
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}>
                      {isStreaming ? `● LIVE: Round ${currentRound} (${currentPhase})` : 'Concluded'}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                    {selectedAgentsList.map(a => a.name).join(' • ')}
                  </div>
                </div>
              </div>

              {/* Consensus Meter & Actions */}
              <div className="flex items-center gap-3">
                {/* Consensus Gauge */}
                <div className="p-2 px-3 rounded-xl bg-[#121526] border border-card-border flex items-center gap-2.5">
                  <div className="text-[10px] font-mono text-gray-400">Consensus:</div>
                  <div className="w-20 bg-gray-800 rounded-full h-2 overflow-hidden border border-white/5">
                    <div
                      className={`h-full transition-all duration-500 ${
                        consensusScore >= 70
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : consensusScore >= 40
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                          : 'bg-gradient-to-r from-rose-500 to-amber-500'
                      }`}
                      style={{ width: `${consensusScore}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono font-bold text-white">{consensusScore}%</span>
                </div>

                {/* Voiceover Quick Toggle */}
                <button
                  onClick={toggleGlobalVoice}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                    globalVoiceEnabled
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-[#141829] border-card-border text-gray-500 hover:text-gray-300'
                  }`}
                  title={globalVoiceEnabled ? 'Voiceover Active' : 'Voiceover Muted'}
                >
                  {globalVoiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>{globalVoiceEnabled ? 'Audio ON' : 'Audio OFF'}</span>
                </button>

                {/* Stop / Export */}
                {isStreaming ? (
                  <button
                    onClick={handleStopDebate}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Square className="w-3 h-3 fill-rose-400" />
                    <span>Stop Debate</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleExportDiscussion('md')}
                      className="px-3 py-1.5 rounded-xl bg-[#141829] hover:bg-[#1f253e] text-gray-300 hover:text-white border border-card-border text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Export MD</span>
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Semicircle / Horseshoe Podium Chamber */}
            <div className="px-4 py-3 bg-[#0d101c] border-b border-card-border/60 overflow-x-auto">
              <div className="flex items-center justify-center gap-3 min-w-max mx-auto">
                {selectedAgentsList.map((agent) => {
                  const isGenerating = activeSpeakerId === agent.id;
                  const isAudioSpeaking = speakingAgentId === agent.id;
                  const isSpeaking = isGenerating || isAudioSpeaking;
                  const isLeader = leaderId === agent.id;
                  const role = rolesMap[agent.id] || agent.role;
                  const voice = voiceMap[agent.id];

                  return (
                    <div
                      key={agent.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center gap-3 relative min-w-[200px] ${
                        isSpeaking
                          ? 'bg-gradient-to-b from-[#1e233d] to-[#15192c] border-emerald-400 shadow-xl shadow-emerald-500/20 ring-2 ring-emerald-500/30 scale-105'
                          : 'bg-[#111424] border-card-border/80 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="relative">
                        <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-lg shadow">
                          {agent.avatar || '🤖'}
                        </div>
                        {isSpeaking && (
                          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#0d101c] animate-ping" />
                        )}
                      </div>

                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs text-white truncate">{agent.name}</h4>
                          {isLeader && <Crown className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                        </div>
                        <div className="text-[10px] text-purple-300 font-sans truncate">{role}</div>
                        {isSpeaking ? (
                          <div className="text-[9px] font-mono text-emerald-400 flex items-center gap-1 mt-0.5 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>{isAudioSpeaking ? 'Speaking...' : 'Thinking...'}</span>
                          </div>
                        ) : (
                          <div className="text-[9px] font-mono text-gray-500 truncate mt-0.5">
                            Voice: {voice?.split('-')[2]?.replace('Neural', '') || 'Natural'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Chamber Stream Transcript */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              
              {/* Turns Stream */}
              {streamTurns.map((turn, idx) => {
                const isHuman = turn.is_human;
                const isTurnSpeaking = speakingTurnId === turn.id;
                const stanceMeta = getStanceTheme(turn.stance);

                return (
                  <div
                    key={turn.id || idx}
                    className={`p-4 rounded-2xl border transition-all flex flex-col space-y-2.5 shadow-md ${
                      isHuman
                        ? 'bg-[#1a1426] border-purple-500/50 mr-8'
                        : isTurnSpeaking
                        ? 'bg-[#15192c] border-emerald-500/70 shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                        : 'bg-[#0f1220] border-card-border/80 hover:border-gray-600'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-7 h-7 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-xs shrink-0">
                          {isHuman ? '👤' : (turn.agent_avatar || '🤖')}
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-xs text-white font-mono">{turn.speaker || turn.agent_name}</span>
                          {turn.role && <span className="text-[10px] text-gray-400 ml-2 font-sans">({turn.role})</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {turn.stance && (
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border font-bold ${stanceMeta.badge}`}>
                            {stanceMeta.label}
                          </span>
                        )}

                        <button
                          onClick={() => handlePlayTurnVoice(turn)}
                          className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                            isTurnSpeaking
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/40'
                              : 'bg-[#141829] text-gray-500 hover:text-cyan-300 border-card-border'
                          }`}
                          title={isTurnSpeaking ? "Stop Speaking" : "Listen with Agent Neural Voice"}
                        >
                          {isTurnSpeaking ? <VolumeX className="w-3 h-3 text-emerald-400 animate-pulse" /> : <Volume2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="text-xs text-gray-200 font-sans leading-relaxed whitespace-pre-wrap select-text pl-9">
                      {turn.content}
                    </div>
                  </div>
                );
              })}

              {/* Current Active Streaming Turn */}
              {currentTurn && (
                <div className="p-4 rounded-2xl bg-[#15192c] border border-purple-500 shadow-xl shadow-purple-500/10 space-y-2.5 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xs">
                        {currentTurn.agent_avatar || '🤖'}
                      </div>
                      <div>
                        <span className="font-bold text-xs text-white font-mono">{currentTurn.agent_name}</span>
                        <span className="text-[10px] text-purple-300 ml-2 font-sans">({currentTurn.role})</span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Synthesizing argument...</span>
                    </span>
                  </div>

                  <div className="text-xs text-gray-200 font-sans leading-relaxed whitespace-pre-wrap select-text pl-9">
                    {currentTurn.content || 'Drafting response...'}
                  </div>
                </div>
              )}

              {/* Final Synthesis & Verdict Card */}
              {finalSynthesis && (
                <div className="p-6 rounded-3xl bg-gradient-to-b from-[#13192e] to-[#0e1222] border-2 border-purple-500/50 space-y-4 shadow-2xl animate-fade-in">
                  <div className="flex items-center justify-between pb-3 border-b border-card-border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                        <Award className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white font-mono flex items-center gap-2">
                          <span>Executive Consensus Verdict & Action Plan</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono border border-emerald-500/30">
                            Consensus: {consensusScore}%
                          </span>
                        </h3>
                        <p className="text-[11px] text-gray-400">
                          Structured outcome synthesized by Executive Lead
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveVerdictToMemory}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                          memorySavedFeedback
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-bold'
                            : 'bg-[#181e36] border-purple-500/40 text-purple-300 hover:bg-purple-500/20'
                        }`}
                      >
                        {memorySavedFeedback ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Bookmark className="w-3.5 h-3.5" />}
                        <span>{memorySavedFeedback ? 'Saved to Memory!' : 'Save to Memory Facts'}</span>
                      </button>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(finalSynthesis);
                          setCopiedSection(true);
                          setTimeout(() => setCopiedSection(false), 2000);
                        }}
                        className="p-1.5 rounded-xl bg-[#181e36] text-gray-400 hover:text-white border border-card-border cursor-pointer"
                        title="Copy Verdict"
                      >
                        {copiedSection ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#080a10] border border-white/5 text-xs text-gray-200 font-sans leading-relaxed whitespace-pre-wrap select-text">
                    {finalSynthesis}
                  </div>
                </div>
              )}

              <div ref={streamEndRef} />
            </div>

            {/* Bottom Chamber Intervention Box */}
            <div className="p-3.5 border-t border-card-border/80 bg-[#0c0e18] shrink-0">
              <form onSubmit={handleSendIntervention} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono shrink-0">
                  <User className="w-3.5 h-3.5 text-purple-400" />
                  <span className="hidden sm:inline">Intervene</span>
                </div>

                <select
                  value={targetInterventionAgentId}
                  onChange={(e) => setTargetInterventionAgentId(e.target.value)}
                  className="bg-[#141829] border border-card-border/80 rounded-xl px-2.5 py-2 text-xs text-gray-300 font-mono focus:outline-none focus:border-purple-500 shrink-0 cursor-pointer"
                >
                  <option value="leader">Direct to Executive Lead</option>
                  {selectedAgentsList.map(a => (
                    <option key={a.id} value={a.id}>Direct to {a.name}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={interventionInput}
                  onChange={(e) => setInterventionInput(e.target.value)}
                  placeholder="Inject human supervisor guidance, challenge an assumption, or steer discussion..."
                  className="flex-1 bg-[#141829] border border-card-border rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-sans"
                />

                <button
                  type="submit"
                  disabled={!interventionInput.trim()}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs font-mono flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
