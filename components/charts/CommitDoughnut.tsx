'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlertTriangle } from 'lucide-react';

const COLORS = {
  feat: '#3b82f6', // blue (feature)
  fix: '#ef4444',  // red (bug fixes)
  refactor: '#fbbf24', // amber (refactoring)
  chore: '#94a3b8', // slate (chores)
  other: '#cbd5e1'  // lighter slate
};

export function CommitDoughnut({ data }: { data: any }) {
  if (!data) return null;

  const chartData = [
    { name: 'Features', value: data.feat, color: COLORS.feat },
    { name: 'Fixes', value: data.fix, color: COLORS.fix },
    { name: 'Refactors', value: data.refactor, color: COLORS.refactor },
    { name: 'Chores', value: data.chore, color: COLORS.chore },
    { name: 'Other', value: data.other, color: COLORS.other },
  ].filter(item => item.value > 0);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const fixRate = total > 0 ? (data.fix / total) * 100 : 0;

  return (
    <div className="space-y-4">
      {fixRate > 50 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-red-400 font-medium text-sm">High Instability Warning</h4>
            <p className="text-red-400/80 text-xs mt-1">
              {Math.round(fixRate)}% of recent commits are fixes. The team is spending more time firefighting than building.
            </p>
          </div>
        </div>
      )}

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px' }}
              itemStyle={{ color: '#0f172a' }}
            />
            <Legend verticalAlign="bottom" height={36} iconType="circle" />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
