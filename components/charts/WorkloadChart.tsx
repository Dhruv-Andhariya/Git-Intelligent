'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle } from 'lucide-react';

export function WorkloadChart({ data }: { data: any }) {
  if (!data || !data.devs || data.devs.length === 0) return null;

  const chartData = data.devs.map((dev: string, i: number) => ({
    name: dev,
    commits: data.counts[i],
  })).sort((a: any, b: any) => b.commits - a.commits).slice(0, 10); // Top 10

  const topDev = data.topContributor;

  return (
    <div className="space-y-4">
      {topDev && topDev.pct > 50 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-amber-400 font-medium text-sm">Workload Imbalance</h4>
            <p className="text-amber-400/80 text-xs mt-1">
              {topDev.name} is responsible for {topDev.pct}% of all commits. This represents a significant single-point-of-failure risk.
            </p>
          </div>
        </div>
      )}

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#475569', fontSize: 11 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 11 }} />
            <Tooltip 
              cursor={{ fill: '#e2e8f0' }}
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px' }}
            />
            <Bar dataKey="commits" radius={[4, 4, 0, 0]}>
              {chartData.map((entry: any, index: number) => {
                const isImbalanced = topDev && topDev.pct > 50;
                const topColor = isImbalanced ? '#ef4444' : '#3b82f6';
                return <Cell key={`cell-${index}`} fill={index === 0 ? topColor : '#94a3b8'} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
