'use client';

import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Activity, Users, Zap, UserMinus, FileText, ArrowLeft, Loader2, History, BrainCircuit } from 'lucide-react';
import { ChurnChart } from '@/components/charts/ChurnChart';
import { CommitDoughnut } from '@/components/charts/CommitDoughnut';
import { WorkloadChart } from '@/components/charts/WorkloadChart';
import { ScoreBadge } from '@/components/ScoreBadge';
import { BusFactorTable } from '@/components/BusFactorTable';
import { AutomationTable } from '@/components/AutomationTable';
import { AIReport } from '@/components/AIReport';
import { DepartureSim } from '@/components/DepartureSim';
import { HistoryTab } from '@/components/HistoryTab';
import { KnowledgeRadarTab } from '@/components/KnowledgeRadarTab';
import ReactMarkdown from 'react-markdown';

export default function DashboardPage() {
  const {
    repoPath,
    analysisData,
    isAnalyzing,
    aiReportText,
    handoverText,
    knowledgeNarrativeText,
    historyData,
    setIsAnalyzing,
    setAnalysisData
  } = useAppStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['overview']));
  const [mounted, setMounted] = useState(false);

  const handleBranchChange = async (newBranch: string) => {
    if (newBranch === analysisData?.currentBranch) return;
    
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_path: repoPath, branch: newBranch }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to analyze repository branch');
      }

      const data = await res.json();
      setAnalysisData(data);
    } catch (err: any) {
      console.error(err);
      alert('Failed to switch branch: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisitedTabs(prev => new Set(prev).add(activeTab));
  }, [activeTab]);

  useEffect(() => {
    if (mounted && !isAnalyzing && !analysisData) {
      router.push('/');
    }
  }, [mounted, isAnalyzing, analysisData, router]);

  if (!mounted) return null;

  if (isAnalyzing) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-6" />
        <h2 className="text-2xl font-bold mb-2">Analyzing Repository</h2>
        <p className="text-slate-500 font-mono text-sm">{repoPath}</p>
        <div className="mt-8 space-y-3 w-full max-w-md">
          {['Parsing git log', 'Computing bus factor', 'Classifying commits', 'Scoring automation', 'Generating AI report'].map((step, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-slate-400">
              <div className="w-2 h-2 rounded-full bg-blue-600/20 animate-pulse" />
              {step}...
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!analysisData) return null;

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'bus-factor', label: 'Bus Factor', icon: Users },
    { id: 'automation', label: 'Automation', icon: Zap },
    { id: 'knowledge-radar', label: 'Knowledge Radar', icon: BrainCircuit },
    { id: 'departure-sim', label: 'Departure Sim', icon: UserMinus },
    { id: 'history', label: 'History', icon: History },
    { id: 'ai-report', label: 'AI Report', icon: FileText },
  ];

  let displayRepoName = analysisData.repoName || 'Repository';
  if (displayRepoName.includes('/') || displayRepoName.includes('\\') || displayRepoName.startsWith('gitlens-repo-')) {
    displayRepoName = repoPath.split(/[\/\\]/).pop() || 'Repository';
    if (displayRepoName.startsWith('gitlens-repo-')) displayRepoName = 'Cloned Repository';
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white backdrop-blur-md sticky top-0 z-50 print:hidden">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </button>
            <div>
              <h1 className="font-bold text-lg">{displayRepoName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select 
              value={analysisData.currentBranch || 'main'}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="hidden lg:block text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 cursor-pointer shadow-sm transition-all min-w-[120px]"
            >
              {(analysisData.availableBranches?.length > 0 ? analysisData.availableBranches : [analysisData.currentBranch || 'main']).map((b: string) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <button
              onClick={() => window.print()}
              className="hidden lg:block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              Download PDF Report
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors whitespace-nowrap text-sm ${isActive
                  ? 'bg-blue-600 text-white shadow-sm font-medium'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 font-medium'
                  }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 print:hidden">
        <div className={activeTab === 'overview' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
          <div className="space-y-8">
            {/* Top Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-2xl">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Bus Factor Risk</h3>
                <ScoreBadge score={analysisData.busFactor.score} type="busFactor" />
                <p className="mt-4 text-sm text-slate-400">
                  {analysisData.busFactor.flaggedFiles.length} files have critical single-owner concentration.
                </p>
              </div>
              <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-2xl">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Automation Opportunity</h3>
                <ScoreBadge score={analysisData.automation.repoScore} type="automation" />
                <p className="mt-4 text-sm text-slate-400">
                  {analysisData.automation.topFiles.length} files are prime candidates for AI agent delegation.
                </p>
              </div>
              <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-2xl">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Top Contributor</h3>
                <div className="text-4xl font-bold font-mono text-slate-900 mb-2">
                  {analysisData.workload.topContributor?.pct || 0}%
                </div>
                <p className="text-sm text-slate-400">
                  of all commits belong to <span className="text-slate-700 font-medium">{analysisData.workload.topContributor?.name || 'Unknown'}</span>.
                </p>
              </div>
              <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-2xl">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Total Commits</h3>
                <div className="text-4xl font-bold font-mono text-slate-900 mb-2">
                  {analysisData.workload.totalCommits?.toLocaleString() || 0}
                </div>
                <p className="text-sm text-slate-400">
                  commits analyzed in this repository.
                </p>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-2xl flex flex-col h-[500px]">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-6 shrink-0">Code Churn Heatmap (All Time)</h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  <ChurnChart data={analysisData.churn} />
                </div>
              </div>
              <div className="space-y-6">
                <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-2xl">
                  <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-6">Commit Types</h3>
                  <CommitDoughnut data={analysisData.commitTypes} />
                </div>
                <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-2xl">
                  <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-6">Contributor Workload</h3>
                  <WorkloadChart data={analysisData.workload} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {visitedTabs.has('bus-factor') && (
          <div className={activeTab === 'bus-factor' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
            <BusFactorTable data={analysisData.busFactor} />
          </div>
        )}

        {visitedTabs.has('automation') && (
          <div className={activeTab === 'automation' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
            <AutomationTable data={analysisData.automation} />
          </div>
        )}

        {visitedTabs.has('knowledge-radar') && (
          <div className={activeTab === 'knowledge-radar' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
            <KnowledgeRadarTab data={analysisData.knowledgeDecay} devs={analysisData.workload.devs} />
          </div>
        )}

        {visitedTabs.has('departure-sim') && (
          <div className={activeTab === 'departure-sim' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
            <DepartureSim devs={analysisData.workload.devs} repoPath={repoPath} />
          </div>
        )}

        {visitedTabs.has('history') && (
          <div className={activeTab === 'history' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
            <HistoryTab repoPath={repoPath} />
          </div>
        )}

        {visitedTabs.has('ai-report') && (
          <div className={activeTab === 'ai-report' ? 'block animate-in fade-in slide-in-from-bottom-4 duration-500' : 'hidden'}>
            <AIReport repoPath={repoPath} />
          </div>
        )}
      </main>

      {/* Printable Report (Hidden on screen, visible on print) */}
      <div className="hidden print:block print:bg-white print:text-black p-8 space-y-12 max-w-4xl mx-auto">
        <div className="border-b-2 border-slate-900 pb-6 mb-8">
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">GitLens Intelligence Report</h1>
          <p className="text-xl text-slate-500 mt-2 font-mono">{analysisData.repoName}</p>
        </div>

        <div className="grid grid-cols-4 gap-4 break-inside-avoid mb-8">
          <div className="border border-slate-200 p-4 rounded-xl">
            <h3 className="text-xs uppercase text-slate-500 font-semibold mb-1">Bus Factor Score</h3>
            <div className="text-2xl font-bold font-mono">{analysisData.busFactor.score}/10</div>
          </div>
          <div className="border border-slate-200 p-4 rounded-xl">
            <h3 className="text-xs uppercase text-slate-500 font-semibold mb-1">Automation Score</h3>
            <div className="text-2xl font-bold font-mono">{analysisData.automation.repoScore}/100</div>
          </div>
          <div className="border border-slate-200 p-4 rounded-xl">
            <h3 className="text-xs uppercase text-slate-500 font-semibold mb-1">Knowledge Health</h3>
            <div className="text-2xl font-bold font-mono">{analysisData.knowledgeDecay.healthScore}/100</div>
          </div>
          <div className="border border-slate-200 p-4 rounded-xl">
            <h3 className="text-xs uppercase text-slate-500 font-semibold mb-1">Total Commits</h3>
            <div className="text-2xl font-bold font-mono">{analysisData.workload.totalCommits?.toLocaleString() || 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 break-inside-avoid pt-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Contributor Workload (Top 20)</h2>
            <table className="w-full text-left text-sm border-collapse">
              <thead><tr className="border-b border-slate-300 text-slate-600 bg-slate-50"><th className="p-3 font-semibold">Developer</th><th className="p-3 font-semibold text-right">Commits</th></tr></thead>
              <tbody>
                {analysisData.workload.devs.slice(0, 20).map((dev: string, i: number) => (
                  <tr key={dev} className="border-b border-slate-100">
                    <td className="p-3 font-medium">{dev}</td>
                    <td className="p-3 text-right font-mono">{analysisData.workload.counts[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Commit Types</h2>
            <table className="w-full text-left text-sm border-collapse">
              <thead><tr className="border-b border-slate-300 text-slate-600 bg-slate-50"><th className="p-3 font-semibold">Type</th><th className="p-3 font-semibold text-right">Count</th></tr></thead>
              <tbody>
                <tr className="border-b border-slate-100"><td className="p-3 font-medium text-blue-600">Features</td><td className="p-3 text-right font-mono">{analysisData.commitTypes.feat}</td></tr>
                <tr className="border-b border-slate-100"><td className="p-3 font-medium text-red-600">Fixes</td><td className="p-3 text-right font-mono">{analysisData.commitTypes.fix}</td></tr>
                <tr className="border-b border-slate-100"><td className="p-3 font-medium text-amber-500">Refactors</td><td className="p-3 text-right font-mono">{analysisData.commitTypes.refactor}</td></tr>
                <tr className="border-b border-slate-100"><td className="p-3 font-medium text-slate-500">Chores</td><td className="p-3 text-right font-mono">{analysisData.commitTypes.chore}</td></tr>
                <tr className="border-b border-slate-100"><td className="p-3 font-medium text-slate-400">Other</td><td className="p-3 text-right font-mono">{analysisData.commitTypes.other}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6 break-inside-avoid pt-8 mb-8">
          <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2">Automation Opportunity (Top 20)</h2>
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-slate-600 bg-slate-50">
                <th className="p-3 font-semibold">File Path</th>
                <th className="p-3 font-semibold">Reasoning</th>
                <th className="p-3 font-semibold text-right">Candidate Score</th>
              </tr>
            </thead>
            <tbody>
              {analysisData.automation.topFiles.slice(0, 20).map((f: any) => (
                <tr key={f.file} className="border-b border-slate-100">
                  <td className="p-3 font-mono text-xs">{f.file}</td>
                  <td className="p-3 text-slate-600">{f.reason}</td>
                  <td className="p-3 text-right font-mono text-green-600">{f.score}/100</td>
                </tr>
              ))}
              {analysisData.automation.topFiles.length === 0 && (
                <tr><td colSpan={3} className="p-4 text-center text-slate-500">No strong automation candidates found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-6 break-inside-avoid">
          <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2">Bus Factor Risk (Top 20)</h2>
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-slate-600 bg-slate-50">
                <th className="p-3 font-semibold">File Path</th>
                <th className="p-3 font-semibold">Primary Owner</th>
                <th className="p-3 font-semibold text-right">Ownership %</th>
              </tr>
            </thead>
            <tbody>
              {analysisData.busFactor.flaggedFiles.slice(0, 20).map((f: any) => (
                <tr key={f.file} className="border-b border-slate-100">
                  <td className="p-3 font-mono text-xs">{f.file}</td>
                  <td className="p-3 font-medium">{f.owner}</td>
                  <td className="p-3 text-right font-mono text-red-600">{f.pct}%</td>
                </tr>
              ))}
              {analysisData.busFactor.flaggedFiles.length === 0 && (
                <tr><td colSpan={3} className="p-4 text-center text-slate-500">No critical files found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-6 break-inside-avoid pt-8">
          <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2">Code Churn Heatmap (Top 20)</h2>
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-slate-600 bg-slate-50">
                <th className="p-3 font-semibold">File Path</th>
                <th className="p-3 font-semibold text-right">Total Commits (All Time)</th>
              </tr>
            </thead>
            <tbody>
              {analysisData.churn.labels.slice(0, 20).map((label: string, i: number) => (
                <tr key={label} className="border-b border-slate-100">
                  <td className="p-3 font-mono text-xs">{label}</td>
                  <td className="p-3 text-right font-mono">{analysisData.churn.data[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-6 break-inside-avoid pt-8">
          <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2">Knowledge Decay Ledger (Top 20 Critical Files)</h2>
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-300 text-slate-600 bg-slate-50">
                <th className="p-3 font-semibold">File Path</th>
                <th className="p-3 font-semibold">Decay Status</th>
                <th className="p-3 font-semibold text-right">Memory Retention</th>
              </tr>
            </thead>
            <tbody>
              {analysisData.knowledgeDecay.files.slice(0, 20).map((f: any) => (
                <tr key={f.file} className="border-b border-slate-100">
                  <td className="p-3 font-mono text-xs">{f.file}</td>
                  <td className="p-3 font-medium text-slate-700">{f.status}</td>
                  <td className="p-3 text-right font-mono text-purple-600">{f.maxRetention}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Generated AI Narratives */}
        {aiReportText && (
          <div className="space-y-4 break-inside-avoid pt-8 mb-8">
            <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2">Executive Health Report</h2>
            <div className="prose prose-slate max-w-none text-sm leading-relaxed">
              <ReactMarkdown>{aiReportText}</ReactMarkdown>
            </div>
          </div>
        )}

        {knowledgeNarrativeText && (
          <div className="space-y-4 break-inside-avoid pt-8 mb-8">
            <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2">Knowledge Transfer Plan</h2>
            <div
              className="prose prose-slate max-w-none text-sm leading-relaxed prose-h3:text-slate-800 prose-strong:text-blue-600 list-disc list-inside"
              dangerouslySetInnerHTML={{ __html: knowledgeNarrativeText.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
            />
          </div>
        )}

        {handoverText && (
          <div className="space-y-4 break-inside-avoid pt-8 mb-8">
            <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2">Emergency 72-Hour Handover Plan</h2>
            <div className="prose prose-slate max-w-none text-sm leading-relaxed">
              <ReactMarkdown>{handoverText}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* History Trends */}
        {historyData && historyData.length > 0 && (
          <div className="space-y-4 break-inside-avoid pt-8 mb-8">
            <h2 className="text-2xl font-bold text-slate-800 border-b border-slate-200 pb-2">Historical Health Trends</h2>
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-slate-600 bg-slate-50">
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold text-right">Bus Factor</th>
                  <th className="p-3 font-semibold text-right">Top Dev Workload</th>
                  <th className="p-3 font-semibold text-right">Top Files Churn</th>
                </tr>
              </thead>
              <tbody>
                {historyData.slice(0, 10).map((entry: any, i: number) => {
                  return (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="p-3 font-mono text-xs">{entry.created_at.replace('T', ' ').substring(0, 16)}</td>
                      <td className="p-3 text-right font-mono text-green-600">{entry.snapshot.busFactor?.score || 0}/10</td>
                      <td className="p-3 text-right font-mono text-amber-600">{entry.snapshot.workload?.topContributor?.pct || 0}%</td>
                      <td className="p-3 text-right font-mono text-blue-600">{entry.snapshot.churn?.data?.reduce((a: number, b: number) => a + b, 0) || 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
