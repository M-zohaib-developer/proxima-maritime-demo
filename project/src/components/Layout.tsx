import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Check, ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import { useDemoStore, type PageKey } from '@/lib/demoStore';
import { activeWarnings, unackWarnings } from '@/lib/selectors';
import { fmtTimestamp } from '@/lib/time';
import Sidebar from '@/components/Sidebar';
import { Avatar, SampleTag } from '@/components/ui';
import { SeverityBadge } from '@/components/StatusBadge';

const SIDEBAR_KEY = 'proxima-sidebar-collapsed';

export const PAGE_LABELS: Record<PageKey, string> = {
  'overview': 'Overview',
  'port-calls': 'Port Call Board',
  'port-call-detail': 'Port Call',
  'vessels': 'Vessels',
  'email-inbox': 'Email Inbox',
  'operations': 'Operations & Tasks',
  'suez': 'Suez Transit',
  'disbursement': 'Disbursement Accounts',
  'pda-vs-fda': 'PDA vs FDA',
  'client-portal': 'Client Portal',
  'activity-log': 'Activity Log',
  'settings': 'Settings',
};

function useOutside(ref: React.RefObject<HTMLElement>, close: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [ref, close, active]);
}

function Notifications() {
  const { state, navigate } = useDemoStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false), open);
  const warnings = activeWarnings(state);
  const unread = unackWarnings(state).length;
  const recent = state.activity.slice(0, 5);
  return (
    <div className="relative" ref={ref}>
      <button className="btn-icon relative" onClick={() => setOpen(o => !o)} aria-label="Notifications" aria-expanded={open}>
        <Bell size={18} />
        {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-critical animate-pulse-ring" />}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] card shadow-panel animate-drop-in origin-top-right z-40 overflow-hidden">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between">
            <p className="text-sm font-semibold">Notifications</p>
            <span className="text-2xs text-slate">{warnings.length} active warning{warnings.length === 1 ? '' : 's'}</span>
          </div>
          <div className="max-h-96 overflow-y-auto scrollbar-thin">
            {warnings.length === 0 && <p className="px-4 py-4 text-sm text-slate">No active warnings.</p>}
            {warnings.map(w => (
              <button key={w.id} onClick={() => { navigate('port-call-detail', w.portCallId, 'warnings'); setOpen(false); }}
                className="w-full text-left px-4 py-3 border-b border-line hover:bg-cloud/70 transition-colors">
                <div className="flex items-center gap-2 mb-1"><SeverityBadge severity={w.severity} /><span className="text-2xs text-slate">{w.vesselName}</span></div>
                <p className="text-sm text-graphite leading-snug">{w.title}</p>
              </button>
            ))}
            <p className="px-4 pt-3 pb-1 eyebrow">Recent activity</p>
            {recent.map(a => (
              <div key={a.id} className="px-4 py-2 text-xs">
                <span className="font-medium text-graphite">{a.action}</span> <span className="text-slate">· {a.entityLabel} · {a.user} · {fmtTimestamp(a.timestamp)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => { navigate('activity-log'); setOpen(false); }} className="w-full px-4 py-2.5 text-xs font-semibold text-harbor-600 hover:bg-harbor-50 border-t border-line">
            Open activity log
          </button>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { state, user, dispatch } = useDemoStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false), open);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 pl-1.5 pr-2 h-10 rounded-md hover:bg-cloud transition-colors" aria-expanded={open} aria-label="Switch user">
        <Avatar initials={user.initials} tone={user.desk === 'D/A' ? 'teal' : 'ocean'} />
        <span className="hidden md:block text-left leading-tight">
          <span className="block text-[13px] font-semibold text-graphite">{user.name}</span>
          <span className="block text-2xs text-slate">{user.title}</span>
        </span>
        <ChevronDown size={14} className="text-slate hidden md:block" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 card shadow-panel animate-drop-in z-40 py-1">
          <p className="px-3.5 pt-2 pb-1.5 eyebrow">Work as (demo users)</p>
          {state.staff.map(s => (
            <button key={s.id} onClick={() => { dispatch({ type: 'SET_USER', userId: s.id }); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-cloud transition-colors">
              <Avatar initials={s.initials} size={26} tone={s.desk === 'D/A' ? 'teal' : 'ocean'} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-graphite">{s.name}</span>
                <span className="block text-2xs text-slate truncate">{s.title} · {s.office}</span>
              </span>
              {s.id === user.id && <Check size={15} className="text-teal-500" />}
            </button>
          ))}
          <p className="px-3.5 py-2 text-2xs text-slate border-t border-line mt-1">Only the D/A desk can approve PDAs.</p>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { route, navigate, state } = useDemoStore();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
  });
  const toggleSidebar = useCallback(() => setCollapsed(c => {
    try { localStorage.setItem(SIDEBAR_KEY, c ? '0' : '1'); } catch { /* per-viewer preference only */ }
    return !c;
  }), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b' && !(e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]'))) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleSidebar]);
  const main = useRef<HTMLElement>(null);
  const pc = route.page === 'port-call-detail' ? state.portCalls.find(p => p.id === route.id) : undefined;
  const crit = unackWarnings(state).filter(w => w.severity === 'critical').length;

  useEffect(() => { main.current?.scrollTo({ top: 0 }); }, [route.page, route.id]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-cloud">
      <div className="hidden lg:flex"><Sidebar collapsed={collapsed} onToggle={toggleSidebar} /></div>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-ocean-950/50 animate-fade-in" onClick={() => setDrawer(false)} />
          <div className="relative animate-slide-in-left h-full">
            <Sidebar onNavigate={() => setDrawer(false)} />
            <button onClick={() => setDrawer(false)} className="absolute top-4 -right-11 btn-icon bg-white" aria-label="Close menu"><X size={18} /></button>
          </div>
        </div>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <header className="h-16 bg-white/95 backdrop-blur border-b border-line px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <button className="btn-icon lg:hidden -ml-2" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu size={19} /></button>
            <nav className="flex items-center gap-1.5 text-sm min-w-0" aria-label="Breadcrumb">
              <button className="text-slate hover:text-graphite transition-colors hidden sm:block" onClick={() => navigate('overview')}>Proxima</button>
              <ChevronRight size={14} className="text-ocean-300 hidden sm:block" />
              {pc ? (
                <>
                  <button className="text-slate hover:text-graphite transition-colors hidden sm:block" onClick={() => navigate('port-calls')}>Port Call Board</button>
                  <ChevronRight size={14} className="text-ocean-300 hidden sm:block" />
                  <span className="font-semibold text-graphite truncate">{pc.vesselName}</span>
                </>
              ) : (
                <span className="font-semibold text-graphite truncate">{PAGE_LABELS[route.page]}</span>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <SampleTag className="max-sm:px-1.5 max-sm:[&>svg]:hidden" />
            {crit > 0 && (
              <button onClick={() => navigate('operations')} className="badge h-7 px-2.5 bg-critical-light text-critical-dark border border-critical/25 hover:bg-critical/15 transition-colors animate-fade-in">
                <AlertTriangle size={12} /> {crit} critical
              </button>
            )}
            <Notifications />
            <span className="w-px h-6 bg-line mx-1 hidden sm:block" />
            <UserMenu />
          </div>
        </header>

        <main ref={main} className="flex-1 overflow-y-auto scrollbar-thin">
          <div key={`${route.page}:${route.id ?? ''}`} className="max-w-[1320px] mx-auto px-4 sm:px-6 py-6 animate-fade-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
