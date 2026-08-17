import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext.jsx';
import { 
  FileText, 
  Upload, 
  Trash2, 
  Download, 
  Search, 
  RefreshCw, 
  FileCode, 
  File, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  Eye, 
  Plus, 
  ExternalLink,
  Loader2,
  HardDrive,
  Clock,
  Database,
  Filter,
  Check,
  Zap,
  HelpCircle
} from 'lucide-react';

export default function DocumentInventory({ documents = [], onRefreshDocs }) {
  const { t, isRTL } = useLanguage();
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [docDetail, setDocDetail] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [activeDetailTab, setActiveDetailTab] = useState('preview'); // 'preview' | 'chunks' | 'rag_test'
  
  // Interactive RAG / Knowledge Search tester
  const [ragQuery, setRagQuery] = useState('');
  const [ragResults, setRagResults] = useState([]);
  const [isSearchingRag, setIsSearchingRag] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (documents.length > 0 && !selectedDocId) {
      handleSelectDocument(documents[0].id);
    }
  }, [documents]);

  const handleSelectDocument = async (id) => {
    setSelectedDocId(id);
    setIsLoadingDetail(true);
    setRagResults([]);
    try {
      const res = await fetch(`/api/documents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDocDetail(data);
      }
    } catch (e) {
      console.error('Failed to load document detail:', e);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        await onRefreshDocs?.();
        if (data.document?.id) {
          handleSelectDocument(data.document.id);
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id, e) => {
    e?.stopPropagation();
    if (!confirm('Are you sure you want to delete this document and all its indexed chunks?')) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedDocId === id) {
          setSelectedDocId(null);
          setDocDetail(null);
        }
        onRefreshDocs?.();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleTestRagSearch = async (e) => {
    e?.preventDefault();
    if (!ragQuery.trim() || !selectedDocId) return;

    setIsSearchingRag(true);
    try {
      const res = await fetch('/api/documents/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_ids: [selectedDocId],
          query: ragQuery.trim(),
          top_k: 4
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRagResults(data.results || []);
      }
    } catch (err) {
      console.error('RAG search error:', err);
    } finally {
      setIsSearchingRag(false);
    }
  };

  const getDocIcon = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    if (['pdf'].includes(ext)) return <FileText className="w-4 h-4 text-red-400" />;
    if (['docx', 'doc', 'epub', 'rtf'].includes(ext)) return <FileText className="w-4 h-4 text-sky-400" />;
    if (['py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'c', 'cpp', 'rs', 'go', 'java', 'sh', 'sql'].includes(ext)) return <FileCode className="w-4 h-4 text-blue-400" />;
    if (['json', 'csv', 'tsv', 'yaml', 'yml', 'xml', 'toml', 'ndjson'].includes(ext)) return <Database className="w-4 h-4 text-emerald-400" />;
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) return <Eye className="w-4 h-4 text-pink-400" />;
    if (['mp3', 'wav', 'mp4', 'm4a'].includes(ext)) return <Zap className="w-4 h-4 text-amber-400" />;
    if (['md', 'txt', 'log', 'rst'].includes(ext)) return <FileText className="w-4 h-4 text-indigo-400" />;
    return <File className="w-4 h-4 text-gray-400" />;
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.filename.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (typeFilter === 'all') return true;
    const ext = doc.filename.split('.').pop().toLowerCase();
    if (typeFilter === 'docs') return ['pdf', 'docx', 'doc', 'epub', 'rtf'].includes(ext);
    if (typeFilter === 'code') return ['py', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'c', 'cpp', 'rs', 'go', 'java', 'sh', 'sql'].includes(ext);
    if (typeFilter === 'text') return ['md', 'txt', 'log', 'rst'].includes(ext);
    if (typeFilter === 'data') return ['json', 'csv', 'tsv', 'yaml', 'yml', 'xml', 'toml', 'ndjson'].includes(ext);
    if (typeFilter === 'media') return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'mp3', 'wav', 'mp4'].includes(ext);
    return true;
  });

  const totalChunksCount = documents.reduce((acc, d) => acc + (d.chunk_count || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0d13] overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-card-border bg-[#0e111a] flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-sm font-bold text-gray-100 flex items-center gap-2 font-mono">
            <Database className="w-4 h-4 text-indigo-400" />
            <span>Universal Knowledge Library</span>
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5 font-sans">
            Universal repository supporting PDFs, Word documents, CSV/Excel data, source code, JSON, Markdown, and media assets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="*"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold font-mono flex items-center gap-1.5 shadow disabled:opacity-50 transition-all"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{uploading ? 'Parsing & Ingesting...' : 'Add to Library'}</span>
          </button>

          <button
            onClick={onRefreshDocs}
            className="p-1.5 rounded-lg border border-card-border hover:bg-[#151928] text-gray-400 hover:text-gray-200"
            title="Refresh Library"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main 2-Pane View */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Pane: Document Inventory Cards */}
        <div className="w-80 border-r border-card-border bg-[#0d0f17] flex flex-col shrink-0 overflow-hidden">
          <div className="p-3 border-b border-card-border space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#151824] border border-card-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            {/* Type Filters */}
            <div className="flex items-center gap-1 overflow-x-auto text-[10px] font-mono select-none">
              {[
                { id: 'all', label: 'All' },
                { id: 'docs', label: 'Docs & PDFs' },
                { id: 'data', label: 'Data & Sheets' },
                { id: 'code', label: 'Code' },
                { id: 'text', label: 'Markdown' },
                { id: 'media', label: 'Media' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTypeFilter(t.id)}
                  className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                    typeFilter === t.id
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="text-[10px] font-mono text-gray-400 flex items-center justify-between pt-1">
              <span>{filteredDocs.length} ASSETS ({totalChunksCount} CHUNKS)</span>
              <span className="text-emerald-400">● AI Ready</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredDocs.length === 0 ? (
              <div className="text-center py-10 px-4 text-xs text-gray-500 space-y-2">
                <FileText className="w-8 h-8 text-gray-600 mx-auto" />
                <p>No documents found.</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-indigo-400 hover:underline font-mono text-[11px]"
                >
                  + Upload your first file
                </button>
              </div>
            ) : (
              filteredDocs.map(doc => {
                const isSelected = selectedDocId === doc.id;
                return (
                  <div
                    key={doc.id}
                    onClick={() => handleSelectDocument(doc.id)}
                    className={`group p-2.5 rounded-xl cursor-pointer border transition-all ${
                      isSelected
                        ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-md'
                        : 'bg-[#121520] border-card-border/60 hover:border-card-border text-gray-300 hover:bg-[#161a28]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-indigo-500/20 text-indigo-400' : 'bg-[#1a2030] text-gray-400'}`}>
                          {getDocIcon(doc.filename)}
                        </div>
                        <div className="truncate">
                          <div className="font-mono text-xs font-bold truncate text-gray-200">{doc.filename}</div>
                          <div className="text-[10px] font-mono text-gray-500 flex items-center gap-2 mt-0.5">
                            <span>{Math.round((doc.file_size || 0) / 1024)} KB</span>
                            <span>•</span>
                            <span>{doc.chunk_count || 1} chunks</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDelete(doc.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 text-gray-500 transition-opacity"
                        title="Delete Document"
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

        {/* Right Pane: Document Deep Inspector */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#111420]">
          {docDetail ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Document Header & Actions */}
              <div className="p-4 border-b border-card-border bg-[#0e111a] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                    {getDocIcon(docDetail.filename)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-100 font-mono flex items-center gap-2">
                      <span>{docDetail.filename}</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[10px] text-indigo-300 font-mono">
                        {docDetail.chunk_count || 1} Indexed Chunks
                      </span>
                    </h3>
                    <div className="text-[10px] font-mono text-gray-500 flex items-center gap-3 mt-0.5">
                      <span>Size: {Math.round((docDetail.file_size || 0) / 1024)} KB</span>
                      <span>•</span>
                      <span>Uploaded: {new Date(docDetail.created_at).toLocaleString()}</span>
                      <span>•</span>
                      <span className="text-emerald-400">Status: Parsed & Ready</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/api/documents/${docDetail.id}/download`}
                    download={docDetail.filename}
                    className="px-3 py-1.5 rounded-lg border border-card-border hover:bg-[#181c2b] text-gray-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Download File</span>
                  </a>

                  <button
                    onClick={(e) => handleDelete(docDetail.id, e)}
                    className="px-2.5 py-1.5 rounded-lg border border-card-border hover:border-red-500/40 text-gray-400 hover:text-red-400 text-xs font-mono flex items-center gap-1"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inspector Subnav */}
              <div className="h-10 border-b border-card-border bg-[#0b0d13] px-4 flex items-center gap-4 text-xs font-mono select-none">
                <button
                  onClick={() => setActiveDetailTab('preview')}
                  className={`flex items-center gap-1.5 h-full border-b-2 transition-colors ${
                    activeDetailTab === 'preview'
                      ? 'border-indigo-400 text-indigo-300 font-bold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Document Text Preview</span>
                </button>

                <button
                  onClick={() => setActiveDetailTab('chunks')}
                  className={`flex items-center gap-1.5 h-full border-b-2 transition-colors ${
                    activeDetailTab === 'chunks'
                      ? 'border-indigo-400 text-indigo-300 font-bold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Parsed RAG Chunks ({docDetail.chunks?.length || docDetail.chunk_count || 0})</span>
                </button>

                <button
                  onClick={() => setActiveDetailTab('rag_test')}
                  className={`flex items-center gap-1.5 h-full border-b-2 transition-colors ${
                    activeDetailTab === 'rag_test'
                      ? 'border-indigo-400 text-indigo-300 font-bold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Test Semantic RAG Search</span>
                </button>
              </div>

              {/* Inspector Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
                {activeDetailTab === 'preview' && (
                  <div className="p-4 rounded-xl bg-[#0d0f17] border border-card-border shadow-inner">
                    <pre className="text-xs font-mono text-gray-200 whitespace-pre-wrap leading-relaxed selection:bg-indigo-500/30">
                      {docDetail.raw_preview || (docDetail.chunks && docDetail.chunks.map(c => c.content).join('\n\n')) || 'No preview text available.'}
                    </pre>
                  </div>
                )}

                {activeDetailTab === 'chunks' && (
                  <div className="space-y-3">
                    {docDetail.chunks && docDetail.chunks.length > 0 ? (
                      docDetail.chunks.map((chunk, idx) => (
                        <div key={idx} className="p-3.5 rounded-xl bg-[#0d0f17] border border-card-border space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-mono text-indigo-300 font-bold">
                            <span>CHUNK #{chunk.chunk_index !== undefined ? chunk.chunk_index : idx + 1}</span>
                            <span className="text-gray-500 text-[10px]">{chunk.content.length} characters</span>
                          </div>
                          <p className="text-xs text-gray-300 leading-relaxed font-mono whitespace-pre-wrap">
                            {chunk.content}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-xs text-gray-500">
                        No individual chunk partitions recorded.
                      </div>
                    )}
                  </div>
                )}

                {activeDetailTab === 'rag_test' && (
                  <div className="space-y-4 max-w-3xl">
                    <div className="p-3 rounded-xl bg-[#141824] border border-card-border text-xs text-gray-300 space-y-1">
                      <div className="font-bold text-indigo-300 font-mono flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Interactive Vector & Semantic Retrieval Tester</span>
                      </div>
                      <p className="text-[11px] text-gray-400">
                        Type any question or keyword below to test which specific chunks from <b>{docDetail.filename}</b> will be retrieved and injected into agent prompts.
                      </p>
                    </div>

                    <form onSubmit={handleTestRagSearch} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={ragQuery}
                        onChange={(e) => setRagQuery(e.target.value)}
                        placeholder="e.g. What is the main finding regarding performance?..."
                        className="flex-1 bg-[#151928] border border-card-border rounded-xl px-3.5 py-2.5 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:border-indigo-500 font-sans"
                      />
                      <button
                        type="submit"
                        disabled={isSearchingRag || !ragQuery.trim()}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 disabled:opacity-50 shadow"
                      >
                        {isSearchingRag ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                        <span>Search Chunks</span>
                      </button>
                    </form>

                    {ragResults.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="text-xs font-mono font-bold text-emerald-400">
                          MATCHED {ragResults.length} RELEVANT CHUNKS:
                        </div>
                        {ragResults.map((res, i) => (
                          <div key={i} className="p-3.5 rounded-xl bg-[#0d0f17] border border-emerald-500/30 space-y-1">
                            <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300 font-bold">
                              <span>MATCH #{i + 1}</span>
                              <span className="text-gray-500 text-[10px]">Score / Distance Match</span>
                            </div>
                            <p className="text-xs text-gray-200 leading-relaxed font-mono whitespace-pre-wrap">
                              {typeof res === 'string' ? res : res.content || JSON.stringify(res)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-gray-500 space-y-2">
              <FileText className="w-12 h-12 text-gray-600" />
              <h4 className="text-sm font-semibold text-gray-300">No document selected</h4>
              <p className="text-xs max-w-sm">Select any document from the inventory on the left to inspect its raw text, chunks, and test RAG retrieval.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
