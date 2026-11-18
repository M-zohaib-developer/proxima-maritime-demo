import { Check, Mail, Navigation, ShieldAlert } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { useToast } from '@/components/Toast';
import { SeverityBadge, WarningStatusBadge } from '@/components/StatusBadge';
import { checkTransit } from '@/services/scheduleRules';
import { fmtLt, fmtTimestamp, nowIso } from '@/lib/time';
import { usd, usdDelta } from '@/lib/format';
import type { Warning } from '@/types';

const BORDER = { critical: 'border-l-critical', warning: 'border-l-warning', info: 'border-l-info' };

export default function WarningCard({ w, showVessel = false }: { w: Warning; showVessel?: boolean }) {
  const { state, dispatch, navigate } = useDemoStore();
  const { showToast } = useToast();
  const pc = state.portCalls.find(p => p.id === w.portCallId);
  const canRebook = w.kind === 'transit-risk' && w.status !== 'Resolved' && !!pc?.suez && checkTransit(pc, pc.suez).missed;
  const next = canRebook && pc?.suez ? checkTransit(pc, pc.suez).nextConvoy : undefined;
  const resolved = w.status === 'Resolved';

  return (
    <article className={`card border-l-[3px] ${BORDER[w.severity]} ${resolved ? 'opacity-70' : ''} animate-fade-up`}>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <SeverityBadge severity={w.severity} />
          <WarningStatusBadge status={w.status} />
          {showVessel && <button className="text-xs font-semibold text-harbor-600 hover:underline" onClick={() => navigate('port-call-detail', w.portCallId, 'warnings')}>{w.vesselName}</button>}
          <span className="text-2xs text-slate ml-auto">{fmtTimestamp(w.triggeredAt)}</span>
        </div>
        <h3 className="text-[15px] font-semibold font-sans">{w.title}</h3>
        <p className="text-sm text-graphite/90 mt-1"><span className="text-slate">Why: </span>{w.reason}</p>

        {w.facts.length > 0 && (
          <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-3 text-xs">
            {w.facts.map(f => (
              <div key={f.label} className="flex justify-between gap-3 border-b border-line/70 pb-1">
                <dt className="text-slate">{f.label}</dt><dd className="text-graphite font-medium text-right tabular">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {w.costBreakdown && (
          <div className="mt-3 rounded border border-line overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr><th className="th py-2">Cost item (illustrative USD)</th><th className="th py-2 hidden sm:table-cell">Basis</th><th className="th py-2 text-right">Impact</th></tr></thead>
              <tbody>
                {w.costBreakdown.map(c => (
                  <tr key={c.label} className="border-b border-line">
                    <td className="td py-2 font-medium">{c.label}</td>
                    <td className="td py-2 text-slate hidden sm:table-cell">{c.basis}</td>
                    <td className="td py-2 text-right tabular font-semibold">{usdDelta(c.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-cloud/60"><td className="td py-2 font-semibold" colSpan={1}>Total cost impact</td><td className="hidden sm:table-cell" /><td className="td py-2 text-right tabular font-bold text-sm">{usd(w.costImpact ?? 0)}</td></tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="text-2xs text-slate mt-3 flex items-center gap-1"><ShieldAlert size={11} />Rule {w.rule}</p>
        {w.resolution && <p className="text-xs text-success mt-1">✓ {w.resolution}</p>}

        {!resolved && (
          <div className="flex flex-wrap gap-2 mt-3.5">
            {canRebook && (
              <button className="btn-primary btn-sm" onClick={() => { dispatch({ type: 'REBOOK_TRANSIT', portCallId: w.portCallId, at: nowIso() }); showToast('success', 'Rebooking requested', `Convoy ${fmtLt(next)} LT requested — Suez desk task created.`); }}>
                <Navigation size={13} />Request rebooking to {fmtLt(next)} LT
              </button>
            )}
            {w.kind !== 'task-reschedule' && (
              <button className="btn-secondary btn-sm" onClick={() => navigate('port-call-detail', w.portCallId, 'updates')}><Mail size={13} />Draft owner update</button>
            )}
            {w.status === 'Open' && (
              <button className="btn-ghost btn-sm" onClick={() => dispatch({ type: 'SET_WARNING_STATUS', warningId: w.id, status: 'Acknowledged', at: nowIso() })}><Check size={13} />Acknowledge</button>
            )}
            {w.kind !== 'transit-risk' && (
              <button className="btn-ghost btn-sm" onClick={() => dispatch({ type: 'SET_WARNING_STATUS', warningId: w.id, status: 'Resolved', at: nowIso() })}>Mark resolved</button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
