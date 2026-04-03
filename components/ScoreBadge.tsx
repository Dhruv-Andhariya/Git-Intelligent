'use client';

export function ScoreBadge({ score, type }: { score: number, type: 'busFactor' | 'automation' }) {
  let colorClass = '';
  let label = '';

  if (type === 'busFactor') {
    // 1-10 scale. 10 is good, 1 is bad.
    if (score >= 7) {
      colorClass = 'bg-blue-600/20 text-blue-600 border-blue-600/30';
      label = 'Healthy';
    } else if (score >= 4) {
      colorClass = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      label = 'At Risk';
    } else {
      colorClass = 'bg-red-500/20 text-red-400 border-red-500/30';
      label = 'Critical';
    }
  } else if (type === 'automation') {
    // 0-100 scale. Higher is more automatable.
    if (score >= 70) {
      colorClass = 'bg-blue-600/20 text-blue-600 border-blue-600/30';
      label = 'High ROI';
    } else if (score >= 40) {
      colorClass = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      label = 'Moderate';
    } else {
      colorClass = 'bg-zinc-500/20 text-slate-500 border-zinc-500/30';
      label = 'Low ROI';
    }
  }

  const textColor = colorClass.split(' ').find(c => c.startsWith('text-')) || 'text-slate-900';

  return (
    <div className="flex items-center gap-4">
      <div className={`text-5xl font-bold font-mono ${textColor}`}>
        {score}
        {type === 'busFactor' && <span className="text-2xl text-zinc-600">/10</span>}
      </div>
      <div className={`px-3 py-1 rounded-full text-xs font-medium border uppercase tracking-wider ${colorClass}`}>
        {label}
      </div>
    </div>
  );
}
