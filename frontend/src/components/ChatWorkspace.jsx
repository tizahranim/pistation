import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { 
  Send, 
  Sparkles, 
  Copy, 
  Check, 
  ChevronRight, 
  Paperclip, 
  FileText, 
  X, 
  Zap, 
  Clock, 
  Upload, 
  Loader2, 
  FolderOpen, 
  Layers, 
  Terminal, 
  ShieldAlert, 
  Code2, 
  Command, 
  FileCode,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Headphones
} from 'lucide-react';
import DiffViewer from './DiffViewer';
import { sessionStreamManager } from '../services/sessionStreamManager';

const SLASH_COMMANDS = [
  { cmd: '/refactor', label: 'Refactor Code', desc: 'Improve structure, readability, and performance', prompt: 'Refactor and optimize the following code for readability, performance, and maintainability:\n' },
  { cmd: '/test', label: 'Generate Tests', desc: 'Create comprehensive unit tests & coverage', prompt: 'Generate comprehensive unit and integration tests covering all edge cases for:\n' },
  { cmd: '/explain', label: 'Explain Concept/Code', desc: 'Step-by-step breakdown & architecture', prompt: 'Explain the architecture and implementation details of:\n' },
  { cmd: '/security-audit', label: 'Security Audit', desc: 'Scan for vulnerabilities & OWASP risks', prompt: 'Perform an in-depth security and vulnerability audit on:\n' },
  { cmd: '/summarize', label: 'Executive Summary', desc: 'Crisp summary with bulleted action items', prompt: 'Provide a crisp executive summary with key takeaways and action items for:\n' },
  { cmd: '/plan', label: 'Implementation Plan', desc: 'Create a multi-phase implementation roadmap', prompt: 'Create a detailed step-by-step implementation plan for:\n' }
];

export default function ChatWorkspace({ 
  agents = [], 
  activeAgentId, 
  activeModel, 
  documents = [], 
  activeSessionId, 
  setActiveSessionId, 
  onRefreshSessions, 
  onRefreshDocuments,
  queuedPrompt,
  onClearQueuedPrompt
}) {
  const { t, isRTL } = useLanguage();

  const getLocalizedRole = (role) => {
    if (!isRTL) return role || 'Autonomous coding and research specialist';
    if (!role) return 'مساعد الذكاء الاصطناعي المتخصص في البرمجة والبحث';
    const map = {
      'Generalist Problem Solver & Code Orchestrator': 'المساعد العام المتقدم وحلال المشكلات والأكواد',
      'System Architect & Cloud Infrastructure': 'مهندس النظم والبنية التحتية السحابية',
      'Security Auditor & Vulnerability Hunter': 'مدقق الأمان واكتشاف الثغرات البرمجية',
      'Doc Analyst & Research Synthesis': 'محلل المستندات واستخلاص البحوث',
      'General Purpose Agent': 'وكيل متعدد الاستخدامات'
    };
    return map[role] || role;
  };

  const [messages, setMessages] = useState([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Voice Chat state
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  // Slash commands state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);

  // Quick prompts dispatched from the Overview dispatch bar (queued so they auto-send once the workspace is ready)
  const [pendingQuickPrompts, setPendingQuickPrompts] = useState([]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const docPickerRef = useRef(null);
  const skipNextFetchRef = useRef(false);

  // Click outside to close Library Document Picker
  useEffect(() => {
    const handleClickOutsideDocPicker = (e) => {
      if (docPickerRef.current && !docPickerRef.current.contains(e.target)) {
        setShowDocPicker(false);
      }
    };
    if (showDocPicker) {
      document.addEventListener('mousedown', handleClickOutsideDocPicker);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideDocPicker);
    };
  }, [showDocPicker]);

  const activeAgent = agents.find(a => a.id === activeAgentId) || agents[0];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const handleQuickPrompt = (e) => {
      const prompt = e.detail?.prompt;
      if (prompt && prompt.trim()) {
        setPendingQuickPrompts(prev => [...prev, prompt.trim()]);
      }
    };
    window.addEventListener('pi:quick_prompt', handleQuickPrompt);
    return () => window.removeEventListener('pi:quick_prompt', handleQuickPrompt);
  }, []);

  // Auto-focus input box whenever a session opens, new chat starts, or stream completes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [activeSessionId, isLoading]);

  const [isMediaRecording, setIsMediaRecording] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  // Check speech support & initialize recognition
  useEffect(() => {
    const hasSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    setSpeechSupported(hasSpeech);

    if (hasSpeech) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInputPrompt(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, []);

  const startMediaRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size > 100) {
          setIsTranscribingAudio(true);
          const formData = new FormData();
          formData.append('file', audioBlob, 'recording.webm');
          try {
            const res = await fetch('/api/voice/transcribe', {
              method: 'POST',
              body: formData
            });
            if (res.ok) {
              const data = await res.json();
              if (data.text) {
                setInputPrompt(prev => (prev ? prev + ' ' : '') + data.text);
              }
            }
          } catch (err) {
            console.error('Transcription request failed:', err);
          } finally {
            setIsTranscribingAudio(false);
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsMediaRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access failed:', err);
      alert('Microphone access was blocked. Please grant microphone permissions in your browser.');
    }
  };

  const stopMediaRecording = () => {
    if (mediaRecorderRef.current && isMediaRecording) {
      mediaRecorderRef.current.stop();
      setIsMediaRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const toggleListening = () => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeakingMsgId(null);

    // If Web Speech API is available, use client-side speech recognition
    if (recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
      } else {
        try {
          recognitionRef.current.start();
        } catch (err) {
          console.error('Failed to start speech recognition:', err);
        }
      }
      return;
    }

    // Fallback: Universal MediaRecorder for Firefox, Safari, and other browsers
    if (isMediaRecording) {
      stopMediaRecording();
    } else {
      startMediaRecording();
    }
  };

  const [selectedVoice, setSelectedVoice] = useState('en-US-JennyNeural');
  const currentAudioRef = useRef(null);

  const stopAudio = () => {
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current.src = '';
      } catch (e) {}
      currentAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    setSpeakingMsgId(null);
  };

  const speakText = async (text, msgId) => {
    // If currently speaking this message, pause and cancel
    if (speakingMsgId === msgId) {
      stopAudio();
      return;
    }

    // Stop any ongoing audio immediately before starting new one
    stopAudio();
    setSpeakingMsgId(msgId);

    // Clean emojis, code blocks, and markdown before synthesis
    const cleanSpeechText = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}-\u{2B55}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[#*_\->]/g, '')
      .trim();

    if (!cleanSpeechText) {
      setSpeakingMsgId(null);
      return;
    }

    try {
      // 1. High-Definition Neural Human Voice Synthesis
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanSpeechText,
          voice: selectedVoice
        })
      });

      if (res.ok) {
        const audioBlob = await res.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;

        audio.onended = () => {
          setSpeakingMsgId(null);
          currentAudioRef.current = null;
          URL.revokeObjectURL(audioUrl);
        };
        audio.onerror = () => {
          setSpeakingMsgId(null);
          currentAudioRef.current = null;
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
        return;
      }
    } catch (err) {
      console.error('Neural TTS fetch error, falling back to browser synthesis:', err);
    }

    // Fallback: browser SpeechSynthesis
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(cleanSpeechText.slice(0, 1500));
      utterance.rate = 1.0;
      utterance.onend = () => setSpeakingMsgId(null);
      utterance.onerror = () => setSpeakingMsgId(null);
      window.speechSynthesis.speak(utterance);
    } else {
      setSpeakingMsgId(null);
    }
  };

  // Subscribe to background stream updates
  useEffect(() => {
    const unsubscribe = sessionStreamManager.subscribe((sessionId, streamState) => {
      if (sessionId === activeSessionId) {
        if (streamState) {
          setMessages(streamState.messages);
          setIsLoading(streamState.isStreaming);
        }
      }
    });
    return () => unsubscribe();
  }, [activeSessionId]);

  // Load session messages when activeSessionId changes
  useEffect(() => {
    if (activeSessionId) {
      const activeStream = sessionStreamManager.getStreamState(activeSessionId);
      if (activeStream) {
        setMessages(activeStream.messages);
        setIsLoading(activeStream.isStreaming);
      } else {
        setIsLoading(false);
        fetch(`/api/chat/sessions/${activeSessionId}/messages`)
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              setMessages(data);
            }
          })
          .catch(err => console.error('Failed to load session messages:', err));
      }
    } else {
      setMessages([]);
      setIsLoading(false);
    }
  }, [activeSessionId]);

  // Direct file upload
  const handleUploadFiles = async (files) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.document && data.document.id) {
            setSelectedDocIds(prev => [...new Set([...prev, data.document.id])]);
            onRefreshDocuments?.();
          }
        }
      } catch (err) {
        console.error('File upload failed:', err);
      }
    }
    setIsUploading(false);
  };

  // Slash command handler
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputPrompt(val);

    if (val.startsWith('/')) {
      setShowSlashMenu(true);
      setSlashFilter(val.slice(1).toLowerCase());
      setSelectedSlashIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSelectSlashCommand = (cmd) => {
    setInputPrompt(cmd.prompt);
    setShowSlashMenu(false);
    inputRef.current?.focus();
  };

  const handleSendMessage = async (e, overridePrompt) => {
    e?.preventDefault();
    const promptToSend = (overridePrompt !== undefined ? overridePrompt : inputPrompt).trim();
    if (!promptToSend || isLoading) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    setShowSlashMenu(false);
    const currentInput = promptToSend;
    setInputPrompt('');

    // Start asynchronous parallel background stream
    sessionStreamManager.startStream({
      sessionId: activeSessionId,
      agent: activeAgent,
      model: activeModel,
      prompt: currentInput,
      documentIds: selectedDocIds,
      initialMessages: activeSessionId ? messages : [],
      onSessionCreated: (newSessionId) => {
        setActiveSessionId(newSessionId);
        onRefreshSessions?.();
      },
      onRefreshSessions: onRefreshSessions,
      onSpeak: (replyText, msgId) => {
        if (autoSpeak && replyText) {
          speakText(replyText, msgId);
        }
      }
    });
  };

  // Auto-send any quick prompts dispatched from the Overview bar
  useEffect(() => {
    if (queuedPrompt && queuedPrompt.trim()) {
      const promptText = queuedPrompt.trim();
      onClearQueuedPrompt?.();
      const timer = setTimeout(() => {
        handleSendMessage(null, promptText);
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [queuedPrompt]);

  useEffect(() => {
    if (pendingQuickPrompts.length === 0) return;
    const prompt = pendingQuickPrompts[0];
    setPendingQuickPrompts(prev => prev.slice(1));
    handleSendMessage(null, prompt);
  }, [pendingQuickPrompts]);

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Drag & drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const filteredSlash = SLASH_COMMANDS.filter(s =>
    s.cmd.toLowerCase().includes(slashFilter) ||
    s.label.toLowerCase().includes(slashFilter)
  );

  // Helper to render message content with inline diff blocks if present
  const renderMessageContent = (content) => {
    if (!content) return null;
    
    if (content.includes('```diff')) {
      const parts = content.split('```diff');
      return parts.map((part, pIdx) => {
        if (pIdx === 0) {
          return <span key={pIdx}>{part}</span>;
        }
        const [diffCode, ...rest] = part.split('```');
        return (
          <React.Fragment key={pIdx}>
            <DiffViewer diffText={diffCode.trim()} filename="Code Modification" />
            <span>{rest.join('```')}</span>
          </React.Fragment>
        );
      });
    }

    return content;
  };

  return (
    <div 
      className="flex-1 flex flex-col justify-between overflow-hidden bg-background relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => handleUploadFiles(e.target.files)}
        multiple
        className="hidden"
      />

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-emerald-500/10 border-2 border-dashed border-emerald-400/60 z-50 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none">
          <Upload className="w-10 h-10 text-emerald-400 animate-bounce mb-2" />
          <span className="text-sm font-semibold text-emerald-300">Drop files here to attach to chat</span>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-indigo-500/20 border border-emerald-500/30 flex items-center justify-center text-3xl shadow-xl shadow-emerald-500/5">
              {activeAgent?.avatar || '⚡'}
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-100">{activeAgent?.name || 'Pi Agent'}</h3>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {getLocalizedRole(activeAgent?.role)}
              </p>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card-border/50 text-[11px] font-mono text-gray-300 border border-card-border">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{isRTL ? 'المحرك:' : 'Engine:'} {activeModel?.model || activeAgent?.model_id}</span>
                <span className="text-gray-500">({activeModel?.provider || 'ollama'})</span>
              </div>
            </div>

            {/* Quick Slash Commands Starter Chips */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap pt-2">
              {SLASH_COMMANDS.slice(0, 4).map(sc => (
                <button
                  key={sc.cmd}
                  onClick={() => handleSelectSlashCommand(sc)}
                  className="px-2.5 py-1 rounded-lg bg-[#141824] hover:bg-[#1c2233] border border-card-border text-[11px] font-mono text-emerald-300 transition-colors flex items-center gap-1"
                >
                  <Command className="w-3 h-3 text-emerald-400" />
                  <span>{sc.cmd}</span>
                </button>
              ))}
            </div>

            {/* Starter Suggestions */}
            <div className="grid grid-cols-2 gap-2 w-full pt-2 text-left">
              {(isRTL ? [
                "فحص أمان الكود البرمجي والأداء",
                "فحص مجلد التنزيلات والمستندات",
                "تصميم معمارية نظام برمجية متكاملة",
                "استخلاص الرؤى والتحليلات من الملفات"
              ] : [
                "Audit code security & performance",
                "Check my download directory",
                "Design a full-stack system architecture",
                "Synthesize insights from uploaded files"
              ]).map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputPrompt(s);
                    inputRef.current?.focus();
                  }}
                  className={`p-2.5 rounded-lg bg-card/60 hover:bg-card border border-card-border/80 text-xs text-gray-300 hover:text-emerald-300 transition-all hover:border-emerald-500/30 ${isRTL ? 'text-right' : 'text-left'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const approxTokens = Math.max(1, Math.round((msg.content?.length || 0) / 4));
            const modelName = msg.model_id || activeModel?.model || 'qwen3.8:27b';
            const providerName = msg.model_provider || activeModel?.provider || 'ollama';
            const isSpeakingThis = speakingMsgId === (msg.id || idx);

            return (
              <div
                key={msg.id || idx}
                className={`flex gap-3 max-w-3xl mx-auto ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-lg bg-card-border/80 border border-white/5 flex items-center justify-center text-base shrink-0 shadow-sm mt-1">
                    {msg.agent_avatar || activeAgent?.avatar || '🤖'}
                  </div>
                )}

                <div className={`space-y-1.5 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                  {/* Detailed Speaker & Model Header */}
                  <div className="flex items-center gap-2 text-[11px] font-mono flex-wrap">
                    <span className="font-semibold text-gray-200">
                      {isUser ? 'You' : (msg.agent_name || activeAgent?.name)}
                    </span>

                    {!isUser && (
                      <>
                        <span className="text-gray-600">•</span>
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#181d2c] border border-card-border text-[10px] text-gray-300">
                          <Zap className="w-2.5 h-2.5 text-amber-400" />
                          <span className="font-medium text-emerald-300 truncate max-w-[150px]">{modelName}</span>
                          <span className="text-[9px] text-gray-500 font-sans">
                            ({['openrouter', 'openai', 'anthropic'].includes(providerName) ? 'Cloud' : 'Local'})
                          </span>
                        </div>
                      </>
                    )}

                    <span className="text-[10px] text-gray-500 ml-auto">
                      {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Thinking Accordion */}
                  {msg.thinking_content && (
                    <details className="group rounded-lg bg-[#121520] border border-card-border/70 p-2 text-xs shadow-inner">
                      <summary className="cursor-pointer text-gray-400 hover:text-gray-200 flex items-center gap-1.5 font-mono text-[11px] select-none">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Reasoning Process ({Math.round(msg.thinking_content.length / 4)} tokens)</span>
                        <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90 ml-auto" />
                      </summary>
                      <div className="mt-2 text-gray-400 font-mono text-[11px] whitespace-pre-wrap pl-2 border-l border-amber-500/30 leading-relaxed">
                        {msg.thinking_content}
                      </div>
                    </details>
                  )}

                  {/* Main Message Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm relative group ${
                      isUser
                        ? 'bg-emerald-600/20 border border-emerald-500/30 text-gray-100 rounded-br-none'
                        : 'bg-card border border-card-border text-gray-200 rounded-bl-none'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans text-[13px]">
                      {renderMessageContent(msg.content) || (isLoading && idx === messages.length - 1 ? 'Generating response...' : '')}
                    </div>

                    {/* Stats & Actions Footer for Assistant Messages */}
                    {!isUser && msg.content && (
                      <div className="mt-2.5 pt-2 border-t border-card-border/40 flex items-center justify-between text-[10px] font-mono text-gray-400">
                        {/* Metrics Badge */}
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1" title="Generation Length">
                            <Layers className="w-3 h-3 text-gray-500" />
                            <span>{approxTokens} tokens</span>
                            <span className="text-gray-600">({msg.content.length} chars)</span>
                          </span>

                          {msg.latency_ms > 0 && (
                            <span className="flex items-center gap-1 text-emerald-400/80" title="Total Response Latency">
                              <Clock className="w-3 h-3" />
                              <span>{(msg.latency_ms / 1000).toFixed(1)}s</span>
                            </span>
                          )}
                        </div>

                        {/* Action Buttons: TTS Audio Speaker & Copy */}
                        <div className="flex items-center gap-1.5">
                          {/* Voice Read Aloud Button */}
                          <button
                            onClick={() => speakText(msg.content, msg.id || idx)}
                            className={`p-1 rounded transition-colors flex items-center gap-1 ${
                              isSpeakingThis 
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse' 
                                : 'hover:bg-card-border/60 text-gray-400 hover:text-emerald-300'
                            }`}
                            title={isSpeakingThis ? "Stop speaking" : "Read response out loud (TTS)"}
                          >
                            {isSpeakingThis ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                            <span className="text-[10px]">{isSpeakingThis ? 'Stop' : 'Speak'}</span>
                          </button>

                          {/* Copy Button */}
                          <button
                            onClick={() => handleCopy(msg.content, idx)}
                            className="hover:text-gray-200 transition-colors flex items-center gap-1 text-gray-400 px-1.5 py-0.5 rounded hover:bg-card-border/40"
                            title="Copy text"
                          >
                            {copiedIndex === idx ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400 text-[10px]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span className="text-[10px]">Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar Area with Voice Chat & Slash Commands Popup */}
      <div className="p-4 border-t border-card-border bg-[#0b0d13]/80 backdrop-blur-md relative">
        
        {/* Live Speech Recognition / Media Recording Waveform Banner */}
        {(isListening || isMediaRecording) && (
          <div className="max-w-3xl mx-auto mb-2.5 p-2.5 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-between text-xs font-mono text-red-200 animate-in fade-in shadow-lg shadow-red-500/5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="font-bold">
                {isMediaRecording ? `Recording Audio (${recordingSeconds}s)...` : 'Listening to your voice...'}
              </span>
              <span className="text-gray-400 text-[11px] font-sans">Speak clearly into your microphone</span>
            </div>
            <button
              type="button"
              onClick={toggleListening}
              className="px-3 py-1 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-bold shadow transition-colors"
            >
              Done / Finish
            </button>
          </div>
        )}

        {/* Transcribing Audio Indicator */}
        {isTranscribingAudio && (
          <div className="max-w-3xl mx-auto mb-2.5 p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center gap-2 text-xs font-mono text-indigo-300 animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            <span>Transcribing your voice recording into text...</span>
          </div>
        )}

        {/* Slash Command Autocomplete Menu */}
        {showSlashMenu && filteredSlash.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 max-w-3xl mx-auto mb-2 glass-dropdown rounded-xl p-2 z-50 shadow-2xl border border-card-border">
            <div className="px-2 py-1 text-[10px] font-semibold font-mono text-gray-400 uppercase border-b border-card-border mb-1 flex items-center gap-1">
              <Command className="w-3 h-3 text-emerald-400" />
              <span>Slash Commands</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredSlash.map((sc, idx) => (
                <button
                  key={sc.cmd}
                  type="button"
                  onClick={() => handleSelectSlashCommand(sc)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                    idx === selectedSlashIndex
                      ? 'bg-emerald-500/20 text-emerald-200 font-medium'
                      : 'hover:bg-card-border/50 text-gray-300'
                  }`}
                >
                  <div>
                    <span className="font-mono text-emerald-400 font-bold mr-2">{sc.cmd}</span>
                    <span className="text-gray-200">{sc.label}</span>
                    <div className="text-[10px] text-gray-500">{sc.desc}</div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto space-y-2">
          {/* Attached Files & Upload Status */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {selectedDocIds.length > 0 && (
              <span className="text-[11px] text-gray-400 font-mono">Attached Context:</span>
            )}
            
            {selectedDocIds.map(docId => {
              const doc = documents.find(d => d.id === docId);
              return (
                <span key={docId} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono shadow-sm">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[150px] font-medium">{doc?.filename || docId}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDocIds(prev => prev.filter(id => id !== docId))}
                    className="hover:text-red-400 ml-1 p-0.5"
                    title="Remove attached file"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}

            {isUploading && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Uploading & indexing file...</span>
              </span>
            )}
          </div>

          {/* Input Box */}
          <div className={`relative rounded-xl bg-[#151824] border transition-all shadow-inner ${
            (isListening || isMediaRecording)
              ? 'border-red-500/50 ring-2 ring-red-500/20' 
              : 'border-card-border focus-within:border-emerald-500/40 focus-within:ring-1 focus-within:ring-emerald-500/20'
          }`}>
            <textarea
              ref={inputRef}
              autoFocus
              value={inputPrompt}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (showSlashMenu && filteredSlash.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedSlashIndex(prev => (prev + 1) % filteredSlash.length);
                    return;
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedSlashIndex(prev => (prev - 1 + filteredSlash.length) % filteredSlash.length);
                    return;
                  } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSelectSlashCommand(filteredSlash[selectedSlashIndex]);
                    return;
                  } else if (e.key === 'Escape') {
                    setShowSlashMenu(false);
                    return;
                  }
                }

                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={(isListening || isMediaRecording) ? "Listening to your voice..." : `Ask ${activeAgent?.name || 'Pi Agent'} anything... (Type / for commands or click 🎙️)`}
              rows={2}
              className="w-full bg-transparent px-3.5 py-3 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none resize-none font-sans"
            />

            <div className="flex items-center justify-between px-3 pb-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Voice Dictation (Microphone) Button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-1.5 ${
                    (isListening || isMediaRecording)
                      ? 'bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/30 animate-pulse font-bold'
                      : 'border-card-border hover:bg-[#202535] text-gray-300 hover:text-emerald-400'
                  }`}
                  title={(isListening || isMediaRecording) ? "Stop listening" : "Voice Input (Speech-to-Text)"}
                >
                  {(isListening || isMediaRecording) ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                  <span className="text-[10px]">{(isListening || isMediaRecording) ? (isRTL ? 'جاري التسجيل...' : 'Recording...') : (isRTL ? 'إملاء صوتي' : 'Voice')}</span>
                </button>

                {/* Hands-Free Auto-Speak Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    if (autoSpeak) stopAudio();
                    setAutoSpeak(!autoSpeak);
                  }}
                  className={`p-1.5 rounded-lg border text-xs font-mono transition-all flex items-center gap-1 ${
                    autoSpeak
                      ? 'bg-purple-600 text-white border-purple-500 font-bold shadow-md shadow-purple-600/30'
                      : 'border-card-border hover:bg-[#202535] text-gray-400 hover:text-purple-300'
                  }`}
                  title={autoSpeak ? "Auto-Voice Speech ON (Click to mute)" : "Auto-Voice Speech OFF"}
                >
                  {autoSpeak ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{autoSpeak ? (isRTL ? 'صوت تلقائي: مفعّل' : 'Auto-Voice: ON') : (isRTL ? 'صوت تلقائي' : 'Auto-Voice')}</span>
                </button>

                {/* Natural Human Voice Persona Selector */}
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="bg-[#151824] border border-card-border hover:border-indigo-500/40 rounded-lg px-2 py-1 text-[10px] text-gray-300 font-mono focus:outline-none transition-colors"
                  title="Select Natural Human Neural Voice Persona"
                >
                  {isRTL ? (
                    <>
                      <option value="ar-SA-HamedNeural">🇸🇦 حامد (صوت قيادي وقور)</option>
                      <option value="ar-SA-ZariyahNeural">🇸🇦 زارية (صوت طبيعي واثق)</option>
                      <option value="ar-EG-ShakirNeural">🇪🇬 شاكر (صوت تحليلي دقيق)</option>
                      <option value="ar-EG-SalmaNeural">🇪🇬 سلمى (صوت سريع ومقنع)</option>
                      <option value="ar-AE-HamdanNeural">🇦🇪 حمدان (صوت رسمي حاسم)</option>
                      <option value="ar-AE-FatimaNeural">🇦🇪 فاطمة (صوت هادئ ومنطقي)</option>
                    </>
                  ) : (
                    <>
                      <option value="en-US-JennyNeural">👩 Jenny (Natural US)</option>
                      <option value="en-US-GuyNeural">👨 Guy (Confident US)</option>
                      <option value="en-US-AriaNeural">👩 Aria (Expressive US)</option>
                      <option value="en-US-ChristopherNeural">👨 Christopher (Deep US)</option>
                      <option value="en-GB-SoniaNeural">👩 Sonia (British UK)</option>
                      <option value="en-GB-RyanNeural">👨 Ryan (British UK)</option>
                    </>
                  )}
                </select>

                {/* Direct File Attachment Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="p-1.5 rounded-lg border border-card-border hover:bg-[#202535] text-gray-400 hover:text-emerald-300 transition-colors flex items-center gap-1 text-xs"
                  title="Upload & Attach File from Computer"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono">{isRTL ? 'إرفاق' : 'Attach'}</span>
                </button>

                {/* Pick from Library Button */}
                <button
                  type="button"
                  onClick={() => setShowDocPicker(!showDocPicker)}
                  className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
                    showDocPicker
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                      : 'border-card-border hover:bg-[#202535] text-gray-400 hover:text-gray-200'
                  }`}
                  title="Pick from Documents Library"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono">{isRTL ? 'المكتبة' : 'Library'}</span>
                </button>

                {/* Quick Slash Commands Trigger */}
                <button
                  type="button"
                  onClick={() => {
                    setInputPrompt('/');
                    setShowSlashMenu(true);
                    setSlashFilter('');
                    inputRef.current?.focus();
                  }}
                  className="p-1.5 rounded-lg border border-card-border hover:bg-[#202535] text-gray-400 hover:text-emerald-300 transition-colors flex items-center gap-1 text-xs font-mono"
                  title="Slash Commands"
                >
                  <Command className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px]">{isRTL ? 'الأوامر /' : '/cmds'}</span>
                </button>

                {showDocPicker && (
                  <div 
                    ref={docPickerRef}
                    className="absolute bottom-full left-3 mb-2 w-80 glass-dropdown rounded-xl p-2.5 z-50 animate-in fade-in shadow-2xl border border-card-border bg-[#101422]"
                  >
                    <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold font-mono text-gray-300 border-b border-card-border mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <FolderOpen className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Library Attachments</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500">{documents.length} docs</span>
                        <button
                          type="button"
                          onClick={() => setShowDocPicker(false)}
                          className="p-0.5 hover:text-gray-200 text-gray-400"
                          title="Close"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1 my-1.5">
                      {documents.length === 0 ? (
                        <div className="p-3 text-xs text-gray-500 text-center font-mono">No documents uploaded to Library yet.</div>
                      ) : (
                        documents.map(doc => {
                          const isChecked = selectedDocIds.includes(doc.id);
                          return (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => {
                                setSelectedDocIds(prev => 
                                  isChecked ? prev.filter(id => id !== doc.id) : [...prev, doc.id]
                                );
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                isChecked ? 'bg-indigo-500/20 text-indigo-200 font-medium border border-indigo-500/30' : 'hover:bg-[#1a2030] text-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate mr-2 font-mono text-[11px]">
                                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span className="truncate">{doc.filename}</span>
                              </div>
                              {isChecked && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="pt-1.5 border-t border-card-border flex items-center justify-between">
                      <span className="text-[10px] font-mono text-gray-400">
                        {selectedDocIds.length} attached
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDocPicker(false)}
                        className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-mono font-bold transition-all shadow"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={!inputPrompt.trim() || isLoading || isUploading}
                className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-gray-950 transition-all font-semibold shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
