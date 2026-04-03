'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { BrainCircuit, AlertOctagon, Ghost, Sparkles, Loader2 } from 'lucide-react';

export function KnowledgeRadarTab({ data, devs }: { data: any, devs: string[] }) {
  const existingNarrative = useAppStore(s => s.knowledgeNarrativeText);
  const [narrative, setNarrative] = useState(existingNarrative || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const setKnowledgeNarrativeText = useAppStore(s => s.setKnowledgeNarrativeText);

  useEffect(() => {
    if (narrative) setKnowledgeNarrativeText(narrative);
  }, [narrative, setKnowledgeNarrativeText]);

  useEffect(() => {
    if (!existingNarrative) setNarrative('');
  }, [existingNarrative]);

  const generateNarrative = async () => {
    setIsGenerating(true);
    setNarrative('');
    try {
      const res = await fetch('/api/knowledge/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decayData: data, devs })
      });
      
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) setNarrative(prev => prev + parsed.text);
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const ghostCode = data?.files?.filter((f: any) => f.status === 'Ghost Code') || [];
  const criticalCode = data?.files?.filter((f: any) => f.status === 'Critical') || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Fresh': return 'text-blue-600 bg-blue-600/10 border-blue-600/20';
      case 'Fading': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'Degraded': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'Critical': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'Ghost Code': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      default: return 'text-slate-500 bg-slate-200 border-slate-300';
    }
  };

  if (!data?.files) return <div>No decay data found. Please run a new analysis.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-2xl flex items-center gap-4">
          <div className="p-4 bg-blue-600/10 rounded-xl">
            <BrainCircuit className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Knowledge Health</h3>
            <div className="text-3xl font-bold font-mono text-slate-900">{data.healthScore}/100</div>
          </div>
        </div>

        <div className="bg-purple-900/10 border border-purple-500/20 p-6 rounded-2xl flex items-center gap-4">
          <div className="p-4 bg-purple-500/10 rounded-xl">
            <Ghost className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-purple-400/80 uppercase tracking-wider">Ghost Code</h3>
            <div className="text-3xl font-bold font-mono text-purple-700">{ghostCode.length} files</div>
          </div>
        </div>

        <div className="bg-red-900/10 border border-red-500/20 p-6 rounded-2xl flex items-center gap-4">
          <div className="p-4 bg-red-500/10 rounded-xl">
            <AlertOctagon className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-red-400/80 uppercase tracking-wider">Critical Decay</h3>
            <div className="text-3xl font-bold font-mono text-red-700">{criticalCode.length} files</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white shadow-sm border border-slate-200 rounded-2xl overflow-hidden flex flex-col h-[600px]">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-blue-600" />
              Decay Ledger
            </h2>
            <p className="text-sm text-slate-500 mt-1">Files modeled with Ebbinghaus retention curve.</p>
          </div>
          
          <div className="overflow-y-auto flex-1 p-0 custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-100/90 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="px-6 py-4 font-medium text-slate-500">File</th>
                  <th className="px-6 py-4 font-medium text-slate-500">Status</th>
                  <th className="px-6 py-4 font-medium text-slate-500">Retention</th>
                  <th className="px-6 py-4 font-medium text-slate-500">Last Touch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.files.map((file: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-slate-700 max-w-[200px] truncate" title={file.file}>
                      {file.file.split('/').pop()}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(file.status)}`}>
                        {file.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600" 
                            style={{ 
                              width: Math.max(2, file.maxRetention) + '%',
                              backgroundColor: file.maxRetention < 10 ? '#c084fc' : file.maxRetention < 25 ? '#f87171' : file.maxRetention < 50 ? '#fb923c' : file.maxRetention < 75 ? '#fbbf24' : '#34d399'
                            }} 
                          />
                        </div>
                        <span className="font-mono text-xs text-slate-500 w-8">{file.maxRetention}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 flex flex-col gap-1">
                      {file.authors.length > 0 ? file.authors.map((a: any, i: number) => (
                        <div key={i} className="flex items-center justify-between gap-4 text-xs">
                          <span className="text-slate-700">{a.name.split(' ')[0]}</span>
                          <span className="text-slate-400 font-mono">{a.daysSince}d ago</span>
                        </div>
                      )) : <span className="text-slate-400">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white shadow-sm border border-slate-200 rounded-2xl flex flex-col h-[600px]">
          <div className="p-6 border-b border-slate-200">
             <h2 className="text-lg font-medium flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600" />
              Transfer Narrative
            </h2>
            <p className="text-sm text-slate-500 mt-1">AI-generated knowledge recovery plan.</p>
          </div>
          <div className="p-6 flex-1 overflow-y-auto prose prose-slate max-w-none text-sm leading-relaxed custom-scrollbar">
            {narrative ? (
                <div>
                  <div 
                    className="prose-h3:text-slate-800 prose-strong:text-blue-600 prose-ul:text-slate-500 prose-li:marker:text-blue-600" 
                    dangerouslySetInnerHTML={{ __html: narrative.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} 
                  />
                  {!isGenerating && (
                    <div className="mt-8 pt-6 border-t border-slate-100">
                      <button onClick={generateNarrative} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                        Regenerate Plan
                      </button>
                    </div>
                  )}
                </div>
            ) : isGenerating ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p>Analyzing decay ledger...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                <p>Generate an AI recovery plan for fading knowledge.</p>
                <button 
                  onClick={generateNarrative}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Transfer Plan
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
