import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { 
  FolderTree, 
  Folder, 
  FolderOpen,
  FolderPlus, 
  FileCode, 
  FilePlus, 
  FileText, 
  Image as ImageIcon,
  Trash2, 
  RefreshCw, 
  Terminal, 
  Play, 
  Save, 
  Sparkles, 
  Plus, 
  ChevronRight, 
  ChevronDown, 
  X, 
  Check, 
  Copy, 
  Code2, 
  Send, 
  Loader2, 
  FolderGit2,
  FileCheck,
  Eye,
  Download,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Target,
  Paperclip,
  BookOpen,
  Upload
} from 'lucide-react';
import DiffViewer from './DiffViewer.jsx';

export default function ProjectStudio({
  agents = [],
  activeModel,
  ...props
}) {
  const { t, isRTL } = useLanguage();
  const [projects, setProjects] = useState([]);
  const [homeDir, setHomeDir] = useState('');
  useEffect(() => {
    fetch('/api/system/info')
      .then((r) => r.json())
      .then((info) => setHomeDir(info.home_dir || ''))
      .catch(() => {});
  }, []);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [projectTree, setProjectTree] = useState([]);
  const [openTabs, setOpenTabs] = useState([]); // [{ path, name, content, originalContent, isModified, is_image, is_binary, raw_url }]
  const [activeTabPath, setActiveTabPath] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [focusedFolder, setFocusedFolder] = useState(''); // e.g. "Desktop" or ""
  const [isLoadingTree, setIsLoadingTree] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  
  // Terminal state
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(260); // px
  const [terminalCommand, setTerminalCommand] = useState('');
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const terminalEndRef = useRef(null);
  const terminalInputRef = useRef(null);

  // Conversational Chat state
  const [chatOpen, setChatOpen] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState('agent-general');
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'init',
      role: 'assistant',
      content: 'Hello! I am your AI assistant in Project Studio. Click any folder or file to focus my awareness, ask questions about your workspace, or tell me to write code!'
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const chatEndRef = useRef(null);

  // Attachments & Library state for Studio Chat
  const [libraryDocs, setLibraryDocs] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const fileInputRef = useRef(null);
  const docPickerRef = useRef(null);

  // Click outside to close Library Document Picker
  useEffect(() => {
    const handleClickOutsideStudioDocPicker = (e) => {
      if (docPickerRef.current && !docPickerRef.current.contains(e.target)) {
        setShowDocPicker(false);
      }
    };
    if (showDocPicker) {
      document.addEventListener('mousedown', handleClickOutsideStudioDocPicker);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideStudioDocPicker);
    };
  }, [showDocPicker]);

  const fetchLibraryDocs = async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      if (Array.isArray(data)) setLibraryDocs(data);
    } catch (e) {
      console.error('Failed to load library docs:', e);
    }
  };

  useEffect(() => {
    fetchLibraryDocs();
  }, []);

  const handleUploadLocalFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    for (const file of files) {
      try {
        const text = await file.text();
        setAttachedFiles(prev => [...prev, {
          name: file.name,
          size: file.size,
          content: text
        }]);
      } catch (err) {
        console.error('Failed to read file text:', err);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Modals
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTemplate, setNewProjectTemplate] = useState('blank');
  const [newProjectCustomPath, setNewProjectCustomPath] = useState('');
  
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileParentDir, setNewFileParentDir] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];
  const activeTab = openTabs.find(t => t.path === activeTabPath);
  const activeAgent = agents.find(a => a.id === selectedAgentId) || agents[0];

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (Array.isArray(data)) {
        setProjects(data);
        if (!activeProjectId && data.length > 0) {
          setActiveProjectId(data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch projects:', e);
    }
  };

  const fetchTree = async (projId) => {
    if (!projId) return;
    setIsLoadingTree(true);
    try {
      const res = await fetch(`/api/projects/${projId}/tree`);
      if (res.ok) {
        const data = await res.json();
        setProjectTree(data.tree || []);
      }
    } catch (e) {
      console.error('Failed to load project tree:', e);
    } finally {
      setIsLoadingTree(false);
    }
  };

  const fetchProjectMessages = async (projId) => {
    if (!projId) return;
    try {
      const res = await fetch(`/api/projects/${projId}/messages`);
      if (res.ok) {
        const msgs = await res.json();
        if (Array.isArray(msgs) && msgs.length > 0) {
          setChatMessages(msgs.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            extracted_code: m.extracted_code,
            suggested_filename: m.suggested_filename,
            auto_created_path: m.auto_created_path
          })));
        } else {
          setChatMessages([
            {
              id: 'init',
              role: 'assistant',
              content: 'Hello! I am your AI assistant in Project Studio. Click any folder or file to focus my awareness, ask questions about your workspace, or tell me to write code!'
            }
          ]);
        }
      }
    } catch (err) {
      console.error('Failed to load project messages:', err);
    }
  };

  const handleClearProjectChat = async () => {
    if (!activeProjectId || !confirm('Clear all chat history for this project workspace?')) return;
    try {
      await fetch(`/api/projects/${activeProjectId}/messages`, { method: 'DELETE' });
      setChatMessages([
        {
          id: 'init',
          role: 'assistant',
          content: 'Chat history cleared. How can I assist you with this workspace?'
        }
      ]);
    } catch (err) {
      console.error('Failed to clear project chat:', err);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (activeProjectId) {
      fetchTree(activeProjectId);
      fetchProjectMessages(activeProjectId);
      setOpenTabs([]);
      setActiveTabPath(null);
      setFocusedFolder('');
    }
  }, [activeProjectId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatStreaming]);

  const toggleFolder = (folderItem) => {
    const itemKey = folderItem.path;
    setExpandedFolders(prev => ({
      ...prev,
      [itemKey]: !prev[itemKey]
    }));
    // Set this as the active focused folder for the agent!
    setFocusedFolder(folderItem.path);
  };

  const handleOpenFile = async (file) => {
    const existingTab = openTabs.find(t => t.path === file.path);
    if (existingTab) {
      setActiveTabPath(file.path);
      return;
    }

    setIsLoadingFile(true);
    try {
      const res = await fetch(`/api/projects/${activeProjectId}/file?path=${encodeURIComponent(file.path)}`);
      if (res.ok) {
        const data = await res.json();
        const newTab = {
          path: file.path,
          name: file.name,
          content: data.content || '',
          originalContent: data.content || '',
          isModified: false,
          is_binary: data.is_binary || false,
          is_image: data.is_image || false,
          raw_url: data.raw_url || null,
          size: data.size || 0
        };
        setOpenTabs(prev => [...prev, newTab]);
        setActiveTabPath(file.path);

        // Also update focused folder to file's parent folder
        const parts = file.path.split('/');
        if (parts.length > 1) {
          setFocusedFolder(parts.slice(0, -1).join('/'));
        }
      }
    } catch (e) {
      console.error('Failed to open file:', e);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleCloseTab = (path, e) => {
    e?.stopPropagation();
    const remaining = openTabs.filter(t => t.path !== path);
    setOpenTabs(remaining);
    if (activeTabPath === path) {
      setActiveTabPath(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
    }
  };

  const handleContentChange = (val) => {
    setOpenTabs(prev => prev.map(tab => {
      if (tab.path === activeTabPath) {
        return {
          ...tab,
          content: val,
          isModified: val !== tab.originalContent
        };
      }
      return tab;
    }));
  };

  const handleSaveCurrentFile = async () => {
    if (!activeTab || !activeProjectId || activeTab.is_binary) return;
    setIsSavingFile(true);
    try {
      const res = await fetch(`/api/projects/${activeProjectId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: activeTab.path,
          content: activeTab.content
        })
      });
      if (res.ok) {
        setOpenTabs(prev => prev.map(t => 
          t.path === activeTab.path ? { ...t, originalContent: t.content, isModified: false } : t
        ));
      }
    } catch (e) {
      console.error('Failed to save file:', e);
    } finally {
      setIsSavingFile(false);
    }
  };

  const handleDeleteFile = async (item, e) => {
    e?.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${item.name}"?`)) return;

    try {
      const res = await fetch(`/api/projects/${activeProjectId}/file?path=${encodeURIComponent(item.path)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        handleCloseTab(item.path);
        fetchTree(activeProjectId);
      }
    } catch (e) {
      console.error('Failed to delete file:', e);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProjectName.trim(),
          template: newProjectTemplate,
          path: newProjectCustomPath.trim() || undefined
        })
      });

      if (res.ok) {
        const created = await res.json();
        await fetchProjects();
        setActiveProjectId(created.id);
        setShowNewProjectModal(false);
        setNewProjectName('');
        setNewProjectCustomPath('');
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    }
  };

  const handleCreateFileOrFolder = async (e) => {
    e.preventDefault();
    if (!newFileName.trim() || !activeProjectId) return;

    const fullRelPath = newFileParentDir 
      ? `${newFileParentDir}/${newFileName.trim()}` 
      : newFileName.trim();

    try {
      const res = await fetch(`/api/projects/${activeProjectId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: fullRelPath,
          content: isCreatingFolder ? '' : '// New File\n'
        })
      });

      if (res.ok) {
        fetchTree(activeProjectId);
        setShowNewFileModal(false);
        setNewFileName('');
        setNewFileParentDir('');
        if (!isCreatingFolder) {
          handleOpenFile({ path: fullRelPath, name: newFileName.trim() });
        }
      }
    } catch (err) {
      console.error('Failed to create file:', err);
    }
  };

  const handleRunTerminalCommand = async (cmdToRun) => {
    const cmd = (cmdToRun !== undefined ? cmdToRun : terminalCommand).trim();
    if (!cmd || !activeProjectId) return;

    if (cmd === 'clear') {
      setTerminalLogs([]);
      setTerminalCommand('');
      setCommandHistory(prev => [cmd, ...prev.filter(c => c !== cmd)]);
      setHistoryIndex(-1);
      return;
    }

    setIsExecutingCommand(true);
    setTerminalCommand('');
    setCommandHistory(prev => [cmd, ...prev.filter(c => c !== cmd)]);
    setHistoryIndex(-1);

    const entryId = Date.now();
    const currentPathDisplay = activeProject ? (activeProject.path.replace(homeDir, '~') + (focusedFolder ? `/${focusedFolder}` : '')) : '~';

    setTerminalLogs(prev => [...prev, {
      id: entryId,
      command: cmd,
      status: 'running',
      pathDisplay: currentPathDisplay,
      output: '',
      timestamp: new Date().toLocaleTimeString()
    }]);

    try {
      const res = await fetch(`/api/projects/${activeProjectId}/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      });

      const data = await res.json();
      setTerminalLogs(prev => prev.map(log => {
        if (log.id === entryId) {
          return {
            ...log,
            status: data.exit_code === 0 ? 'success' : 'error',
            output: data.output || '(No output)',
            exitCode: data.exit_code,
            elapsedMs: data.elapsed_ms
          };
        }
        return log;
      }));

      if (cmd.includes('touch') || cmd.includes('mkdir') || cmd.includes('git') || cmd.includes('npm') || cmd.includes('rm') || cmd.includes('mv')) {
        fetchTree(activeProjectId);
      }
    } catch (err) {
      setTerminalLogs(prev => prev.map(log => {
        if (log.id === entryId) {
          return {
            ...log,
            status: 'error',
            output: `⚠️ Execution failed: ${err.message}`,
            exitCode: 1
          };
        }
        return log;
      }));
    } finally {
      setIsExecutingCommand(false);
      setTimeout(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  };

  const handleTerminalKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length === 0) return;
      const nextIndex = historyIndex + 1 < commandHistory.length ? historyIndex + 1 : historyIndex;
      setHistoryIndex(nextIndex);
      setTerminalCommand(commandHistory[nextIndex] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const prevIndex = historyIndex - 1;
        setHistoryIndex(prevIndex);
        setTerminalCommand(commandHistory[prevIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setTerminalCommand('');
      }
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      setTerminalLogs([]);
    }
  };

  // Conversational Chatbot Handler
  const handleSendChatMessage = async (e) => {
    e?.preventDefault();
    if (!inputPrompt.trim() || isChatStreaming || !activeProjectId) return;

    const userText = inputPrompt.trim();
    setInputPrompt('');

    const userMsg = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: userText
    };

    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setIsChatStreaming(true);

    const tempAsstId = `asst-${Date.now()}`;
    setChatMessages(prev => [...prev, {
      id: tempAsstId,
      role: 'assistant',
      content: '',
      isStreaming: true
    }]);

    try {
      const res = await fetch(`/api/projects/${activeProjectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: selectedAgentId,
          model_id: activeModel?.model,
          model_provider: activeModel?.provider,
          messages: newHistory.map(m => ({ role: m.role, content: m.content })),
          focused_folder: focusedFolder,
          active_file_path: activeTab?.path || undefined,
          active_file_content: activeTab?.content || undefined,
          auto_create_file: true,
          document_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
          attachments: attachedFiles.length > 0 ? attachedFiles : undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => prev.map(m => 
          m.id === tempAsstId ? {
            ...m,
            content: data.reply,
            isStreaming: false,
            extracted_code: data.extracted_code,
            suggested_filename: data.suggested_filename,
            auto_created_path: data.auto_created_path
          } : m
        ));

        // If a file was created, refresh tree and open it
        if (data.auto_created_path) {
          await fetchTree(activeProjectId);
          handleOpenFile({ path: data.auto_created_path, name: data.auto_created_path.split('/').pop() });
        }
      }
    } catch (err) {
      setChatMessages(prev => prev.map(m => 
        m.id === tempAsstId ? {
          ...m,
          content: `⚠️ Error: ${err.message}`,
          isStreaming: false
        } : m
      ));
    } finally {
      setIsChatStreaming(false);
    }
  };

  const handleApplyCodeToEditor = (code) => {
    if (!code || !activeTab) return;
    handleContentChange(code);
  };

  const handleSaveAsNewFile = async (filename, content) => {
    if (!filename || !content || !activeProjectId) return;
    try {
      const res = await fetch(`/api/projects/${activeProjectId}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: filename,
          content: content
        })
      });
      if (res.ok) {
        await fetchTree(activeProjectId);
        handleOpenFile({ path: filename, name: filename.split('/').pop() });
      }
    } catch (e) {
      console.error('Failed to save file:', e);
    }
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) return <Code2 className="w-3.5 h-3.5 text-yellow-400 shrink-0" />;
    if (['py'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    if (['json'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return <ImageIcon className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
    if (['css', 'scss', 'html'].includes(ext)) return <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    if (['md'].includes(ext)) return <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
    return <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />;
  };

  const renderTreeNodes = (nodes, parentPath = '') => {
    return (
      <div className="space-y-0.5">
        {nodes.map(item => {
          const itemKey = item.path;
          if (item.is_dir) {
            const isExpanded = expandedFolders[itemKey];
            const isFocused = focusedFolder === item.path;
            return (
              <div key={itemKey}>
                <div 
                  onClick={() => toggleFolder(item)}
                  className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs transition-colors ${
                    isFocused 
                      ? 'bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30' 
                      : 'text-gray-300 hover:bg-card-border/50'
                  }`}
                  title={`Click to focus agent on ${item.name}`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                    {isExpanded ? <FolderOpen className="w-3.5 h-3.5 text-amber-400" /> : <Folder className="w-3.5 h-3.5 text-indigo-400" />}
                    <span className="truncate font-medium">{item.name}</span>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewFileParentDir(item.path);
                        setIsCreatingFolder(false);
                        setShowNewFileModal(true);
                      }}
                      className="p-0.5 hover:text-emerald-400 text-gray-500"
                      title="New File in this folder"
                    >
                      <FilePlus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteFile(item, e)}
                      className="p-0.5 hover:text-red-400 text-gray-500"
                      title="Delete folder"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="pl-3 border-l border-card-border/60 ml-2">
                    {item.children && item.children.length > 0 ? (
                      renderTreeNodes(item.children, itemKey)
                    ) : (
                      <div className="py-1 px-2 text-[10px] text-gray-500 font-mono italic">
                        (empty folder)
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          }

          const isSelected = activeTabPath === item.path;
          return (
            <div
              key={item.path}
              onClick={() => handleOpenFile(item)}
              className={`group flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs transition-colors ${
                isSelected 
                  ? 'bg-emerald-500/15 text-emerald-300 font-medium' 
                  : 'text-gray-400 hover:text-gray-200 hover:bg-card-border/40'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                {getFileIcon(item.name)}
                <span className="truncate">{item.name}</span>
              </div>
              <button
                onClick={(e) => handleDeleteFile(item, e)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 text-gray-500 transition-opacity"
                title="Delete file"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0d13] overflow-hidden">
      {/* Top Studio Action Bar */}
      <div className="h-11 border-b border-card-border bg-[#0e111a] px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-bold text-gray-200">{t('projects.workspace_label', 'WORKSPACE:')}</span>
          </div>

          {/* Project Selector */}
          <select
            value={activeProjectId || ''}
            onChange={(e) => setActiveProjectId(e.target.value)}
            className="bg-[#151824] border border-card-border rounded-lg px-2.5 py-1 text-xs text-emerald-300 font-mono focus:outline-none max-w-xs truncate"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>📁 {p.name} ({p.path})</option>
            ))}
          </select>

          <button
            onClick={() => setShowNewProjectModal(true)}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono flex items-center gap-1 transition-all"
          >
            <Plus className="w-3 h-3" />
            <span>New Project</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Focused Scope Badge */}
          {focusedFolder && (
            <div className="px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[11px] font-mono text-indigo-300 flex items-center gap-1.5">
              <Target className="w-3 h-3 text-indigo-400" />
              <span>Scope: /{focusedFolder}</span>
              <button onClick={() => setFocusedFolder('')} className="hover:text-red-400 ml-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Terminal & Chat Toggles */}
          <button
            onClick={() => setTerminalOpen(!terminalOpen)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-colors ${
              terminalOpen 
                ? 'bg-[#1a2030] text-emerald-300 border-emerald-500/40' 
                : 'border-card-border text-gray-400 hover:text-gray-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('projects.terminal_tab', 'Terminal')}</span>
          </button>

          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-colors ${
              chatOpen 
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' 
                : 'border-card-border text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t('projects.chat_tab', 'Chat')}</span>
          </button>
        </div>
      </div>

      {/* Main IDE Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Pane: File Tree Explorer */}
        <div className="w-64 border-r border-card-border bg-[#0d0f17] flex flex-col shrink-0 select-none overflow-hidden">
          <div className="p-2.5 border-b border-card-border flex items-center justify-between text-xs text-gray-400">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray-400">Files</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setNewFileParentDir(focusedFolder || '');
                  setIsCreatingFolder(false);
                  setShowNewFileModal(true);
                }}
                className="p-1 hover:text-emerald-400 text-gray-400 transition-colors"
                title="New File"
              >
                <FilePlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setNewFileParentDir(focusedFolder || '');
                  setIsCreatingFolder(true);
                  setShowNewFileModal(true);
                }}
                className="p-1 hover:text-indigo-400 text-gray-400 transition-colors"
                title="New Folder"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => fetchTree(activeProjectId)}
                className="p-1 hover:text-gray-200 text-gray-400 transition-colors"
                title="Refresh File Tree"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTree ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isLoadingTree ? (
              <div className="flex items-center justify-center h-32 text-gray-500 text-xs gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Scanning files...</span>
              </div>
            ) : projectTree.length === 0 ? (
              <div className="text-center py-8 px-4 text-xs text-gray-500">
                <p>No files found.</p>
              </div>
            ) : (
              renderTreeNodes(projectTree)
            )}
          </div>

          {/* Project Path Footer */}
          <div className="p-2 border-t border-card-border bg-[#090b10] text-[10px] font-mono text-gray-500 truncate" title={activeProject?.path}>
            {activeProject?.path || 'No directory selected'}
          </div>
        </div>

        {/* Center Pane: Editor / File Viewer & Terminal */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#111420]">
          
          {/* File Tabs Bar */}
          <div className="h-9 border-b border-card-border bg-[#0e111a] flex items-center justify-between px-2 overflow-x-auto shrink-0 select-none">
            <div className="flex items-center gap-1 overflow-x-auto">
              {openTabs.map(tab => {
                const isActive = tab.path === activeTabPath;
                return (
                  <div
                    key={tab.path}
                    onClick={() => setActiveTabPath(tab.path)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-t-md text-xs cursor-pointer border-t-2 transition-all ${
                      isActive 
                        ? 'bg-[#151928] border-emerald-400 text-gray-100 font-medium' 
                        : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#151824]'
                    }`}
                  >
                    {getFileIcon(tab.name)}
                    <span className="truncate max-w-[120px] font-mono">{tab.name}</span>
                    {tab.isModified && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Unsaved changes" />}
                    <button
                      onClick={(e) => handleCloseTab(tab.path, e)}
                      className="hover:text-red-400 ml-1 p-0.5 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {activeTab && !activeTab.is_binary && (
              <div className="flex items-center gap-2 shrink-0 pl-2">
                <button
                  onClick={handleSaveCurrentFile}
                  disabled={isSavingFile}
                  className={`px-2.5 py-0.5 rounded text-xs font-mono flex items-center gap-1 transition-all ${
                    activeTab.isModified
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white font-bold shadow'
                      : 'bg-card-border/60 hover:bg-card-border text-gray-300'
                  }`}
                  title="Save File (Ctrl + S)"
                >
                  {isSavingFile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  <span>{activeTab.isModified ? 'Save Changes' : 'Saved'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Editor / File Viewer Body */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {activeTab ? (
              activeTab.is_image ? (
                /* Rich Image Viewer */
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#0a0c12] overflow-auto">
                  <div className="p-4 rounded-xl border border-card-border bg-[#141824] shadow-2xl flex flex-col items-center max-w-2xl space-y-3">
                    <img
                      src={activeTab.raw_url}
                      alt={activeTab.name}
                      className="max-h-[500px] max-w-full object-contain rounded-lg shadow"
                    />
                    <div className="text-xs font-mono text-gray-400 flex items-center gap-4">
                      <span>File: {activeTab.name}</span>
                      <span>Size: {Math.round(activeTab.size / 1024)} KB</span>
                      <a
                        href={activeTab.raw_url}
                        download={activeTab.name}
                        className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 flex items-center gap-1 hover:bg-emerald-500/30"
                      >
                        <Download className="w-3 h-3" /> Download
                      </a>
                    </div>
                  </div>
                </div>
              ) : activeTab.is_binary ? (
                /* Binary File Card */
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-400 space-y-3">
                  <FileText className="w-16 h-16 text-indigo-400" />
                  <h4 className="text-sm font-semibold text-gray-200">{activeTab.name}</h4>
                  <p className="text-xs text-gray-500">Binary file format ({Math.round(activeTab.size / 1024)} KB)</p>
                  <a
                    href={activeTab.raw_url}
                    download={activeTab.name}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Binary File</span>
                  </a>
                </div>
              ) : (
                /* Code / Text Editor */
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <textarea
                    value={activeTab.content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                        e.preventDefault();
                        handleSaveCurrentFile();
                      }
                    }}
                    spellCheck={false}
                    className="flex-1 w-full bg-[#0d101a] p-4 text-xs font-mono text-gray-200 focus:outline-none resize-none leading-relaxed selection:bg-emerald-500/30 overflow-y-auto"
                  />
                  
                  {/* Editor Status Bar */}
                  <div className="h-6 border-t border-card-border bg-[#0a0c12] px-3 flex items-center justify-between text-[11px] font-mono text-gray-500 select-none">
                    <span>Path: {activeTab.path}</span>
                    <div className="flex items-center gap-4">
                      <span>{activeTab.content.split('\n').length} Lines</span>
                      <span>{activeTab.content.length} Characters</span>
                      <span className="text-emerald-400">UTF-8</span>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500 space-y-3 select-none">
                <FileCode className="w-12 h-12 text-gray-600" />
                <h4 className="text-sm font-semibold text-gray-300">{t('projects.no_file_open', 'No file open')}</h4>
                <p className="text-xs max-w-sm">{t('projects.no_file_sub', 'Select any file from the explorer on the left to view or edit, or click a folder to focus Copilot')}.</p>
              </div>
            )}
          </div>

          {/* Bottom Pane: Authentic Linux Terminal Window */}
          {terminalOpen && (
            <div 
              style={{ height: `${terminalHeight}px` }}
              className="border-t border-card-border bg-[#06070a] flex flex-col shrink-0 font-mono text-xs transition-all duration-150 relative shadow-2xl"
              onClick={() => terminalInputRef.current?.focus()}
            >
              {/* Terminal Window Header */}
              <div className="px-3 py-1.5 border-b border-[#1c2233] bg-[#0c0e16] flex items-center justify-between select-none">
                <div className="flex items-center gap-2">
                  {/* macOS / Linux window buttons */}
                  <div className="flex items-center gap-1.5 pr-2 border-r border-[#1c2233]">
                    <button onClick={(e) => { e.stopPropagation(); setTerminalOpen(false); }} className="w-2.5 h-2.5 rounded-full bg-red-500/80 hover:bg-red-400" title="Close Terminal" />
                    <button onClick={(e) => { e.stopPropagation(); setTerminalHeight(terminalHeight === 160 ? 280 : 160); }} className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 hover:bg-yellow-400" title="Minimize/Compact" />
                    <button onClick={(e) => { e.stopPropagation(); setTerminalHeight(terminalHeight >= 420 ? 260 : 450); }} className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 hover:bg-emerald-400" title="Maximize Height" />
                  </div>

                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] font-bold text-gray-300">
                    bash — {activeProject ? (activeProject.path.replace(homeDir, '~') + (focusedFolder ? `/${focusedFolder}` : '')) : '~'}
                  </span>
                </div>
              </div>

              {/* Terminal Viewport / Scroll Area */}
              <div 
                className="flex-1 overflow-y-auto p-3 space-y-2 select-text font-mono text-[11px] leading-relaxed cursor-text"
                onClick={() => terminalInputRef.current?.focus()}
              >
                {terminalLogs.length === 0 && (
                  <div className="text-gray-600 text-[11px]">
                    Linux 6.6.0-pi-agent #1 PREEMPT SMP Debian (x86_64/arm64)<br />
                    Type any bash command (e.g. <span className="text-gray-400">ls -la</span>, <span className="text-gray-400">python</span>, <span className="text-gray-400">git</span>, <span className="text-gray-400">npm</span>, <span className="text-gray-400">clear</span>)...
                  </div>
                )}

                {terminalLogs.map(log => (
                  <div key={log.id} className="space-y-1">
                    {/* Shell Prompt Header */}
                    <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                      <span className="text-emerald-400 font-bold">user@pi-agent</span>
                      <span className="text-gray-400">:</span>
                      <span className="text-blue-400 font-bold">{log.pathDisplay || '~'}</span>
                      <span className="text-emerald-400 font-bold">$</span>
                      <span className="text-gray-100 font-medium">{log.command}</span>
                      {log.elapsedMs && (
                        <span className="text-gray-600 text-[10px]">({log.elapsedMs}ms)</span>
                      )}
                      {log.exitCode !== undefined && (
                        <span className={`px-1 rounded text-[9px] font-bold ${
                          log.exitCode === 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        }`}>
                          {log.exitCode === 0 ? '✓ 0' : `exit ${log.exitCode}`}
                        </span>
                      )}
                    </div>

                    {/* Output */}
                    {log.status === 'running' ? (
                      <div className="flex items-center gap-2 text-indigo-400 py-0.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Running command...</span>
                      </div>
                    ) : (
                      log.output && (
                        <pre className={`text-[11px] font-mono whitespace-pre-wrap pl-2 ${
                          log.exitCode === 0 ? 'text-gray-300' : 'text-rose-300'
                        }`}>
                          {log.output}
                        </pre>
                      )
                    )}
                  </div>
                ))}

                {/* Inline Active Bash Prompt Input Line */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRunTerminalCommand();
                  }}
                  className="flex items-center gap-1.5 pt-1 text-[11px]"
                >
                  <span className="text-emerald-400 font-bold shrink-0">user@pi-agent</span>
                  <span className="text-gray-400 shrink-0">:</span>
                  <span className="text-blue-400 font-bold shrink-0">
                    {activeProject ? (activeProject.path.replace(homeDir, '~') + (focusedFolder ? `/${focusedFolder}` : '')) : '~'}
                  </span>
                  <span className="text-emerald-400 font-bold shrink-0">$</span>
                  
                  <input
                    ref={terminalInputRef}
                    type="text"
                    value={terminalCommand}
                    onChange={(e) => setTerminalCommand(e.target.value)}
                    onKeyDown={handleTerminalKeyDown}
                    autoFocus
                    placeholder=""
                    className="flex-1 bg-transparent text-gray-100 placeholder:text-gray-600 focus:outline-none font-mono text-[11px] caret-emerald-400"
                  />
                  {isExecutingCommand && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400 shrink-0" />}
                </form>

                <div ref={terminalEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: Natural Conversational Chatbox */}
        {chatOpen && (
          <div className="w-96 border-l border-card-border bg-[#0d0f17] flex flex-col shrink-0 overflow-hidden">
            {/* Chat Header */}
            <div className="p-3 border-b border-card-border flex items-center justify-between bg-[#0e111a]">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-gray-200">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>CHAT</span>
              </div>
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="bg-[#151824] border border-card-border rounded px-2 py-0.5 text-[10px] text-gray-300 font-mono focus:outline-none max-w-[130px] truncate"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.avatar} {a.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleClearProjectChat}
                  className="p-1 rounded hover:bg-[#1f2436] text-gray-500 hover:text-red-400 transition-colors"
                  title="Clear Chat History for this Project"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Focused Folder Awareness Strip */}
            <div className="px-3 py-1.5 border-b border-card-border bg-[#101422] flex items-center justify-between text-[11px] font-mono">
              <div className="flex items-center gap-1 text-indigo-300 truncate">
                <Target className="w-3 h-3 text-indigo-400 shrink-0" />
                <span className="truncate">Focus: {focusedFolder ? `/${focusedFolder}` : 'Project Root (~)'}</span>
              </div>
              {activeTab && (
                <span className="text-[10px] text-emerald-400 truncate max-w-[100px]" title={activeTab.name}>
                  📄 {activeTab.name}
                </span>
              )}
            </div>

            {/* Chat Messages Stream Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 select-text">
              {chatMessages.map(msg => (
                <div 
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[10px] font-mono text-gray-500">
                      {msg.role === 'user' ? 'You' : `${activeAgent?.avatar || '🤖'} ${activeAgent?.name || 'Agent'}`}
                    </span>
                  </div>

                  <div className={`rounded-2xl p-3 text-xs leading-relaxed max-w-[90%] shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-none'
                      : 'bg-[#151824] border border-card-border text-gray-200 rounded-tl-none space-y-2'
                  }`}>
                    <div className="whitespace-pre-wrap font-sans">
                      {msg.content || (msg.isStreaming ? (
                        <span className="inline-flex items-center gap-1.5 text-indigo-300 font-mono">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking & analyzing files...
                        </span>
                      ) : '')}
                    </div>

                    {/* Action buttons if code was produced */}
                    {msg.role === 'assistant' && msg.extracted_code && (
                      <div className="pt-2 border-t border-card-border/60 flex items-center gap-1.5 flex-wrap">
                        {activeTab && (
                          <button
                            onClick={() => handleApplyCodeToEditor(msg.extracted_code)}
                            className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1"
                          >
                            <FileCheck className="w-3 h-3" />
                            <span>Apply to Open Tab</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleSaveAsNewFile(msg.suggested_filename || 'new_file.txt', msg.extracted_code)}
                          className="px-2 py-1 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-[10px] font-mono font-bold flex items-center gap-1"
                        >
                          <Save className="w-3 h-3" />
                          <span>Save as {msg.suggested_filename || 'File'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Attached Files & Library Docs Pills */}
            {(selectedDocIds.length > 0 || attachedFiles.length > 0) && (
              <div className="px-3 py-1.5 border-t border-card-border bg-[#0a0d14] flex items-center gap-1.5 flex-wrap">
                {selectedDocIds.map(docId => {
                  const doc = libraryDocs.find(d => d.id === docId);
                  return (
                    <div key={docId} className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono flex items-center gap-1 max-w-[160px] truncate">
                      <BookOpen className="w-3 h-3 shrink-0 text-indigo-400" />
                      <span className="truncate">{doc?.filename || 'Document'}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedDocIds(prev => prev.filter(id => id !== docId))}
                        className="hover:text-red-400 ml-0.5"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  );
                })}

                {attachedFiles.map((file, idx) => (
                  <div key={idx} className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono flex items-center gap-1 max-w-[160px] truncate">
                    <Paperclip className="w-3 h-3 shrink-0 text-emerald-400" />
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                      className="hover:text-red-400 ml-0.5"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Interactive Chat Input & Attachment Toolbar */}
            <form onSubmit={handleSendChatMessage} className="p-3 border-t border-card-border bg-[#0b0e16] space-y-2 relative">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUploadLocalFile}
                multiple
                className="hidden"
              />

              <div className="flex items-center gap-2">
                <textarea
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendChatMessage();
                    }
                  }}
                  placeholder={focusedFolder ? `Ask about /${focusedFolder} or tell me to write code...` : "Ask about files or tell me to write code..."}
                  rows={2}
                  className="flex-1 bg-[#151928] border border-card-border rounded-xl px-3 py-2 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 resize-none font-sans"
                />
                <button
                  type="submit"
                  disabled={isChatStreaming || !inputPrompt.trim()}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors shadow-lg shadow-indigo-600/20 shrink-0"
                  title="Send Message (Enter)"
                >
                  {isChatStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>

              {/* Bottom Action Bar: Attach & Library Buttons */}
              <div className="flex items-center justify-between text-[11px] font-mono">
                <div className="flex items-center gap-1.5 relative">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2 py-1 rounded-lg border border-card-border hover:bg-[#181c2b] text-gray-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                    title="Attach file from computer"
                  >
                    <Paperclip className="w-3 h-3" />
                    <span>Attach</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDocPicker(!showDocPicker)}
                    className={`px-2 py-1 rounded-lg border transition-colors flex items-center gap-1 ${
                      showDocPicker
                        ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                        : 'border-card-border hover:bg-[#181c2b] text-gray-400 hover:text-indigo-300'
                    }`}
                    title="Attach document from Library"
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>Library</span>
                  </button>

                  {/* Library Document Picker Pop-Up */}
                  {showDocPicker && (
                    <div
                      ref={docPickerRef}
                      className="absolute bottom-full left-0 mb-2 w-72 glass-dropdown rounded-xl p-2.5 z-50 animate-in fade-in shadow-2xl border border-card-border bg-[#101422]"
                    >
                      <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold font-mono text-gray-300 border-b border-card-border mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Attach from Library</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowDocPicker(false)}
                          className="p-0.5 hover:text-gray-200 text-gray-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1 my-1.5">
                        {libraryDocs.length === 0 ? (
                          <div className="p-3 text-xs text-gray-500 text-center font-mono">No documents in Library yet.</div>
                        ) : (
                          libraryDocs.map(doc => {
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
                                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors ${
                                  isChecked ? 'bg-indigo-500/20 text-indigo-200 font-medium border border-indigo-500/30' : 'hover:bg-[#1a2030] text-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate mr-2 font-mono text-[11px]">
                                  <FileText className="w-3 h-3 text-indigo-400 shrink-0" />
                                  <span className="truncate">{doc.filename}</span>
                                </div>
                                {isChecked && <Check className="w-3 h-3 text-indigo-400 shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>

                      <div className="pt-1.5 border-t border-card-border flex items-center justify-between">
                        <span className="text-[10px] font-mono text-gray-400">
                          {selectedDocIds.length} selected
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowDocPicker(false)}
                          className="px-3 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-mono font-bold transition-all shadow"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-gray-500">
                  {focusedFolder ? `🎯 /${focusedFolder}` : 'Root ( ~ )'}
                </span>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111420] border border-card-border rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-card-border pb-3">
              <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-emerald-400" />
                <span>Create New Project Workspace</span>
              </h3>
              <button onClick={() => setShowNewProjectModal(false)} className="text-gray-400 hover:text-gray-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-gray-400">Project Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Fastapi App"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full mt-1 bg-[#181c2b] border border-card-border rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-gray-400">Scaffold Template:</label>
                <select
                  value={newProjectTemplate}
                  onChange={(e) => setNewProjectTemplate(e.target.value)}
                  className="w-full mt-1 bg-[#181c2b] border border-card-border rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-emerald-500"
                >
                  <option value="blank">📄 Blank Project</option>
                  <option value="python">🐍 Python (FastAPI / Pytest)</option>
                  <option value="react">⚛️ React + Vite Web App</option>
                  <option value="node">📦 Node.js CLI Tool</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-mono text-gray-400">Custom Path (Optional):</label>
                <input
                  type="text"
                  placeholder={`${homeDir}/projects/my-app`}
                  value={newProjectCustomPath}
                  onChange={(e) => setNewProjectCustomPath(e.target.value)}
                  className="w-full mt-1 bg-[#181c2b] border border-card-border rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewProjectModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-card-border text-xs text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold shadow"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New File / Folder Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111420] border border-card-border rounded-2xl max-w-sm w-full p-4 space-y-3 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-card-border pb-2">
              <h3 className="text-xs font-bold text-gray-100">
                {isCreatingFolder ? '📁 Create New Folder' : '📄 Create New File'}
              </h3>
              <button onClick={() => setShowNewFileModal(false)} className="text-gray-400 hover:text-gray-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateFileOrFolder} className="space-y-3">
              <div>
                <label className="text-[10px] font-mono text-gray-400">
                  {isCreatingFolder ? 'Folder Name:' : 'File Name (with extension):'}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={isCreatingFolder ? "e.g. services" : "e.g. app.py, index.jsx, image.png"}
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  className="w-full mt-1 bg-[#181c2b] border border-card-border rounded-lg px-3 py-2 text-xs text-gray-100 focus:outline-none focus:border-emerald-500 font-mono"
                />
                {newFileParentDir && (
                  <div className="text-[10px] text-gray-500 mt-1">Inside: {newFileParentDir}/</div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewFileModal(false)}
                  className="px-3 py-1 rounded-lg border border-card-border text-xs text-gray-400 hover:text-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
