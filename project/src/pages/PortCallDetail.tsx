import { useState } from 'react';
import { AlertTriangle, ArrowLeft, Mail, Navigation, Ship, UserRound } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { activeWarnings, openTasks, pdaStatusOf, pdaTotalOf, vesselOf } from '@/lib/selectors';
import { Card, EmptyState, InfoRow, Note, Tabs } from '@/components/ui';
import { PDAStatusBadge, PortCallStatusBadge, TransitStatusBadge } from '@/components/StatusBadge';
import { ScheduleCard, ScheduleChangeModal } from '@/components/ScheduleChange';
import WarningCard from '@/components/WarningCard';
import TaskList, { NewTaskButton } from '@/components/TaskList';
import PdaEditor from '@/components/PdaEditor';
import ClientUpdateComposer from '@/components/ClientUpdateComposer';
import DocumentsCard from '@/components/DocumentsCard';
import { checkTransit } from '@/services/scheduleRules';
import { fmtLt, fmtTimestamp } from '@/lib/time';
import { num, usd } from '@/lib/format';

const SERVICE_LABEL: Record<string, string> = { 'full-agency': 'Full agency', 'suez-transit': 'Suez transit', husbandry: 'Husbandry', bunkering: 'Bunkering', 'crew-change': 'Crew change' };

export default function PortCallDetail() {
  const { state, route, navigate } = useDemoStore();
  const pc = state.portCalls.find(p => p.id === route.id);
  const [changeOpen, setChangeOpen] = useState(false);

  if (!pc) {
    return <div className="card"><EmptyState icon={<Ship size={18} />} title="Port call not found" action={<button className="btn-secondary" onClick={() => navigate('port-calls')}>Back to board</button>}>It may have been removed by a demo reset.</EmptyState></div>;
  }

  const vessel = vesselOf(state, pc);
  const charterer = state.companies.find(c => c.id === pc.chartererId);
  const warnings = state.warnings.filter(w => w.portCallId === pc.id);
  const active = activeWarnings(state, pc.id);
  const tasks = state.tasks.filter(t => t.portCallId === pc.id);
  const updates = state.clientUpdates.filter(u => u.portCallId === pc.id);
  const activity = state.activity.filter(a => a.portCallId === pc.id);
  const tab = route.tab ?? 'overview';
  const setTab = (t: string) => navigate('port-call-detail', pc.id, t);
  const total = pdaTotalOf(state, pc.id);
  const transit = pc.suez && pc.suez.passageHours > 0 && pc.status !== 'Completed' ? checkTransit(pc, pc.suez) : undefined;

  return (
    <>
      <button className="btn-ghost btn-sm -ml-2 mb-3" onClick={() => navigate('port-calls')}><ArrowLeft size={14} />Port Call Board</button>

      <div className="card px-5 py-4 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <span className="w-12 h-12 rounded-lg bg-ocean-900 text-teal-400 flex items-center justify-center shrink-0"><Ship size={22} /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold">{pc.vesselName}</h1>
                <PortCallStatusBadge status={pc.status} />
                {active.some(w => w.severity === 'critical') && <span className="badge bg-critical text-white"><AlertTriangle size={11} />Transit at risk</span>}
              </div>
              <p className="text-sm text-slate mt-0.5 truncate">{pc.ref} · {pc.port} · {pc.purpose}{pc.cargo ? ` · ${pc.cargoQty} ${pc.cargo}` : ''} · {pc.ownerName}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-secondary btn-sm" onClick={() => navigate('client-portal', pc.ownerId)}><UserRound size={13} />Owner view</button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line rounded-md overflow-hidden mt-4 border border-line">
          <Stat label="ETB" value={`${fmtLt(pc.etb)} LT`} alert={pc.etb !== pc.baseline.etb} />
          <Stat label="Suez convoy" value={pc.suez ? `${fmtLt(pc.suez.convoy)} LT` : '—'} alert={pc.suez?.status === 'At Risk'} />
          <Stat label="Open tasks" value={String(openTasks(state, pc.id).length)} />
          <Stat label={`PDA · ${pdaStatusOf(state, pc.id) === 'None' ? 'not drafted' : pdaStatusOf(state, pc.id).toLowerCase()}`} value={total !== undefined ? usd(total) : '—'} />
        </div>
      </div>

      <Tabs active={tab} onChange={setTab} tabs={[
        { key: 'overview', label: 'Overview' },
        { key: 'warnings', label: 'Warnings', count: active.length, tone: active.some(w => w.severity === 'critical') ? 'critical' : 'default' },
        { key: 'tasks', label: 'Tasks', count: openTasks(state, pc.id).length },
        { key: 'pda', label: 'PDA' },
        { key: 'updates', label: 'Owner updates', count: updates.filter(u => u.status === 'Draft').length },
        { key: 'activity', label: 'Activity' },
      ]} />

      <div key={tab} className="pt-5 animate-fade-in">
        {tab === 'overview' && (
          <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
            <div className="lg:col-span-2 space-y-4 sm:space-y-5">
              <ScheduleCard pc={pc} onChange={() => setChangeOpen(true)} />
              {active.filter(w => w.severity !== 'info').length > 0 && (
                <div className="space-y-3">{active.filter(w => w.severity !== 'info').map(w => <WarningCard key={w.id} w={w} />)}</div>
              )}
              <DocumentsCard pc={pc} />
              {pc.suez && (
                <Card title={<span className="flex items-center gap-2"><Navigation size={15} className="text-ocean-500" />Suez Canal transit</span>} actions={<TransitStatusBadge status={pc.suez.status} />} bodyClass="px-5 py-2">
                  <dl>
                    <InfoRow label="Direction / condition">{pc.suez.direction} · {pc.suez.condition}</InfoRow>
                    <InfoRow label="Convoy">{fmtLt(pc.suez.convoy, true)} LT{pc.suez.originalConvoy && <span className="text-slate"> (was {fmtLt(pc.suez.originalConvoy)})</span>}</InfoRow>
                    <InfoRow label="Cut-off at waiting area">{fmtLt(pc.suez.cutoff, true)} LT · {pc.suez.waitingArea}</InfoRow>
                    {pc.suez.passageHours > 0 && <InfoRow label="Passage from port">{pc.suez.passageHours} h (illustrative)</InfoRow>}
                    {transit && <InfoRow label="Estimated arrival at waiting area"><span className={transit.missed ? 'text-critical font-semibold' : ''}>{fmtLt(transit.arrival)} LT · {transit.missed ? `${Math.abs(transit.bufferHours)} h late` : `${transit.bufferHours} h buffer`}</span></InfoRow>}
                  </dl>
                </Card>
              )}
              <Note tone="info"><b>Next step:</b> {pc.nextStep}</Note>
            </div>
            <div className="space-y-4 sm:space-y-5">
              <Card title="Vessel" bodyClass="px-5 py-2">
                {vessel ? (
                  <dl>
                    <InfoRow label="IMO (sample)"><span className="font-mono">{vessel.imo}</span></InfoRow>
                    <InfoRow label="Type / flag">{vessel.type} · {vessel.flag}</InfoRow>
                    <InfoRow label="DWT">{num(vessel.dwt)} t</InfoRow>
                    <InfoRow label="GT / NRT">{num(vessel.gt)} / {num(vessel.nrt)}</InfoRow>
                    <InfoRow label="LOA">{vessel.loa} m</InfoRow>
                  </dl>
                ) : <p className="py-3 text-sm text-slate">No vessel record.</p>}
              </Card>
              <Card title="Parties & services" bodyClass="px-5 py-2">
                <dl>
                  <InfoRow label="Owner">{pc.ownerName}</InfoRow>
                  {charterer && <InfoRow label="Charterer">{charterer.name}</InfoRow>}
                  <InfoRow label="Services">{pc.services.map(s => SERVICE_LABEL[s]).join(', ')}</InfoRow>
                  <InfoRow label="Created">{pc.createdFrom === 'email' ? <span className="inline-flex items-center gap-1"><Mail size={12} />From nomination email</span> : 'Sample record'}</InfoRow>
                  <InfoRow label="PDA"><PDAStatusBadge status={pdaStatusOf(state, pc.id)} /></InfoRow>
                </dl>
              </Card>
            </div>
          </div>
        )}

        {tab === 'warnings' && (
          warnings.length === 0
            ? <div className="card"><EmptyState icon={<AlertTriangle size={18} />} title="No warnings for this call" action={pc.status !== 'Completed' && pc.status !== 'In Transit' ? <button className="btn-secondary" onClick={() => setChangeOpen(true)}>Change berth time</button> : undefined}>Warnings are raised by rules when the ETA or berth time changes — with the reason and cost impact.</EmptyState></div>
            : <div className="space-y-3">{[...warnings].sort((a, b) => (a.status === 'Resolved' ? 1 : 0) - (b.status === 'Resolved' ? 1 : 0)).map(w => <WarningCard key={w.id} w={w} />)}</div>
        )}

        {tab === 'tasks' && (
          <div className="card">
            <div className="card-header"><span className="card-title">Tasks for {pc.vesselName}</span><NewTaskButton defaultPortCallId={pc.id} /></div>
            <TaskList tasks={tasks} showVessel={false} emptyText="No tasks yet — process the crew-change and provisions emails in the inbox." />
          </div>
        )}

        {tab === 'pda' && <PdaEditor pc={pc} />}
        {tab === 'updates' && <ClientUpdateComposer pc={pc} />}

        {tab === 'activity' && (
          <div className="card">
            {activity.length === 0 ? <EmptyState title="No activity yet" /> : (
              <ol className="divide-y divide-line">
                {activity.map(a => (
                  <li key={a.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-2"><span className="text-sm font-medium">{a.action}</span><span className="text-2xs text-slate ml-auto">{a.user} · {fmtTimestamp(a.timestamp)}</span></div>
                    <p className="text-xs text-slate mt-0.5">{a.details}</p>
                    {a.changes && a.changes.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">{a.changes.map((c, i) => <li key={i} className="text-2xs font-mono text-graphite">{c.field}: <span className="text-slate line-through">{c.from}</span> → {c.to}</li>)}</ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>

      {changeOpen && <ScheduleChangeModal pc={pc} open onClose={() => setChangeOpen(false)} onApplied={() => setTab('overview')} />}
    </>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="bg-white px-4 py-2.5">
      <p className="eyebrow">{label}</p>
      <p className={`text-sm font-semibold tabular mt-0.5 ${alert ? 'text-critical' : 'text-graphite'}`}>{value}</p>
    </div>
  );
}
