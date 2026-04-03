'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/use-sse';
import { useAppStore } from '@/lib/store';
import { AlertOctagon, ArrowRight, Loader2, UserMinus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export function DepartureSim({ devs, repoPath }: { devs: string[], repoPath: string }) {
  const [selectedDev, setSelectedDev] = useState('');
  const [simData, setSimData] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState('');

  // Only start streaming when we have simData
  const streamUrl = simData 
    ? `/api/departure/stream?repo_path=${encodeURIComponent(repoPath)}&developer=${encodeURIComponent(selectedDev)}&orphanedFiles=${encodeURIComponent(JSON.stringify(simData.orphanedFiles))}&beforeScore=${simData.before.score}&afterScore=${simData.after.score}`
    : null;
    
  const { text: handoverPlan, loading: streamingPlan, error: streamError } = useSSE(streamUrl);
  const setHandoverText = useAppStore(s => s.setHandoverText);

  useEffect(() => {
    if (handoverPlan) setHandoverText(handoverPlan);
  }, [handoverPlan, setHandoverText]);

  useEffect(() => {
    setSimData(null);
    setSelectedDev('');
  }, [repoPath]);

  const handleSimulate = async () => {
    if (!selectedDev) return;
    
    setIsSimulating(true);
    setError('');
    setSimData(null);

    try {
      const res = await fetch('/api/departure/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_path: repoPath, developer: selectedDev }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Simulation failed');
      }

      const data = await res.json();
      setSimData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Control Panel */}
      <div className="bg-white shadow-sm border border-slate-200 p-8 rounded-3xl">
        <div className="flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 space-y-2 w-full">
            <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">
              Select Developer to Simulate Departure
            </label>
            <select
              value={selectedDev}
              onChange={(e) => setSelectedDev(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all text-slate-900"
            >
              <option value="" disabled>Choose a team member...</option>
              {devs.map((dev) => (
                <option key={dev} value={dev}>{dev}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleSimulate}
            disabled={!selectedDev || isSimulating}
            className="w-full md:w-auto px-8 py-3 bg-red-500 hover:bg-red-400 disabled:bg-slate-200 disabled:text-slate-400 text-slate-900 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            {isSimulating ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserMinus className="w-5 h-5" />}
            Run Simulation
          </button>
        </div>
        {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
      </div>

      {/* Results */}
      {simData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Impact Column */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-2xl">
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-6">Bus Factor Impact</h3>
              
              <div className="flex items-center justify-between mb-8">
                <div className="text-center">
                  <div className="text-4xl font-bold font-mono text-slate-700">{simData.before.score}</div>
                  <div className="text-xs text-slate-400 uppercase mt-1">Before</div>
                </div>
                <ArrowRight className="w-6 h-6 text-zinc-600" />
                <div className="text-center">
                  <div className={`text-4xl font-bold font-mono ${simData.after.score < simData.before.score ? 'text-red-400' : 'text-slate-700'}`}>
                    {simData.after.score}
                  </div>
                  <div className="text-xs text-slate-400 uppercase mt-1">After</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-black/30 rounded-lg border border-slate-100">
                  <span className="text-sm text-slate-500">Flagged Files (Before)</span>
                  <span className="font-mono text-slate-700">{simData.before.flaggedFiles}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <span className="text-sm text-red-400">Flagged Files (After)</span>
                  <span className="font-mono text-red-400 font-bold">{simData.after.flaggedFiles}</span>
                </div>
              </div>
            </div>

            <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-2xl">
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-red-400" />
                Orphaned Files ({simData.orphanedFiles.length})
              </h3>
              <p className="text-xs text-slate-400 mb-4">Files that lose their only active contributor.</p>
              
              <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {simData.orphanedFiles.length > 0 ? (
                  simData.orphanedFiles.map((f: string, i: number) => (
                    <div key={i} className="text-xs font-mono text-slate-700 p-2 bg-black/30 rounded border border-slate-100 truncate" title={f}>
                      {f}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-400 text-center py-4">No files orphaned.</div>
                )}
              </div>
            </div>
          </div>

          {/* Handover Plan Column */}
          <div className="lg:col-span-2 bg-white shadow-sm border border-slate-200 p-8 rounded-3xl">
            <h3 className="text-xl font-bold mb-2">72-Hour Emergency Handover Plan</h3>
            <p className="text-slate-500 text-sm mb-6 pb-6 border-b border-slate-200">
              AI-generated action plan to mitigate the departure of {selectedDev}.
            </p>

            <div className="prose prose-slate prose-red max-w-none font-sans">
              {streamError ? (
                <div className="text-red-400 p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                  {streamError}
                </div>
              ) : (
                <div className="space-y-6 text-slate-700 leading-relaxed">
                  {handoverPlan ? (
                    <ReactMarkdown>{handoverPlan}</ReactMarkdown>
                  ) : streamingPlan ? (
                    <div className="flex items-center gap-3 text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating hour-by-hour action plan...
                    </div>
                  ) : null}
                  
                  {streamingPlan && handoverPlan && (
                    <span className="inline-block w-2 h-4 bg-red-500 animate-pulse ml-1 align-middle" />
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
