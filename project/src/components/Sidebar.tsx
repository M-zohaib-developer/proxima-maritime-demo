import { useState } from 'react';
import {
  Activity, Anchor, BarChart3, CheckSquare, FileText, LayoutDashboard, Mail,
  Navigation, RotateCcw, Settings, Ship, UserRound, Waves,
} from 'lucide-react';
import { useDemoStore, type PageKey } from '@/lib/demoStore';
import { activeWarnings } from '@/lib/selectors';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/Modal';

const GROUPS: { label: string; items: { key: PageKey; label: string; Icon: typeof Ship }[] }[] = [
  { label: 'Operations', items: [
    { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { key: 'port-calls', label: 'Port Call Board', Icon: Ship },
    { key: 'vessels', label: 'Vessels', Icon: Anchor },
    { key: 'email-inbox', label: 'Email Inbox', Icon: Mail },
    { key: 'operations', label: 'Operations & Tasks', Icon: CheckSquare },
    { key: 'suez', label: 'Suez Transit', Icon: Navigation },
  ] },
  { label: 'Finance', items: [
    { key: 'disbursement', label: 'Disbursement Accounts', Icon: FileText },
    { key: 'pda-vs-fda', label: 'PDA vs FDA', Icon: BarChart3 },
  ] },
  { label: 'Owners', items: [
    { key: 'client-portal', label: 'Client Portal', Icon: UserRound },
  ] },
  { label: 'System', items: [
    { key: 'activity-log', label: 'Activity Log', Icon: Activity },
    { key: 'settings', label: 'Settings', Icon: Settings },
  ] },
];

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { state, route, navigate, resetDemo } = useDemoStore();
  const { showToast } = useToast();
  const [confirm, setConfirm] = useState(false);

  const badges: Partial<Record<PageKey, { n: number; critical?: boolean }>> = {
    'email-inbox': { n: state.emails.filter(e => e.status === 'New').length },
    operations: { n: activeWarnings(state).filter(w => w.severity !== 'info').length, critical: true },
    suez: { n: state.portCalls.filter(p => p.suez?.status === 'At Risk').length, critical: true },
  };

  return (
    <aside className="flex flex-col h-full bg-ocean-900 w-64 shrink-0 select-none text-ocean-400">
      <div className="px-5 h-16 flex items-center gap-3 border-b border-white/5">
        <div className="w-8 h-8 rounded-md bg-teal-500 flex items-center justify-center shrink-0 shadow-[inset_0_-2px_0_rgba(0,0,0,.15)]">
          <Waves size={17} className="text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-white font-display font-bold text-[15px] tracking-tight">Proxima</p>
          <p className="text-2xs text-ocean-400 tracking-wide">Ship Service</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-dark px-3 py-3 space-y-4" aria-label="Main">
        {GROUPS.map(g => (
          <div key={g.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ocean-500">{g.label}</p>
            <ul className="space-y-0.5">
              {g.items.map(({ key, label, Icon }) => {
                const active = route.page === key || (key === 'port-calls' && route.page === 'port-call-detail');
                const b = badges[key];
                return (
                  <li key={key}>
                    <button
                      onClick={() => { navigate(key); onNavigate?.(); }}
                      aria-current={active ? 'page' : undefined}
                      className={`relative w-full flex items-center gap-3 h-9 px-3 rounded-md text-[13.5px] font-medium transition-colors duration-150
                        ${active ? 'bg-white/[0.07] text-white' : 'hover:bg-white/[0.04] hover:text-white'}`}
                    >
                      <span className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-teal-400 transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`} />
                      <Icon size={16} className={active ? 'text-teal-400' : ''} />
                      <span className="flex-1 text-left">{label}</span>
                      {b && b.n > 0 && (
                        <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${b.critical ? 'bg-critical text-white' : 'bg-teal-500 text-white'}`}>{b.n}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-white/5 space-y-2">
        <div className="rounded-md bg-warning/10 border border-warning/20 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-warning">Sample data</p>
          <p className="text-2xs text-ocean-400 leading-snug mt-0.5">Fictional vessels, owners and illustrative USD tariffs.</p>
        </div>
        <button
          onClick={() => setConfirm(true)}
          className="w-full flex items-center justify-center gap-2 h-9 rounded-md border border-white/10 text-ocean-300 hover:text-white hover:border-teal-400/60 hover:bg-teal-500/10 text-sm font-medium transition-colors"
        >
          <RotateCcw size={14} /> Reset demo
        </button>
      </div>

      <ConfirmDialog
        open={confirm} onClose={() => setConfirm(false)} title="Reset the demo?" confirmLabel="Reset demo" tone="danger"
        onConfirm={() => { resetDemo(); navigate('overview'); onNavigate?.(); showToast('success', 'Demo reset', 'Original sample data and scenario restored.'); }}
      >
        <p>This restores every sample record and scenario state to the start of the 10-minute run of show.</p>
        <p className="text-slate">Port calls, PDAs, tasks, warnings, client updates and the activity log created during the demo are cleared.</p>
      </ConfirmDialog>
    </aside>
  );
}
