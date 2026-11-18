import { Fragment, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Bell, Calendar, CheckSquare, FileText, Mail, Navigation, Search, Settings2, Ship, Wallet, X } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { Avatar, EmptyState, PageHeader } from '@/components/ui';
import { fmtTimestamp } from '@/lib/time';
import type { ActivityCategory } from '@/types';

const CAT: Record<ActivityCategory, { label: string; Icon: typeof Ship }> = {
  'port-call': { label: 'Port call', Icon: Ship },
  schedule: { label: 'Schedule', Icon: Calendar },
  pda: { label: 'PDA', Icon: FileText },
  task: { label: 'Task', Icon: CheckSquare },
  warning: { label: 'Warning', Icon: AlertTriangle },
  'client-update': { label: 'Client update', Icon: Bell },
  email: { label: 'Email', Icon: Mail },
  fda: { label: 'FDA', Icon: Wallet },
  transit: { label: 'Transit', Icon: Navigation },
  system: { label: 'System', Icon: Settings2 },
};

export default function ActivityLog() {
  const { state, navigate } = useDemoStore();
  const [cat, setCat] = useState<ActivityCategory | 'all'>('all');
  const [user, setUser] = useState('all');
  const [pcId, setPcId] = useState('all');
  const [q, setQ] = useState('');
  const users = Array.from(new Set(state.activity.map(a => a.user)));

  const list = useMemo(() => state.activity.filter(a =>
    (cat === 'all' || a.category === cat) && (user === 'all' || a.user === user) && (pcId === 'all' || a.portCallId === pcId)
    && (!q.trim() || `${a.action} ${a.details} ${a.entityLabel} ${a.changes?.map(c => `${c.field} ${c.from} ${c.to}`).join(' ') ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [state.activity, cat, user, pcId, q]);
  const filtered = cat !== 'all' || user !== 'all' || pcId !== 'all' || q;

  return (
    <>
      <PageHeader eyebrow="Audit trail" title="Activity Log" subtitle="Who changed what, and when — every port call, schedule, PDA, task, warning, client update and FDA action." />
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex flex-wrap gap-2.5 items-center">
          <div className="relative flex-1 min-w-[12rem]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
            <input className="input pl-9" placeholder="Search actions, details, changes…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search activity" />
          </div>
          <select className="input w-auto" value={cat} onChange={e => setCat(e.target.value as ActivityCategory | 'all')} aria-label="Type">
            <option value="all">All types</option>{Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="input w-auto" value={user} onChange={e => setUser(e.target.value)} aria-label="User">
            <option value="all">All users</option>{users.map(u => <option key={u}>{u}</option>)}
          </select>
          <select className="input w-auto" value={pcId} onChange={e => setPcId(e.target.value)} aria-label="Port call">
            <option value="all">All port calls</option>{state.portCalls.map(p => <option key={p.id} value={p.id}>{p.vesselName}</option>)}
          </select>
          {filtered && <button className="btn-ghost btn-sm" onClick={() => { setCat('all'); setUser('all'); setPcId('all'); setQ(''); }}><X size={13} />Clear</button>}
          <span className="text-xs text-slate ml-auto tabular">{list.length} events</span>
        </div>
        {list.length === 0 ? <EmptyState icon={<Activity size={18} />} title="No events match" /> : (
          <ol className="divide-y divide-line">
            {list.map(a => {
              const { label, Icon } = CAT[a.category];
              const staff = state.staff.find(s => s.id === a.userId);
              return (
                <li key={a.id} className="px-5 py-3.5 flex gap-3.5 hover:bg-cloud/40 transition-colors">
                  <span className="w-8 h-8 rounded-md bg-cloud border border-line flex items-center justify-center text-ocean-600 shrink-0"><Icon size={15} /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-sm font-semibold">{a.action}</span>
                      {a.portCallId ? <button className="text-sm text-harbor-600 hover:underline" onClick={() => navigate('port-call-detail', a.portCallId)}>{a.entityLabel}</button> : <span className="text-sm text-slate">{a.entityLabel}</span>}
                      <span className="badge bg-cloud text-slate border border-line">{label}</span>
                    </div>
                    <p className="text-xs text-slate mt-0.5">{a.details}</p>
                    {a.changes && a.changes.length > 0 && (
                      <div className="mt-1.5 inline-grid grid-cols-[auto_auto_auto_auto] gap-x-2 gap-y-0.5 text-2xs font-mono rounded bg-cloud/70 px-2.5 py-1.5">
                        {a.changes.map((c, i) => <Fragment key={i}><span className="text-slate">{c.field}</span><span className="line-through text-slate">{c.from}</span><span className="text-slate">→</span><span className="text-graphite">{c.to}</span></Fragment>)}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1.5 justify-end">{staff && <Avatar initials={staff.initials} size={20} />}<span className="text-xs text-graphite">{a.user}</span></div>
                    <p className="text-2xs text-slate mt-0.5 tabular">{fmtTimestamp(a.timestamp)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </>
  );
}
