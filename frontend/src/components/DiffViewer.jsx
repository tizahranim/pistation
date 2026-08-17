import React from 'react';
import { FileCode, Plus, Minus, Copy, Check } from 'lucide-react';

export default function DiffViewer({ diffText, filename }) {
  const [copied, setCopied] = React.useState(false);

  if (!diffText) return null;

  const lines = diffText.split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(diffText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-xl border border-card-border/80 bg-[#0c0e15] overflow-hidden text-xs font-mono shadow-md">
      {/* Diff Header */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#121622] border-b border-card-border/60 text-[11px] text-gray-300">
        <div className="flex items-center gap-2">
          <FileCode className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-semibold">{filename || 'File Diff / Patch'}</span>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-200 transition-colors p-1 rounded hover:bg-card-border/40"
          title="Copy diff"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Diff Lines Content */}
      <div className="overflow-x-auto p-2 space-y-0.5 max-h-96 leading-relaxed">
        {lines.map((line, idx) => {
          let lineType = 'normal';
          if (line.startsWith('+') && !line.startsWith('+++')) lineType = 'add';
          else if (line.startsWith('-') && !line.startsWith('---')) lineType = 'del';
          else if (line.startsWith('@@')) lineType = 'hunk';

          return (
            <div
              key={idx}
              className={`flex items-start px-2 py-0.5 rounded text-[11px] ${
                lineType === 'add'
                  ? 'bg-emerald-500/15 text-emerald-300 border-l-2 border-emerald-500'
                  : lineType === 'del'
                  ? 'bg-red-500/15 text-red-300 border-l-2 border-red-500'
                  : lineType === 'hunk'
                  ? 'bg-indigo-500/10 text-indigo-300 font-bold'
                  : 'text-gray-300'
              }`}
            >
              <span className="w-6 text-gray-600 select-none text-right pr-3 shrink-0">
                {idx + 1}
              </span>
              <span className="whitespace-pre flex-1">{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
