'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';
import { Loader2, History as HistoryIcon, TrendingUp, Users, Activity } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#18181b] border border-[#3f3f46] p-3 rounded-lg shadow-xl">
        <p className="text-slate-500 text-xs mb-2">{payload[0].payload.date}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function HistoryTab({ repoPath }: { repoPath: string }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const setHistoryData = useAppStore(s => s.setHistoryData);

  useEffect(() => {
    fetch(`/api/history?repo_path=${encodeURIComponent(repoPath)}&limit=30`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch history');
        return res.json();
      })
      .then(data => {
        setHistory(data);
        setHistoryData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [repoPath, setHistoryData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-600" />
        <p>Loading historical data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
        Error: {error}
      </div>
    );
  }

  if (history.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white shadow-sm border border-slate-200 rounded-3xl">
        <HistoryIcon className="w-12 h-12 mb-4 opacity-50" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">Not Enough History</h3>
        <p className="text-center max-w-md">
          Run the analysis a few more times to start seeing historical trends. We need at least 2 data points to draw charts.
        </p>
      </div>
    );
  }

  const chartData = history.map((entry, index) => {
    const date = format(parseISO(entry.created_at), 'MMM d, HH:mm');
    // Calculate total churn from the top 20 files
    const totalChurn = entry.snapshot.churn?.data?.reduce((a: number, b: number) => a + b, 0) || 0;
    
    return {
      name: `Run ${index + 1}`,
      date,
      busFactor: entry.snapshot.busFactor?.score || 0,
      churn: totalChurn,
      topDevPct: entry.snapshot.workload?.topContributor?.pct || 0,
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
          <HistoryIcon className="w-6 h-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Historical Trends</h2>
          <p className="text-slate-500 text-sm">Track codebase health metrics over time</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bus Factor Trend */}
        <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-3xl">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Users className="w-4 h-4" /> Bus Factor Score Trend
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis domain={[0, 10]} stroke="#52525b" tick={{ fill: '#475569', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="busFactor" 
                  name="Bus Factor Score" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Workload Trend */}
        <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-3xl">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Top Contributor Workload (%)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis domain={[0, 100]} stroke="#52525b" tick={{ fill: '#475569', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="topDevPct" 
                  name="Top Dev Workload %" 
                  stroke="#f59e0b" 
                  strokeWidth={3}
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Churn Trend */}
        <div className="bg-white shadow-sm border border-slate-200 p-6 rounded-3xl lg:col-span-2">
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Total Code Churn (Top 20 Files)
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="name" stroke="#52525b" tick={{ fill: '#475569', fontSize: 12 }} />
                <YAxis stroke="#52525b" tick={{ fill: '#475569', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="churn" 
                  name="Total Commits (Top Files)" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
