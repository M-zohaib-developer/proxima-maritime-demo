import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileSearch, Info, Sparkles, FlaskConical } from 'lucide-react';

export function PageHeader({ eyebrow, title, subtitle, actions }: {
  eyebrow?: string; title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="text-[1.35rem] font-bold leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-slate mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className = '', bodyClass = '', id }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode;
  children: React.ReactNode; className?: string; bodyClass?: string; id?: string;
}) {
  return (
    <section id={id} className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-header">
          <div className="min-w-0">
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="text-xs text-slate mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, children, action }: {
  icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-12 animate-fade-in">
      <div className="w-11 h-11 rounded-full bg-cloud border border-line flex items-center justify-center text-ocean-500 mb-3">
        {icon ?? <FileSearch size={18} />}
      </div>
      <p className="text-sm font-semibold text-graphite">{title}</p>
      {children && <p className="text-sm text-slate mt-1 max-w-sm">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-5 space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

export interface TabDef { key: string; label: string; count?: number; tone?: 'critical' | 'default' }

export function Tabs({ tabs, active, onChange }: { tabs: TabDef[]; active: string; onChange: (k: string) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [ink, setInk] = useState({ left: 0, width: 0 });
  useEffect(() => {
    const el = refs.current[active];
    if (el) setInk({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active, tabs.length]);
  return (
    <div className="relative border-b border-line overflow-x-auto scrollbar-thin" role="tablist">
      <div className="flex gap-1 min-w-max">
        {tabs.map(t => (
          <button
            key={t.key}
            ref={el => { refs.current[t.key] = el; }}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
            className={`relative h-10 px-3 text-sm font-medium transition-colors ${active === t.key ? 'text-graphite' : 'text-slate hover:text-graphite'}`}
          >
            <span className="inline-flex items-center gap-1.5">
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`badge h-[18px] px-1.5 ${t.tone === 'critical' ? 'bg-critical text-white' : 'bg-cloud text-slate border border-line'}`}>{t.count}</span>
              )}
            </span>
          </button>
        ))}
      </div>
      <span className="absolute bottom-0 h-0.5 bg-teal-500 rounded-full transition-all duration-200" style={{ left: ink.left, width: ink.width }} />
    </div>
  );
}

/** Honest label for every simulated-AI step. */
export function SimBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`badge bg-teal-50 text-teal-700 border border-teal-100 ${className}`} title="Deterministic simulation on sample data — no AI model or API is called">
      <Sparkles size={11} /> Simulated AI
    </span>
  );
}

export function SampleTag({ className = '', label = 'Sample data' }: { className?: string; label?: string }) {
  return (
    <span className={`badge bg-warning-light text-warning-dark border border-warning/25 uppercase tracking-wider ${className}`}>
      <FlaskConical size={11} /> {label}
    </span>
  );
}

export function Field({ label, error, hint, children, htmlFor, evidence }: {
  label: string; error?: string; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string; evidence?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="text-xs text-critical mt-1" role="alert">{error}</p>
        : evidence ? <p className="text-2xs text-slate mt-1 font-mono truncate" title={evidence}>↳ {evidence}</p>
        : hint ? <p className="text-xs text-slate mt-1">{hint}</p> : null}
    </div>
  );
}

export function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-line last:border-0">
      <dt className="text-xs text-slate shrink-0">{label}</dt>
      <dd className="text-sm text-graphite text-right min-w-0">{children}</dd>
    </div>
  );
}

export function Note({ children, tone = 'info', icon }: { children: React.ReactNode; tone?: 'info' | 'warning' | 'critical' | 'success'; icon?: React.ReactNode }) {
  const t = {
    info: 'bg-info-light border-info/20 text-graphite',
    warning: 'bg-warning-light border-warning/30 text-graphite',
    critical: 'bg-critical-light border-critical/25 text-graphite',
    success: 'bg-success-light border-success/25 text-graphite',
  }[tone];
  const ic = { info: 'text-info', warning: 'text-warning-dark', critical: 'text-critical', success: 'text-success' }[tone];
  return (
    <div className={`flex gap-2.5 rounded border px-3.5 py-2.5 text-sm ${t}`}>
      <span className={`mt-0.5 shrink-0 ${ic}`}>{icon ?? <Info size={15} />}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Avatar({ initials, size = 28, tone = 'ocean' }: { initials: string; size?: number; tone?: 'ocean' | 'teal' }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0 ${tone === 'teal' ? 'bg-teal-600' : 'bg-ocean-700'}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

export function Collapsible({ title, children, defaultOpen = false, meta }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; meta?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-line rounded">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-medium text-graphite hover:bg-cloud/60 transition-colors" aria-expanded={open}>
        <span className="flex items-center gap-2 min-w-0">{title}</span>
        <span className="flex items-center gap-2 text-slate">{meta}<ChevronDown size={15} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} /></span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden"><div className="px-3.5 pb-3 pt-1 border-t border-line">{children}</div></div>
      </div>
    </div>
  );
}

/** Small async helper: run a simulated step with a visible processing state. */
export function useBusy() {
  const [busy, setBusy] = useState<string | null>(null);
  async function run<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(key);
    try { return await fn(); } finally { setBusy(null); }
  }
  return { busy, run };
}
