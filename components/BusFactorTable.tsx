'use client';

import { ScoreBadge } from './ScoreBadge';

export function BusFactorTable({ data }: { data: any }) {
  if (!data || !data.flaggedFiles) return null;

  return (
    <div className="space-y-8">
      <div className="bg-white shadow-sm border border-slate-200 p-8 rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-2">Bus Factor Analysis</h2>
            <p className="text-slate-500 max-w-2xl">
              Files where a single developer owns the vast majority of commits. If these developers leave, institutional knowledge for these modules drops to zero.
            </p>
          </div>
          <div className="shrink-0 bg-slate-100/90 p-4 rounded-2xl border border-slate-100">
            <ScoreBadge score={data.score} type="busFactor" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                <th className="pb-4 font-medium pl-4">File Path</th>
                <th className="pb-4 font-medium">Primary Owner</th>
                <th className="pb-4 font-medium text-right">Ownership</th>
                <th className="pb-4 font-medium text-right pr-4">Total Commits</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {data.flaggedFiles.map((file: any, i: number) => {
                const isCritical = file.pct > 80;
                return (
                  <tr 
                    key={i} 
                    className={`border-b border-slate-100 transition-colors ${
                      isCritical ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-4 pl-4 font-mono text-xs text-slate-700 truncate max-w-[300px]" title={file.file}>
                      {file.file}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                          {file.owner.charAt(0).toUpperCase()}
                        </div>
                        <span className={isCritical ? 'text-red-700 font-semibold' : 'text-slate-800'}>{file.owner}</span>
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-mono ${
                        isCritical ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {file.pct}%
                      </span>
                    </td>
                    <td className="py-4 text-right pr-4 font-mono text-slate-400">
                      {file.commits}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.flaggedFiles.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              No highly concentrated files found. Great job!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
