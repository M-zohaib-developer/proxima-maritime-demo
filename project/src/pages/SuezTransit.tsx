import { AlertTriangle, ArrowRight, Navigation } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { Card, EmptyState, Note, PageHeader, SampleTag } from '@/components/ui';
import { TransitStatusBadge } from '@/components/StatusBadge';
import WarningCard from '@/components/WarningCard';
import { checkTransit } from '@/services/scheduleRules';
import { SUEZ_TABLE } from '@/lib/tariffs';
import { fmtLt } from '@/lib/time';
import { num, usd } from '@/lib/format';
import { vesselOf } from '@/lib/selectors';
import type { VesselType } from '@/types';

export default function SuezTransit() {
  const { state, navigate } = useDemoStore();
  const transits = state.portCalls.filter(p => p.suez);
  const risks = state.warnings.filter(w => w.kind === 'transit-risk' && w.status !== 'Resolved');

  return (
    <>
      <PageHeader eyebrow="Suez desk" title="Suez Transit"
        subtitle="Convoy bookings linked to each port call. Cut-offs are checked automatically whenever a departure time moves."
        actions={<SampleTag label="Illustrative convoy times" />} />

      {risks.length > 0 && <div className="space-y-3 mb-5">{risks.map(w => <WarningCard key={w.id} w={w} showVessel />)}</div>}

      <Card title="Transit bookings" subtitle="Sample convoy pattern: daily 03:00 LT, cut-off 5 h before at the waiting area">
        {transits.length === 0 ? <EmptyState icon={<Navigation size={18} />} title="No transits booked">Create the MV Nile Trader port call from the nomination email — it requests a southbound convoy.</EmptyState> : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm min-w-[900px]">
              <thead><tr>
                <th className="th">Vessel</th><th className="th">Direction</th><th className="th">Convoy (LT)</th><th className="th">Cut-off (LT)</th>
                <th className="th">Est. arrival at waiting area</th><th className="th">Status</th><th className="th" />
              </tr></thead>
              <tbody>
                {transits.map(pc => {
                  const s = pc.suez!;
                  const c = s.passageHours > 0 && pc.status !== 'In Transit' && pc.status !== 'Completed' ? checkTransit(pc, s) : undefined;
                  return (
                    <tr key={pc.id} className="border-b border-line last:border-0 tr-hover cursor-pointer" onClick={() => navigate('port-call-detail', pc.id)}>
                      <td className="td"><p className="font-semibold">{pc.vesselName}</p><p className="text-2xs text-slate">{pc.ref} · from {pc.port}</p></td>
                      <td className="td">{s.direction} · {s.condition}<p className="text-2xs text-slate">Waiting area: {s.waitingArea}</p></td>
                      <td className="td tabular">{fmtLt(s.convoy)}{s.originalConvoy && <p className="text-2xs text-slate line-through">{fmtLt(s.originalConvoy)}</p>}</td>
                      <td className="td tabular">{fmtLt(s.cutoff)}</td>
                      <td className="td tabular">
                        {c ? <span className={c.missed ? 'text-critical font-semibold inline-flex items-center gap-1' : ''}>{c.missed && <AlertTriangle size={13} />}{fmtLt(c.arrival)} · {c.missed ? `${Math.abs(c.bufferHours)} h late` : `${c.bufferHours} h buffer`}</span>
                          : <span className="text-slate">{pc.status === 'In Transit' ? 'In canal' : '—'}</span>}
                      </td>
                      <td className="td"><TransitStatusBadge status={s.status} /></td>
                      <td className="td text-right"><ArrowRight size={15} className="text-ocean-300 inline" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-5 mt-5">
        <Card title="Illustrative Suez dues table" subtitle={SUEZ_TABLE.ref}>
          <table className="w-full text-sm">
            <thead><tr><th className="th">Vessel type</th><th className="th text-right">Laden / SCNT</th><th className="th text-right">Ballast / SCNT</th></tr></thead>
            <tbody>
              {(Object.keys(SUEZ_TABLE.ratePerScnt) as VesselType[]).map(t => (
                <tr key={t} className="border-b border-line last:border-0"><td className="td">{t}</td><td className="td text-right tabular">{usd(SUEZ_TABLE.ratePerScnt[t].Laden)}</td><td className="td text-right tabular">{usd(SUEZ_TABLE.ratePerScnt[t].Ballast)}</td></tr>
              ))}
            </tbody>
          </table>
          <div className="p-4"><Note tone="warning">Illustrative figures only — not the Suez Canal Authority tariff. Amendment charge after a missed cut-off: {usd(SUEZ_TABLE.amendmentCharge)} (illustrative).</Note></div>
        </Card>
        <Card title="Estimated dues per booking" subtitle="SCNT × illustrative rate">
          <ul className="divide-y divide-line">
            {transits.map(pc => {
              const v = vesselOf(state, pc);
              if (!v) return null;
              const rate = SUEZ_TABLE.ratePerScnt[v.type][pc.suez!.condition];
              return (
                <li key={pc.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                  <span><b>{pc.vesselName}</b><span className="block text-2xs text-slate">SCNT {num(v.scnt)} × {usd(rate)} ({pc.suez!.condition.toLowerCase()})</span></span>
                  <span className="tabular font-semibold">{usd(v.scnt * rate)}</span>
                </li>
              );
            })}
          </ul>
          <p className="px-5 py-3 text-2xs text-slate border-t border-line">Not connected to any canal booking system — rebooking requests are logged internally for the Suez desk (possible next step).</p>
        </Card>
      </div>
    </>
  );
}
