import { AlertTriangle, ArrowRight, CheckCircle2, CheckSquare, Circle, DollarSign, Mail, PlayCircle, Ship } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { activeWarnings, nileTrader, openTasks, pdaTotalOf } from '@/lib/selectors';
import { Card, PageHeader } from '@/components/ui';
import { BarList, SegmentBar } from '@/components/Charts';
import { SeverityBadge } from '@/components/StatusBadge';
import { fmtTimestamp } from '@/lib/time';
import { usd, usdCompact } from '@/lib/format';
import type { PortName } from '@/types';

export default function Overview() {
  const { state, navigate } = useDemoStore();
  const nile = nileTrader(state);
  const active = state.portCalls.filter(p => p.status !== 'Completed');
  const tasks = openTasks(state);
  const warnings = activeWarnings(state).filter(w => w.severity !== 'info');
  const approvedTotal = state.portCalls.reduce((s, p) => s + (state.pdas[p.id] && state.pdas[p.id].status !== 'Draft' ? pdaTotalOf(state, p.id) ?? 0 : 0), 0);
  const newEmails = state.emails.filter(e => e.status === 'New').length;

  const email = (id: string) => state.emails.find(e => e.id === id)?.status === 'Processed';
  const nileId = nile?.id;
  const steps: { time: string; label: string; say: string; done: boolean; go: () => void }[] = [
    { time: '0:00', label: 'Port call board', say: 'This is sample data. Every desk works from this one live picture.', done: !!nile, go: () => navigate('port-calls') },
    { time: '1:00', label: 'Nomination email becomes a port call', say: 'No retyping. The email becomes a port call.', done: email('em-nomination'), go: () => navigate('email-inbox', 'em-nomination') },
    { time: '2:30', label: 'PDA draft, edit one line, approve', say: 'AI drafts from your tariffs and past calls. Your D/A team approves.', done: !!nileId && ['Approved', 'Sent'].includes(state.pdas[nileId]?.status ?? ''), go: () => nileId ? navigate('port-call-detail', nileId, 'pda') : navigate('disbursement') },
    { time: '4:30', label: 'Crew change and provisions tasks', say: 'Every request is tracked, with an owner and a deadline.', done: email('em-crew') && email('em-provisions'), go: () => navigate('email-inbox', 'em-crew') },
    { time: '5:30', label: 'Trigger the 18 h berthing delay', say: 'Ops sees the transit risk and extra cost before the owner calls.', done: !!nile && nile.etb !== nile.baseline.etb, go: () => nileId ? navigate('port-call-detail', nileId, 'overview') : navigate('port-calls') },
    { time: '7:00', label: 'Draft and send the owner update', say: 'One click to an accurate update.', done: state.clientUpdates.some(u => u.portCallId === nileId && u.status === 'Sent'), go: () => nileId ? navigate('port-call-detail', nileId, 'updates') : navigate('port-calls') },
    { time: '8:00', label: 'Client view', say: 'The transparency you already promise owners, live.', done: !!nileId && !!state.fdas[nileId], go: () => navigate('client-portal', 'own-thalassa') },
    { time: '9:00', label: 'PDA vs FDA comparison', say: 'Every difference explained, so fewer disputes.', done: !!nileId && !!state.fdas[nileId]?.reconciledAt, go: () => navigate('pda-vs-fda', nileId) },
  ];
  const doneCount = steps.filter(s => s.done).length;

  const ports: PortName[] = ['Alexandria', 'Damietta', 'Port Said', 'Dubai'];
  const byPort = ports.map(p => {
    const calls = active.filter(c => c.port === p);
    const total = calls.reduce((s, c) => s + (pdaTotalOf(state, c.id) ?? 0), 0);
    return { key: p, label: `${p} · ${calls.length} call${calls.length === 1 ? '' : 's'}`, value: total, display: usdCompact(total), detail: `${usd(total)} PDA value (illustrative)` };
  });
  const taskSeg = [
    { label: 'Open', value: state.tasks.filter(t => t.status === 'Open').length, className: 'bg-ocean-400' },
    { label: 'In progress', value: state.tasks.filter(t => t.status === 'In Progress').length, className: 'bg-harbor-600' },
    { label: 'Done', value: state.tasks.filter(t => t.status === 'Done').length, className: 'bg-teal-500' },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Wednesday 18 November 2026"
        title="Operations overview"
        subtitle="Port calls, Suez transits, husbandry requests and disbursement accounts across Egypt and the UAE — one live picture for every desk."
       
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <Kpi icon={<Ship size={17} />} label="Active port calls" value={String(active.length)} sub="Alexandria · Damietta · Port Said · Dubai" onClick={() => navigate('port-calls')} />
        <Kpi icon={<CheckSquare size={17} />} label="Open tasks" value={String(tasks.length)} sub={`${tasks.filter(t => t.priority === 'High').length} high priority`} onClick={() => navigate('operations')} />
        <Kpi icon={<AlertTriangle size={17} />} label="Active warnings" value={String(warnings.length)} sub={warnings.length ? 'Needs attention' : 'All clear'} tone={warnings.length ? 'critical' : undefined} onClick={() => navigate('operations')} />
        <Kpi icon={<DollarSign size={17} />} label="Approved PDA value" value={usdCompact(approvedTotal)} sub="Illustrative USD" onClick={() => navigate('disbursement')} />
      </div>

      {newEmails > 0 && (
        <button onClick={() => navigate('email-inbox')} className="w-full card px-5 py-3 mb-5 flex items-center gap-3 text-left hover:border-teal-400 hover:shadow-raise transition-all group">
          <span className="w-8 h-8 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center"><Mail size={15} /></span>
          <span className="flex-1 text-sm"><b>{newEmails} new email{newEmails === 1 ? '' : 's'}</b> in the agency inbox <span className="text-slate">— nomination, husbandry requests or owner questions waiting to be processed.</span></span>
          <ArrowRight size={16} className="text-slate group-hover:text-teal-600 group-hover:translate-x-0.5 transition-all" />
        </button>
      )}

      <div className="grid lg:grid-cols-5 gap-4 sm:gap-5">
        <Card className="lg:col-span-3" title={<span className="flex items-center gap-2"><PlayCircle size={16} className="text-teal-500" />10-minute demo run of show</span>}
          subtitle="Follows MV Nile Trader from nomination to FDA. Click a step to jump there."
          actions={<span className="text-xs text-slate tabular">{doneCount}/{steps.length}</span>}>
          <div className="h-1 bg-cloud"><div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
          <ol className="divide-y divide-line">
            {steps.map(s => (
              <li key={s.time}>
                <button onClick={s.go} className="w-full flex items-start gap-3.5 px-5 py-3 text-left hover:bg-harbor-50/60 transition-colors group">
                  <span className="font-mono text-xs text-slate w-9 pt-0.5 shrink-0">{s.time}</span>
                  {s.done ? <CheckCircle2 size={17} className="text-teal-500 shrink-0 mt-px" /> : <Circle size={17} className="text-ocean-300 shrink-0 mt-px" />}
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-medium ${s.done ? 'text-slate' : 'text-graphite'}`}>{s.label}</span>
                    <span className="block text-xs text-slate italic mt-0.5">“{s.say}”</span>
                  </span>
                  <ArrowRight size={15} className="text-ocean-300 group-hover:text-harbor-600 group-hover:translate-x-0.5 transition-all mt-0.5 shrink-0" />
                </button>
              </li>
            ))}
            <li className="px-5 py-3 flex items-start gap-3.5 bg-cloud/50">
              <span className="font-mono text-xs text-slate w-9 pt-0.5">10:00</span>
              <span className="text-sm text-graphite">Stop and ask: <i>“Which of these would help your desks most?”</i></span>
            </li>
          </ol>
        </Card>

        <div className="lg:col-span-2 space-y-4 sm:space-y-5">
          <Card title="PDA value by port" subtitle="Active calls · illustrative USD" bodyClass="p-5">
            <BarList data={byPort} />
          </Card>
          <Card title="Husbandry & operations tasks" bodyClass="p-5">
            <SegmentBar segments={taskSeg} />
          </Card>
          <Card title="Active warnings" actions={<button className="btn-ghost btn-sm" onClick={() => navigate('operations')}>View all</button>}>
            {warnings.length === 0 ? <p className="px-5 py-5 text-sm text-slate">No active warnings. Warnings appear when an ETA or berth time changes.</p> : (
              <ul className="divide-y divide-line">
                {warnings.slice(0, 3).map(w => (
                  <li key={w.id}><button onClick={() => navigate('port-call-detail', w.portCallId, 'warnings')} className="w-full text-left px-5 py-3 hover:bg-cloud/60 transition-colors">
                    <div className="flex items-center gap-2 mb-0.5"><SeverityBadge severity={w.severity} /><span className="text-2xs text-slate">{w.vesselName}</span></div>
                    <p className="text-sm">{w.title}</p>
                  </button></li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card className="mt-5" title="Recent activity" actions={<button className="btn-ghost btn-sm" onClick={() => navigate('activity-log')}>Full log</button>}>
        <ul className="divide-y divide-line">
          {state.activity.slice(0, 6).map(a => (
            <li key={a.id} className="px-5 py-2.5 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium">{a.action}</span>
              <span className="text-slate">· {a.entityLabel}</span>
              <span className="ml-auto text-2xs text-slate">{a.user} · {fmtTimestamp(a.timestamp)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Kpi({ icon, label, value, sub, onClick, tone }: { icon: React.ReactNode; label: string; value: string; sub: string; onClick: () => void; tone?: 'critical' }) {
  return (
    <button onClick={onClick} className="card px-4 py-4 text-left hover:shadow-raise hover:border-ocean-300 transition-all group">
      <div className="flex items-center justify-between">
        <span className={`w-8 h-8 rounded-md flex items-center justify-center ${tone === 'critical' ? 'bg-critical-light text-critical' : 'bg-cloud text-ocean-600'}`}>{icon}</span>
        <ArrowRight size={14} className="text-ocean-300 group-hover:text-harbor-600 transition-colors" />
      </div>
      <p className="text-2xl font-bold font-display tabular mt-3 leading-none">{value}</p>
      <p className="text-sm font-medium text-graphite mt-1.5">{label}</p>
      <p className="text-2xs text-slate mt-0.5 truncate">{sub}</p>
    </button>
  );
}
