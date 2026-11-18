// Lightweight, dependency-free charts. Single-series bars use Ocean Teal;
// the PDA↔FDA diverging bars use warm (over) / cool (under) with a neutral
// zero line. Every bar carries a direct value label and a hover tooltip.
import { useState } from 'react';

export interface BarDatum { key: string; label: string; value: number; display: string; detail?: string }

export function BarList({ data, emptyText = 'No data' }: { data: BarDatum[]; emptyText?: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const [hover, setHover] = useState<string | null>(null);
  if (!data.length) return <p className="text-sm text-slate py-6 text-center">{emptyText}</p>;
  return (
    <ul className="space-y-2.5" role="list">
      {data.map((d, i) => (
        <li key={d.key} className="group relative" onMouseEnter={() => setHover(d.key)} onMouseLeave={() => setHover(null)}>
          <div className="flex items-baseline justify-between text-xs mb-1">
            <span className="text-graphite font-medium">{d.label}</span>
            <span className="text-graphite tabular font-semibold">{d.display}</span>
          </div>
          <div className="h-2 rounded-full bg-cloud overflow-hidden">
            <div
              className={`h-full rounded-full origin-left animate-grow-x transition-colors ${hover === d.key ? 'bg-teal-600' : 'bg-teal-500'}`}
              style={{ width: `${(d.value / max) * 100}%`, animationDelay: `${i * 40}ms` }}
            />
          </div>
          {hover === d.key && d.detail && (
            <div className="absolute right-0 -top-8 z-10 px-2 py-1 rounded bg-ocean-900 text-white text-2xs shadow-panel whitespace-nowrap animate-fade-in pointer-events-none">
              {d.detail}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export interface DivergingDatum { key: string; label: string; value: number; display: string; tooltip: string }

export function DivergingBars({ data }: { data: DivergingDatum[] }) {
  const max = Math.max(1, ...data.map(d => Math.abs(d.value)));
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div>
      <div className="flex items-center gap-4 text-2xs text-slate mb-3">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-warning" />FDA above PDA</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-harbor-600" />FDA below PDA</span>
      </div>
      <ul className="space-y-1.5">
        {data.map((d, i) => {
          const w = (Math.abs(d.value) / max) * 50;
          return (
            <li key={d.key} className="relative grid grid-cols-[minmax(0,9rem)_1fr_5.5rem] items-center gap-2 text-xs"
              onMouseEnter={() => setHover(d.key)} onMouseLeave={() => setHover(null)}>
              <span className="truncate text-graphite" title={d.label}>{d.label}</span>
              <div className="relative h-4">
                <span className="absolute left-1/2 top-0 bottom-0 w-px bg-ocean-300" />
                {d.value !== 0 && (
                  <span
                    className={`absolute top-0.5 bottom-0.5 animate-grow-x ${d.value > 0 ? 'bg-warning rounded-r origin-left' : 'bg-harbor-600 rounded-l origin-right'} ${hover === d.key ? 'opacity-80' : ''}`}
                    style={{ width: `${Math.max(w, 0.8)}%`, left: d.value > 0 ? '50%' : `${50 - w}%`, animationDelay: `${i * 30}ms` }}
                  />
                )}
              </div>
              <span className={`text-right tabular font-medium ${d.value === 0 ? 'text-slate' : 'text-graphite'}`}>{d.display}</span>
              {hover === d.key && (
                <div className="absolute left-36 -top-7 z-10 px-2 py-1 rounded bg-ocean-900 text-white text-2xs shadow-panel whitespace-nowrap animate-fade-in pointer-events-none">
                  {d.tooltip}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Segmented status bar with legend + counts (identity never colour-only). */
export function SegmentBar({ segments }: { segments: { label: string; value: number; className: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px] bg-white">
        {segments.filter(s => s.value > 0).map(s => (
          <div key={s.label} className={`${s.className} h-full transition-all duration-500`} style={{ width: `${(s.value / total) * 100}%` }} title={`${s.label}: ${s.value}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
        {segments.map(s => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-xs text-slate">
            <span className={`w-2 h-2 rounded-sm ${s.className}`} />{s.label} <span className="text-graphite font-semibold tabular">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
