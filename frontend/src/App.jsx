import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import Overview from './components/Overview.jsx';
import ChatWorkspace from './components/ChatWorkspace.jsx';
import AgentStudio from './components/AgentStudio.jsx';
import DocumentInventory from './components/DocumentInventory.jsx';
import AgentDebate from './components/AgentDebate.jsx';
import MemoryControl from './components/MemoryControl.jsx';
import ProjectStudio from './components/ProjectStudio.jsx';
import SkillsControl from './components/SkillsControl.jsx';
import ResourceMonitor from './components/ResourceMonitor.jsx';
import FineTuningStudio from './components/FineTuningStudio.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'chat', 'projects', 'finetuning', 'studio', 'debate', 'skills', 'docs', 'memory', 'resources'
  const [agents, setAgents] = useState([]);
  const [activeAgentId, setActiveAgentId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [models, setModels] = useState({ ollama_models: [], custom_models: [] });
  const [activeModel, setActiveModel] = useState({ model: 'qwen3.8:27b', provider: 'ollama' });
  const [telemetry, setTelemetry] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [queuedPrompt, setQueuedPrompt] = useState(null);

  const handleDispatchQuickPrompt = (prompt, targetAgentId) => {
    if (targetAgentId) {
      handleSelectAgentForChat(targetAgentId);
    } else {
      setActiveSessionId(null);
    }
    setQueuedPrompt(prompt);
    setActiveTab('chat');
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      const data = await res.json();
      setAgents(data);
      if (!activeAgentId && data.length > 0) {
        setActiveAgentId(data[0].id);
      }
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      setDocuments(data);
    } catch (e) {
      console.error('Failed to fetch documents:', e);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/chat/sessions');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSessions(data);
      }
    } catch (e) {
      console.error('Failed to fetch sessions:', e);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/models');
      const data = await res.json();
      setModels(data);
      if (data.active) {
        setActiveModel({
          model: data.active.model || 'qwen3.8:27b',
          provider: data.active.provider || 'ollama'
        });
      }
    } catch (e) {
      console.error('Failed to fetch models:', e);
    }
  };

  const fetchTelemetry = async () => {
    try {
      const res = await fetch('/api/telemetry/status');
      const data = await res.json();
      setTelemetry(data);
    } catch (e) {
      // Ignore
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchDocuments();
    fetchSessions();
    fetchModels();
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleNewSession = () => {
    setActiveSessionId(null);
    if (activeTab !== 'chat') {
      setActiveTab('chat');
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      await fetch(`/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }
      fetchSessions();
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  };

  const handleSelectAgentForChat = (agentId) => {
    setActiveAgentId(agentId);
    const targetAgent = agents.find(a => a.id === agentId);
    if (targetAgent && targetAgent.model_id) {
      setActiveModel({
        model: targetAgent.model_id,
        provider: targetAgent.model_provider || 'ollama'
      });
      fetch('/api/models/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: targetAgent.model_provider || 'ollama',
          model_id: targetAgent.model_id
        })
      }).catch(() => {});
    }

    // Open or switch to a dedicated chat session for this agent without interrupting other running agents
    const agentSession = sessions.find(s => s.agent_id === agentId);
    if (agentSession) {
      setActiveSessionId(agentSession.id);
    } else {
      setActiveSessionId(null);
    }

    setActiveTab('chat');
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-background overflow-hidden font-sans">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNewSession={handleNewSession}
        models={models}
        activeModel={activeModel}
        setActiveModel={setActiveModel}
        agents={agents}
        activeAgentId={activeAgentId}
        onSelectAgent={handleSelectAgentForChat}
        telemetry={telemetry}
      />

      {/* Main Body Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          agents={agents}
          activeAgentId={activeAgentId}
          setActiveAgentId={handleSelectAgentForChat}
          onSelectAgent={handleSelectAgentForChat}
          activeModel={activeModel}
          documentCount={documents.length}
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={(id) => {
            setActiveSessionId(id);
            if (activeTab !== 'chat') setActiveTab('chat');
          }}
          onDeleteSession={handleDeleteSession}
          onNewSession={handleNewSession}
        />

        {/* Dynamic Content Views with Background Persistence */}
        <main className="flex-1 flex overflow-hidden relative">
          <div className={activeTab === 'overview' ? 'flex-1 flex flex-col h-full overflow-hidden' : 'hidden'}>
            <Overview
              setActiveTab={setActiveTab}
              agents={agents}
              activeAgentId={activeAgentId}
              onSelectAgent={handleSelectAgentForChat}
              documents={documents}
              sessions={sessions}
              models={models}
              activeModel={activeModel}
              telemetry={telemetry}
              onNewSession={handleNewSession}
              onDispatchPrompt={handleDispatchQuickPrompt}
            />
          </div>

          <div className={activeTab === 'chat' ? 'flex-1 flex flex-col h-full overflow-hidden' : 'hidden'}>
            <ChatWorkspace
              agents={agents}
              activeAgentId={activeAgentId}
              activeModel={activeModel}
              documents={documents}
              activeSessionId={activeSessionId}
              setActiveSessionId={setActiveSessionId}
              onRefreshSessions={fetchSessions}
              onRefreshDocuments={fetchDocuments}
              queuedPrompt={queuedPrompt}
              onClearQueuedPrompt={() => setQueuedPrompt(null)}
            />
          </div>

          <div className={activeTab === 'projects' ? 'flex-1 flex flex-col h-full overflow-hidden' : 'hidden'}>
            <ProjectStudio
              agents={agents}
              activeModel={activeModel}
            />
          </div>

          <div className={activeTab === 'studio' ? 'flex-1 flex flex-col h-full overflow-hidden' : 'hidden'}>
            <AgentStudio
              agents={agents}
              models={models}
              onRefreshAgents={fetchAgents}
              onSelectAgentForChat={handleSelectAgentForChat}
            />
          </div>

          <div className={activeTab === 'finetuning' ? 'flex-1 flex flex-col h-full overflow-hidden' : 'hidden'}>
            <FineTuningStudio
              models={models}
              agents={agents}
              activeModel={activeModel}
            />
          </div>

          <div className={activeTab === 'skills' ? 'flex-1 flex flex-col h-full overflow-hidden' : 'hidden'}>
            <SkillsControl />
          </div>

          <div className={activeTab === 'docs' ? 'flex-1 flex flex-col h-full overflow-hidden' : 'hidden'}>
            <DocumentInventory
              documents={documents}
              onRefreshDocs={fetchDocuments}
            />
          </div>

          <div className={activeTab === 'debate' ? 'flex-1 flex flex-col h-full overflow-hidden' : 'hidden'}>
            <AgentDebate
              documents={documents}
              agents={agents}
            />
          </div>

          <div className={activeTab === 'memory' ? 'flex-1 flex flex-col h-full overflow-hidden' : 'hidden'}>
            <MemoryControl />
          </div>

          <div className={activeTab === 'resources' ? 'flex-1 flex flex-col h-full overflow-hidden' : 'hidden'}>
            <ResourceMonitor
              agents={agents}
              activeModel={activeModel}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
