import React, { useState, useEffect } from 'react';
import {
  Folder, File, HardDrive, ArrowLeft, RefreshCw, X, ChevronRight,
  Search, CornerDownRight, Copy, Check, ExternalLink, Terminal,
  FileCode, FileText, Image, Video, Music, Database, Lock
} from 'lucide-react';

export default function DriveExplorerModal({ drive, onClose, onOpenInTerminal }) {
  const [homeDir, setHomeDir] = useState('/home');

  useEffect(() => {
    fetch('/api/system/info')
      .then((r) => r.json())
      .then((info) => info.home_dir && setHomeDir(info.home_dir))
      .catch(() => {});
  }, []);

  const initialPath = drive?.mount && drive.mount.startsWith('/') && drive.mount !== 'Unmounted / Ready'
    ? drive.mount
    : (drive?.device ? `/run/media/${homeDir.split('/').pop()}` : homeDir);

  const [currentPath, setCurrentPath] = useState(initialPath);
  const [parentPath, setParentPath] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [diskInfo, setDiskInfo] = useState(null);
  const [copiedPath, setCopiedPath] = useState(false);

  const fetchDirectory = async (path) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/storage/explore?path=${encodeURIComponent(path)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || `Failed to read directory (${res.status})`);
      }
      const data = await res.json();
      setCurrentPath(data.current_path);
      setParentPath(data.parent_path);
      setEntries(data.entries || []);
      setDiskInfo(data.disk_info);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory(initialPath);
  }, [drive, homeDir]);

  const handleNavigate = (path) => {
    fetchDirectory(path);
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(currentPath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const filteredEntries = entries.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getFileIcon = (ext, isDir) => {
    if (isDir) return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />;
    const audioExts = ['.mp3', '.wav', '.flac', '.ogg'];
    const videoExts = ['.mp4', '.mkv', '.mov', '.avi'];
    const imageExts = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];
    const codeExts = ['.js', '.jsx', '.ts', '.tsx', '.py', '.json', '.html', '.css', '.sh', '.rs', '.go', '.cpp'];
    const modelExts = ['.bin', '.gguf', '.safetensors', '.pt', '.onnx', '.ckpt'];

    if (modelExts.includes(ext)) return <Database className="w-4 h-4 text-purple-400 shrink-0" />;
    if (codeExts.includes(ext)) return <FileCode className="w-4 h-4 text-cyan-400 shrink-0" />;
    if (imageExts.includes(ext)) return <Image className="w-4 h-4 text-emerald-400 shrink-0" />;
    if (videoExts.includes(ext)) return <Video className="w-4 h-4 text-pink-400 shrink-0" />;
    if (audioExts.includes(ext)) return <Music className="w-4 h-4 text-yellow-400 shrink-0" />;
    return <FileText className="w-4 h-4 text-gray-400 shrink-0" />;
  };

  // Breadcrumbs calculation
  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#0c0f1d] border border-cyan-500/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-gray-100 font-sans">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-card-border/60 bg-[#121626] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Drive Explorer: {drive?.name || 'Local Drive'}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {drive?.device || 'Host'}
                </span>
                {drive?.is_usb && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    ⚡ USB Storage
                  </span>
                )}
              </div>
              <div className="text-[11px] text-gray-400 font-mono flex items-center gap-2 mt-0.5">
                <span>Filesystem: <strong>{drive?.fs_type || 'btrfs'}</strong></span>
                <span>•</span>
                <span>Role: <strong>{drive?.role || 'Storage'}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchDirectory(currentPath)}
              disabled={loading}
              className="p-2 rounded-lg bg-[#1a2035] hover:bg-[#252d4a] text-gray-300 transition-colors border border-white/5 cursor-pointer"
              title="Refresh Directory"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[#1a2035] hover:bg-rose-500/20 hover:text-rose-300 text-gray-400 transition-colors border border-white/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation & Breadcrumbs Bar */}
        <div className="p-3 bg-[#0f1322] border-b border-card-border/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full font-mono text-xs text-gray-300 py-1">
            <button
              onClick={() => parentPath && handleNavigate(parentPath)}
              disabled={!parentPath || loading}
              className={`p-1.5 rounded-lg border flex items-center gap-1 transition-colors ${
                parentPath
                  ? 'bg-[#181d30] border-white/10 hover:bg-cyan-500/20 text-cyan-300 cursor-pointer'
                  : 'bg-[#121524] border-transparent text-gray-600 cursor-not-allowed'
              }`}
              title="Up one level"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleNavigate('/')}
              className="px-2 py-1 rounded bg-[#181d30] hover:bg-cyan-500/20 text-cyan-300 transition-colors font-bold cursor-pointer"
            >
              /
            </button>

            {pathParts.map((part, idx) => {
              const fullSubPath = '/' + pathParts.slice(0, idx + 1).join('/');
              const isLast = idx === pathParts.length - 1;
              return (
                <React.Fragment key={idx}>
                  <ChevronRight className="w-3 h-3 text-gray-600 shrink-0" />
                  <button
                    onClick={() => handleNavigate(fullSubPath)}
                    className={`px-2 py-0.5 rounded transition-colors truncate max-w-[150px] cursor-pointer ${
                      isLast
                        ? 'bg-cyan-500/20 text-cyan-200 font-bold border border-cyan-500/30'
                        : 'hover:bg-white/10 text-gray-300'
                    }`}
                  >
                    {part}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Quick Actions & Search */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#141829] border border-card-border/60 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={handleCopyPath}
              className="px-2.5 py-1.5 rounded-lg bg-[#181d30] border border-card-border hover:bg-[#222942] text-[11px] font-mono text-gray-300 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="Copy path to clipboard"
            >
              {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPath ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Directory Contents List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 min-h-[350px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <span className="text-xs font-mono">Reading filesystem entries...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-rose-400 space-y-2 p-4 text-center">
              <Lock className="w-8 h-8 text-rose-500/80 mb-1" />
              <span className="font-bold text-sm">Access Restricted</span>
              <p className="text-xs text-rose-300/80 max-w-md font-mono">{error}</p>
              <button
                onClick={() => handleNavigate(homeDir)}
                className="mt-3 px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-xs font-mono text-rose-200 hover:bg-rose-500/30 cursor-pointer"
              >
                Return to Home Directory
              </button>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Folder className="w-8 h-8 text-gray-600 mb-2" />
              <span className="text-xs font-mono">Directory is empty</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 divide-y divide-white/5">
              {filteredEntries.map((item) => (
                <div
                  key={item.path}
                  onClick={() => item.is_dir && handleNavigate(item.path)}
                  className={`flex items-center justify-between p-2.5 rounded-lg transition-colors group ${
                    item.is_dir
                      ? 'hover:bg-cyan-500/10 cursor-pointer text-gray-200'
                      : 'hover:bg-white/5 text-gray-400'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate mr-4">
                    {getFileIcon(item.ext, item.is_dir)}
                    <span className={`text-xs truncate font-mono ${item.is_dir ? 'font-bold text-white group-hover:text-cyan-300' : 'text-gray-300'}`}>
                      {item.name}
                    </span>
                    {item.is_symlink && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        symlink
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-[11px] font-mono text-gray-500 shrink-0">
                    <span className="w-20 text-right">{item.size_human}</span>
                    <span className="hidden sm:inline-block w-32 text-right text-gray-600">{item.modified_str}</span>
                    {item.is_dir && (
                      <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer with Capacity Bar */}
        <div className="p-3 bg-[#0e1120] border-t border-card-border/60 flex items-center justify-between text-xs font-mono text-gray-400">
          <div className="flex items-center gap-2">
            <span>{filteredEntries.length} Items</span>
            {diskInfo && (
              <>
                <span>•</span>
                <span className="text-cyan-300 font-bold">{diskInfo.free_gb} GB Free</span>
                <span>/ {diskInfo.total_gb} GB ({diskInfo.percent}% Used)</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-[#1a2035] hover:bg-[#252d4a] text-gray-300 border border-white/10 transition-colors cursor-pointer"
          >
            Close Explorer
          </button>
        </div>

      </div>
    </div>
  );
}
