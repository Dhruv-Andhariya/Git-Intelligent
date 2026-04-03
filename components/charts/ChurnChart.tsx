'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function ChurnChart({ data }: { data: { labels: string[], data: number[] } }) {
  if (!data || !data.labels || data.labels.length === 0) {
    return <div className="h-64 flex items-center justify-center text-slate-400 font-mono text-sm">No churn data available</div>;
  }

  const chartData = data.labels.map((label, i) => ({
    name: label.split('/').pop() || label,
    fullName: label,
    commits: data.data[i],
  }));

  const maxCommits = Math.max(...data.data);

  const dynamicHeight = Math.max(400, chartData.length * 25);

  return (
    <div className="w-full" style={{ height: dynamicHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#475569', fontSize: 12, fontFamily: 'monospace' }}
            width={150}
            interval={0}
          />
          <Tooltip 
            cursor={{ fill: '#e2e8f0' }}
            contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px' }}
            itemStyle={{ color: '#0f172a' }}
            formatter={(value: any) => [`${value} commits`, 'Churn']}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
          />
          <Bar dataKey="commits" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => {
              // Color scale from green to red based on intensity
              const intensity = entry.commits / maxCommits;
              let r, g, b = 50;
              if (intensity < 0.5) {
                g = 200;
                r = Math.round(200 * (intensity * 2));
              } else {
                r = 239;
                g = Math.round(200 * (1 - (intensity - 0.5) * 2));
              }
              return <Cell key={`cell-${index}`} fill={`rgb(${r}, ${g}, ${b})`} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
