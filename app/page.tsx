'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { GitBranch, ShieldAlert, Zap, Lock, Info } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  const [path, setPath] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const { setRepoPath, setIsAnalyzing, setAnalysisData } = useAppStore();

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) {
      setError('Please enter a repository path or GitHub URL');
      return;
    }

    setError('');
    setIsAnalyzing(true);
    let targetPath = path;

    if (path.startsWith('http://') || path.startsWith('https://')) {
      setError('Cloning repository... this may take a while for full history!');
      try {
        const cloneRes = await fetch('/api/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: path }),
        });
        if (!cloneRes.ok) throw new Error(await cloneRes.text());
        const cloneData = await cloneRes.json();
        targetPath = cloneData.path;
        setError('Repository cloned! Beginning analysis...');
      } catch (err: any) {
        setError(`Clone failed: ${err.message}`);
        setIsAnalyzing(false);
        return;
      }
    }

    setRepoPath(targetPath);
    router.push('/dashboard');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_path: targetPath }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to analyze repository');
      }

      const data = await res.json();
      setAnalysisData(data);
      setIsAnalyzing(false);
    } catch (err: any) {
      setError(err.message);
      setIsAnalyzing(false);
      router.push('/'); // Go back on error
    }
  };

  const handleDemoSetup = async () => {
    try {
      setIsAnalyzing(true);
      setError('Setting up demo repository...');
      const res = await fetch('/api/demo-setup', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to setup demo repo');
      const data = await res.json();
      setPath(data.path);
      
      // Now analyze it
      setError('Analyzing demo repository...');
      setRepoPath(data.path);
      
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_path: data.path }),
      });

      if (!analyzeRes.ok) {
        const analyzeData = await analyzeRes.json();
        throw new Error(analyzeData.error || 'Failed to analyze repository');
      }

      const analysisData = await analyzeRes.json();
      setAnalysisData(analysisData);
      setIsAnalyzing(false);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4 font-sans relative">
      <div className="absolute top-6 right-6 hidden md:flex">
        <Link href="/about" className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm">
          <Info className="w-4 h-4" />
          About the Project
        </Link>
      </div>
      <div className="max-w-3xl w-full space-y-12">
        
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center p-3 bg-white/5 rounded-2xl mb-4 border border-slate-200">
            <GitBranch className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            GitLens <span className="text-blue-600">Intelligence</span>
          </h1>
          <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            The only tool that tells you not just where your codebase risk is today — but exactly what happens when a specific developer leaves, and what to do about it in the next 72 hours.
          </p>
        </div>

        <div className="bg-white shadow-sm border border-slate-200 p-8 rounded-3xl backdrop-blur-sm shadow-2xl">
          <form onSubmit={handleAnalyze} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                Target Repository
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="Paste local repo path OR GitHub URL (e.g. https://github.com/facebook/react)"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-4 text-base focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600 transition-all font-mono"
                />
              </div>
              {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-600 text-black font-bold text-lg py-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Analyze Codebase
              </button>
              <button
                type="button"
                onClick={handleDemoSetup}
                className="flex-1 bg-white/10 hover:bg-white/20 text-slate-900 font-bold text-lg py-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <GitBranch className="w-5 h-5" />
                Generate Demo Repo
              </button>
            </div>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-200 flex flex-wrap gap-4 justify-center text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4" /> Local-first
            </div>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> Zero upload
            </div>
            <span>·</span>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> AI-powered
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
