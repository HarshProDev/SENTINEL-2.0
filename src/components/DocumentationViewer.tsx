import React, { useState, useEffect } from 'react';
import { BookOpen, Search, FileText, RefreshCw } from 'lucide-react';

const documentation = import.meta.glob('../../docs/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const DOC_INDEX = [
  { id: 'ASSEMBLE', title: '18-Step Assembly Manual', file: 'ASSEMBLE.md' },
  { id: 'WIRING', title: 'Hardware Wiring & Pinout', file: 'WIRING.md' },
  { id: 'ARCHITECTURE', title: 'System Architecture', file: 'ARCHITECTURE.md' },
  { id: 'PROTOCOL', title: 'Schema v1 Telemetry Protocol', file: 'PROTOCOL.md' },
  { id: 'CALIBRATION', title: 'Resting Baseline Calibration', file: 'CALIBRATION.md' },
  { id: 'SIGNAL_PROCESSING', title: 'Biometric DSP & Refractory Gate', file: 'SIGNAL_PROCESSING.md' },
  { id: 'AI_INTEGRATION', title: 'Groq AI Integration & Privacy', file: 'AI_INTEGRATION.md' },
  { id: 'SAFETY', title: 'Electrical Safety & Non-Medical Notice', file: 'SAFETY.md' },
  { id: 'TROUBLESHOOTING', title: 'Diagnostic Matrix (19 Issues)', file: 'TROUBLESHOOTING.md' },
  { id: 'TESTING', title: 'Formal Acceptance Test Suite', file: 'TESTING.md' },
  { id: 'BOM', title: 'Bill of Materials (₹0 Target)', file: 'BOM.md' },
  { id: 'FAQ', title: 'Viva Exam Q&A & Presentation Script', file: 'FAQ.md' },
];

export const DocumentationViewer: React.FC = () => {
  const [selectedDoc, setSelectedDoc] = useState<string>('ASSEMBLE');
  const [docContent, setDocContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    const doc = DOC_INDEX.find(({ id }) => id === selectedDoc);
    const content = doc ? documentation[`../../docs/${doc.file}`] : undefined;
    setDocContent(content || 'Documentation content not available.');
    setLoading(false);
  }, [selectedDoc]);

  const filteredDocs = DOC_INDEX.filter((d) =>
    d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.file.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Sidebar List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm md:col-span-1">
        <div className="flex items-center gap-2 mb-3 px-1 text-slate-300">
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Engineering Manuals</h3>
        </div>

        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search docs..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="space-y-1 max-h-150 overflow-y-auto">
          {filteredDocs.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDoc(doc.id)}
              className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center justify-between ${selectedDoc === doc.id
                ? 'bg-slate-800 text-cyan-400 font-semibold border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
            >
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{doc.title}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Markdown Reader */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm md:col-span-3 min-h-125">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-slate-500 text-xs gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Loading documentation...</span>
          </div>
        ) : (
          <div className="prose prose-invert prose-cyan max-w-none text-xs leading-relaxed text-slate-300">
            <pre className="whitespace-pre-wrap font-sans text-xs bg-transparent border-0 p-0 text-slate-200 leading-relaxed overflow-x-auto">
              {docContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
