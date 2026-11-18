// Read-only owner portal. It renders ONLY what getOwnerPortal() returns for the
// signed-in owner — never the operator state — so other owners' vessels, drafts,
// internal tasks and warnings cannot appear here.
import { useMemo } from 'react';
import { ArrowLeft, Check, Clock, Eye, FileText, Lock, MapPin, Navigation, Ship, Waves } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { getOwnerPortal, type OwnerCallView } from '@/services/clientPortal';
import { Collapsible, EmptyState, SampleTag } from '@/components/ui';
import { PortCallStatusBadge } from '@/components/StatusBadge';
import { fmtHoursDelta, fmtLt, fmtTimestamp, hoursBetween } from '@/lib/time';
import { num, usd, usdDelta } from '@/lib/format';

export default function ClientPortal() {
  const { state, route, navigate } = useDemoStore();
  const owners = state.companies.filter(c => c.kind === 'owner');
  const ownerId = owners.some(o => o.id === route.id) ? route.id! : 'own-thalassa';
  const portal = useMemo(() => getOwnerPortal(state, ownerId), [state, ownerId]);

  return (
    <div className="min-h-[100dvh] bg-cloud">
      <div className="bg-ocean-900 text-ocean-300 text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-10 flex items-center gap-3">
          <Eye size={13} className="text-teal-400" />
          <span className="truncate">Demo: owner’s view. Switch owner to check isolation.</span>
          <select className="ml-auto bg-ocean-800 border border-white/10 rounded h-7 px-2 text-xs text-white" value={ownerId} onChange={e => navigate('client-portal', e.target.value)} aria-label="View as owner">
            {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-white/10 hover:bg-white/5 text-white whitespace-nowrap" onClick={() => navigate('port-calls')}>
            <ArrowLeft size={13} /><span className="hidden sm:inline">Operator console</span>
          </button>
        </div>
      </div>

      <header className="bg-white border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-md bg-ocean-900 flex items-center justify-center"><Waves size={18} className="text-teal-400" /></span>
            <div className="leading-tight">
              <p className="font-display font-bold text-graphite">Proxima Owner Portal</p>
              <p className="text-2xs text-slate">Live vessel status and costs · read-only</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SampleTag />
            <span className="badge bg-cloud text-slate border border-line"><Lock size={10} />Read-only</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 animate-fade-up" key={ownerId}>
        {!portal ? <div className="card"><EmptyState title="No access">This account is not an owner.</EmptyState></div> : (
          <>
            <div className="mb-5">
              <p className="eyebrow">Signed in as</p>
              <h1 className="text-xl font-bold">{portal.owner.name}</h1>
              <p className="text-sm text-slate">{portal.owner.contact} · {portal.owner.city}, {portal.owner.country} · {portal.calls.length} vessel{portal.calls.length === 1 ? '' : 's'} with Proxima</p>
            </div>
            {portal.calls.length === 0
              ? <div className="card"><EmptyState icon={<Ship size={18} />} title="No active port calls">Your vessels will appear here once Proxima accepts a nomination.</EmptyState></div>
              : <div className="space-y-6">{portal.calls.map(c => <CallView key={c.id} c={c} />)}</div>}
          </>
        )}
        <p className="text-2xs text-slate mt-8 text-center">Fictional sample data. Amounts are illustrative USD estimates, not official tariffs. Figures shown are approved by Proxima before they appear here.</p>
      </main>
    </div>
  );
}

function CallView({ c }: { c: OwnerCallView }) {
  const delay = hoursBetween(c.baseline.etb, c.schedule.etb);
  const latest = c.updates[0];
  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-line flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 rounded-lg bg-cloud border border-line flex items-center justify-center text-ocean-600"><Ship size={20} /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold">{c.vesselName}</h2>
              <PortCallStatusBadge status={c.status} />
              {c.statusNote && <span className="badge bg-warning-light text-warning-dark">{c.statusNote}</span>}
            </div>
            <p className="text-sm text-slate truncate"><MapPin size={12} className="inline -mt-0.5" /> {c.port} · {c.purpose}{c.cargo ? ` · ${c.cargo}` : ''} · ref {c.ref}</p>
          </div>
        </div>
        <p className="text-2xs text-slate">{c.vesselType} · {c.flag} · {num(c.dwt)} dwt · IMO-style {c.imo}</p>
      </div>

      <div className="grid lg:grid-cols-3">
        <div className="lg:col-span-2 p-5 border-b lg:border-b-0 lg:border-r border-line">
          <p className="eyebrow mb-3">Timeline (local time)</p>
          <ol className="relative">
            {c.timeline.map((t, i) => (
              <li key={t.key} className="flex gap-3 pb-4 last:pb-0 relative">
                {i < c.timeline.length - 1 && <span className={`absolute left-[11px] top-6 bottom-0 w-px ${t.state === 'done' ? 'bg-teal-400' : 'bg-line'}`} />}
                <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${t.state === 'done' ? 'bg-teal-500 border-teal-500 text-white' : t.state === 'current' ? 'bg-white border-harbor-600 text-harbor-600' : 'bg-white border-line text-ocean-300'}`}>
                  {t.state === 'done' ? <Check size={12} /> : t.state === 'current' ? <span className="w-2 h-2 rounded-full bg-harbor-600 animate-pulse" /> : <Clock size={11} />}
                </span>
                <div className="min-w-0 -mt-0.5">
                  <p className={`text-sm font-medium ${t.state === 'upcoming' ? 'text-slate' : 'text-graphite'}`}>{t.label}</p>
                  {t.at && (
                    <p className="text-sm tabular">
                      {fmtLt(t.at, true)}
                      {t.previous && <span className="text-xs text-slate"> · previously <span className="line-through">{fmtLt(t.previous)}</span> <span className="text-warning-dark font-semibold">{fmtHoursDelta(hoursBetween(t.previous, t.at))}</span></span>}
                    </p>
                  )}
                  {t.note && <p className="text-xs text-slate mt-0.5">{t.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="p-5 space-y-4 bg-cloud/40">
          <div>
            <p className="eyebrow mb-1.5">Current cost estimate</p>
            {c.revisedEstimate ? (
              <>
                <p className="text-2xl font-bold font-display tabular">{usd(c.revisedEstimate.total)}</p>
                <p className="text-xs text-slate mt-0.5">Approved PDA {usd(c.approvedPda)} {usdDelta(c.revisedEstimate.delayImpact)} revised-schedule costs</p>
                <p className="text-2xs text-slate">Approved by Proxima {fmtTimestamp(c.revisedEstimate.approvedAt)}</p>
              </>
            ) : c.approvedPda !== undefined ? (
              <>
                <p className="text-2xl font-bold font-display tabular">{usd(c.approvedPda)}</p>
                <p className="text-xs text-slate mt-0.5">Approved PDA</p>
              </>
            ) : <p className="text-sm text-slate">PDA being prepared by Proxima’s D/A team.</p>}
            {c.estimatePending && <p className="mt-2 text-xs rounded border border-warning/30 bg-warning-light px-2.5 py-1.5">Schedule changed — Proxima is reviewing the cost impact. An approved update will follow.</p>}
          </div>
          {c.suez && (
            <div>
              <p className="eyebrow mb-1.5 flex items-center gap-1"><Navigation size={11} />Suez transit</p>
              <p className="text-sm">{c.suez.direction} convoy {fmtLt(c.suez.convoy)} LT</p>
              {c.suez.originalConvoy && <p className="text-xs text-slate">Previously {fmtLt(c.suez.originalConvoy)} LT</p>}
            </div>
          )}
          <div>
            <p className="eyebrow mb-1.5">Next step</p>
            <p className="text-sm text-graphite">{c.nextStep}</p>
          </div>
          {delay !== 0 && <p className="text-xs text-slate">Berthing {fmtHoursDelta(delay)} against the original plan.</p>}
        </div>
      </div>

      <div className="px-5 py-4 border-t border-line">
        <p className="eyebrow mb-2 flex items-center gap-1"><FileText size={11} />Latest updates from Proxima</p>
        {c.updates.length === 0 ? <p className="text-sm text-slate">No updates yet.</p> : (
          <div className="space-y-2">
            <Collapsible defaultOpen title={<span className="truncate">{latest.subject}</span>} meta={<span className="text-2xs whitespace-nowrap">{fmtTimestamp(latest.sentAt!)}</span>}>
              <pre className="whitespace-pre-wrap font-mono text-xs text-graphite mt-2">{latest.body}</pre>
            </Collapsible>
            {c.updates.slice(1).map(u => (
              <Collapsible key={u.id} title={<span className="truncate">{u.subject}</span>} meta={<span className="text-2xs whitespace-nowrap">{fmtTimestamp(u.sentAt!)}</span>}>
                <pre className="whitespace-pre-wrap font-mono text-xs text-graphite mt-2">{u.body}</pre>
              </Collapsible>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
