import { useMemo, useState } from 'react';
import { AlertTriangle, Search, X } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { activeWarnings } from '@/lib/selectors';
import { Card, EmptyState, PageHeader, Tabs } from '@/components/ui';
import WarningCard from '@/components/WarningCard';
import TaskList, { NewTaskButton } from '@/components/TaskList';
import type { TaskStatus } from '@/types';

export default function Operations() {
  const { state, route, navigate } = useDemoStore();
  const tab = route.id === 'warnings' ? 'warnings' : 'tasks';
  const [status, setStatus] = useState<TaskStatus | 'active' | 'all'>('active');
  const [owner, setOwner] = useState('all');
  const [vessel, setVessel] = useState('all');
  const [q, setQ] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const tasks = useMemo(() => state.tasks.filter(t =>
    (status === 'all' || (status === 'active' ? t.status !== 'Done' : t.status === status))
    && (owner === 'all' || t.assigneeId === owner)
    && (vessel === 'all' || t.portCallId === vessel)
    && (!q.trim() || `${t.title} ${t.description} ${t.vesselName}`.toLowerCase().includes(q.trim().toLowerCase()))), [state.tasks, status, owner, vessel, q]);

  const active = activeWarnings(state);
  const warnings = showResolved ? state.warnings : active;
  const filtered = status !== 'active' || owner !== 'all' || vessel !== 'all' || q;

  return (
    <>
      <PageHeader eyebrow="Operations desk" title="Operations & Tasks"
        subtitle="Early warnings and every husbandry, crew-change, document and transit request — each with an owner and a deadline."
        actions={<NewTaskButton />} />

      {active.some(w => w.severity === 'critical') && tab === 'tasks' && (
        <button onClick={() => navigate('operations', 'warnings')} className="w-full mb-4 flex items-center gap-3 px-4 py-3 rounded-lg border border-critical/30 bg-critical-light text-left hover:shadow-raise transition-shadow animate-fade-in">
          <AlertTriangle size={17} className="text-critical" />
          <span className="text-sm flex-1"><b>{active.filter(w => w.severity === 'critical').length} critical warning</b> — {active.find(w => w.severity === 'critical')!.title}</span>
          <span className="text-xs font-semibold text-critical-dark">Review</span>
        </button>
      )}

      <Tabs active={tab} onChange={k => navigate('operations', k === 'warnings' ? 'warnings' : undefined)} tabs={[
        { key: 'tasks', label: 'Tasks', count: state.tasks.filter(t => t.status !== 'Done').length },
        { key: 'warnings', label: 'Early warnings', count: active.length, tone: active.some(w => w.severity === 'critical') ? 'critical' : 'default' },
      ]} />

      <div key={tab} className="pt-5 animate-fade-in">
        {tab === 'tasks' ? (
          <Card>
            <div className="px-4 py-3 border-b border-line flex flex-wrap gap-2.5 items-center">
              <div className="relative flex-1 min-w-[12rem]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
                <input className="input pl-9" placeholder="Search tasks…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search tasks" />
              </div>
              <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value as typeof status)} aria-label="Status">
                <option value="active">Open & in progress</option><option value="Open">Open</option><option value="In Progress">In progress</option><option value="Done">Done</option><option value="all">All statuses</option>
              </select>
              <select className="input w-auto" value={owner} onChange={e => setOwner(e.target.value)} aria-label="Owner">
                <option value="all">All owners</option>{state.staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="input w-auto" value={vessel} onChange={e => setVessel(e.target.value)} aria-label="Vessel">
                <option value="all">All vessels</option>{state.portCalls.map(p => <option key={p.id} value={p.id}>{p.vesselName}</option>)}
              </select>
              {filtered && <button className="btn-ghost btn-sm" onClick={() => { setStatus('active'); setOwner('all'); setVessel('all'); setQ(''); }}><X size={13} />Clear</button>}
            </div>
            <TaskList tasks={tasks} emptyText="No tasks match these filters." />
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate">Raised by deterministic rules when a schedule changes. Each states why, and the cost in USD.</p>
              <label className="flex items-center gap-2 text-sm text-slate cursor-pointer"><input type="checkbox" className="accent-teal-600" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />Show resolved</label>
            </div>
            {warnings.length === 0
              ? <div className="card"><EmptyState icon={<AlertTriangle size={18} />} title="No active warnings">Change a berth time on a port call (e.g. MV Nile Trader +18 h) to see the early-warning rules at work.</EmptyState></div>
              : warnings.map(w => <WarningCard key={w.id} w={w} showVessel />)}
          </div>
        )}
      </div>
    </>
  );
}
