'use client';

import { ScoreBadge } from './ScoreBadge';
import { Bot } from 'lucide-react';

export function AutomationTable({ data }: { data: any }) {
  if (!data || !data.topFiles) return null;

  return (
    <div className="space-y-8">
      <div className="bg-white shadow-sm border border-slate-200 p-8 rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Bot className="w-6 h-6 text-blue-600" />
              AI Automation Opportunities
            </h2>
            <p className="text-slate-500 max-w-2xl">
              Files scored 0-100 based on churn concentration, single-author ownership, and repetitive commit patterns. These are prime candidates for AI agent delegation.
            </p>
          </div>
          <div className="shrink-0 bg-slate-100/90 p-4 rounded-2xl border border-slate-100">
            <ScoreBadge score={data.repoScore} type="automation" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                <th className="pb-4 font-medium pl-4">File Path</th>
                <th className="pb-4 font-medium">Primary Owner</th>
                <th className="pb-4 font-medium">Reason</th>
                <th className="pb-4 font-medium text-right pr-4">AI ROI Score</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {data.topFiles.map((file: any, i: number) => {
                const isHigh = file.score >= 70;
                return (
                  <tr 
                    key={i} 
                    className={`border-b border-slate-100 transition-colors ${
                      isHigh ? 'bg-blue-600/5 hover:bg-blue-600/10' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-4 pl-4 font-mono text-xs text-slate-700 truncate max-w-[300px]" title={file.file}>
                      {file.file}
                    </td>
                    <td className="py-4 text-slate-500">
                      {file.owner}
                    </td>
                    <td className="py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700 border border-slate-200">
                        {file.reason}
                      </span>
                    </td>
                    <td className="py-4 text-right pr-4">
                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-mono font-bold ${
                        isHigh ? 'bg-blue-600/20 text-blue-600' : 'bg-blue-500/20 text-blue-400'
                      }`}>
                        {file.score}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.topFiles.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              No clear automation opportunities identified.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
