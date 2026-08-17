// Session Stream Manager for Concurrent Background Agent Executions
// Enables multiple agents in different sessions to stream in parallel without interrupting each other.

class SessionStreamManager {
  constructor() {
    this.activeStreams = new Map(); // sessionId -> { messages, isStreaming, accumulatedReply, accumulatedThinking, tempMsgId, agent, model, abortController }
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(sessionId) {
    this.listeners.forEach(fn => fn(sessionId, this.getStreamState(sessionId)));
  }

  getStreamState(sessionId) {
    if (!sessionId) return null;
    return this.activeStreams.get(sessionId) || null;
  }

  isSessionStreaming(sessionId) {
    return !!this.activeStreams.get(sessionId)?.isStreaming;
  }

  getAllActiveStreams() {
    const res = {};
    for (const [id, stream] of this.activeStreams.entries()) {
      if (stream.isStreaming) {
        res[id] = stream;
      }
    }
    return res;
  }

  async startStream({
    sessionId,
    agent,
    model,
    prompt,
    documentIds = [],
    initialMessages = [],
    onSessionCreated,
    onRefreshSessions,
    onSpeak
  }) {
    // If no sessionId yet, create a temporary unique key
    const clientSessionKey = sessionId || `temp-${Date.now()}`;
    const tempAsstMsgId = `asst-stream-${Date.now()}`;

    const userMessage = {
      id: `msg-local-${Date.now()}`,
      role: 'user',
      content: prompt,
      created_at: new Date().toISOString()
    };

    const initialAsstMessage = {
      id: tempAsstMsgId,
      role: 'assistant',
      agent_id: agent?.id,
      agent_name: agent?.name,
      agent_avatar: agent?.avatar,
      model_id: model?.model || agent?.model_id,
      model_provider: model?.provider || agent?.model_provider,
      content: '',
      thinking_content: '',
      created_at: new Date().toISOString()
    };

    const streamState = {
      sessionId: clientSessionKey,
      isStreaming: true,
      messages: [...initialMessages, userMessage, initialAsstMessage],
      accumulatedReply: '',
      accumulatedThinking: '',
      tempMsgId: tempAsstMsgId,
      agent,
      model,
      abortController: new AbortController()
    };

    this.activeStreams.set(clientSessionKey, streamState);
    this.notify(clientSessionKey);

    try {
      const response = await fetch('/api/chat/single/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: streamState.abortController.signal,
        body: JSON.stringify({
          session_id: sessionId || undefined,
          agent_id: agent?.id || 'agent-general',
          model_id: model?.model,
          model_provider: model?.provider,
          message: prompt,
          document_ids: documentIds,
          language: localStorage.getItem('pistation_language') || 'en'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let realSessionId = sessionId;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'init' && event.session_id) {
              realSessionId = event.session_id;
              if (event.agent) {
                streamState.messages = streamState.messages.map(m =>
                  m.id === tempAsstMsgId
                    ? {
                        ...m,
                        agent_name: event.agent.name || m.agent_name,
                        agent_avatar: event.agent.avatar || m.agent_avatar,
                        model_id: event.agent.model || m.model_id
                      }
                    : m
                );
                this.notify(realSessionId || clientSessionKey);
              }
              if (realSessionId !== clientSessionKey) {
                // Re-key the active stream under the confirmed database session ID
                this.activeStreams.delete(clientSessionKey);
                streamState.sessionId = realSessionId;
                this.activeStreams.set(realSessionId, streamState);
                onSessionCreated?.(realSessionId);
                onRefreshSessions?.();
              }
            } else if (event.type === 'thinking') {
              streamState.accumulatedThinking += event.content || '';
              streamState.messages = streamState.messages.map(m =>
                m.id === tempAsstMsgId
                  ? { ...m, thinking_content: streamState.accumulatedThinking }
                  : m
              );
              this.notify(realSessionId || clientSessionKey);
            } else if (event.type === 'token') {
              streamState.accumulatedReply += event.content || '';
              streamState.messages = streamState.messages.map(m =>
                m.id === tempAsstMsgId
                  ? { ...m, content: streamState.accumulatedReply }
                  : m
              );
              this.notify(realSessionId || clientSessionKey);
            } else if (event.type === 'done') {
              streamState.isStreaming = false;
              streamState.messages = streamState.messages.map(m =>
                m.id === tempAsstMsgId
                  ? {
                      ...m,
                      latency_ms: event.latency_ms,
                      model_id: event.model_id || m.model_id,
                      model_provider: event.model_provider || m.model_provider
                    }
                  : m
              );
              this.notify(realSessionId || clientSessionKey);
              onRefreshSessions?.();

              // Real-time instant sync for To-Do list and Station Overview
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('pi:todos_updated'));
              }

              if (streamState.accumulatedReply) {
                onSpeak?.(streamState.accumulatedReply, tempAsstMsgId);
              }
            }
          } catch (e) {
            // Ignore parse errors on malformed chunks
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Session background streaming error:', err);
        streamState.messages = streamState.messages.map(m =>
          m.id === tempAsstMsgId
            ? { ...m, content: `⚠️ Error: ${err.message}` }
            : m
        );
      }
    } finally {
      streamState.isStreaming = false;
      this.notify(streamState.sessionId);
      onRefreshSessions?.();
    }
  }

  stopStream(sessionId) {
    const stream = this.activeStreams.get(sessionId);
    if (stream && stream.isStreaming) {
      stream.abortController.abort();
      stream.isStreaming = false;
      this.notify(sessionId);
    }
  }
}

export const sessionStreamManager = new SessionStreamManager();
