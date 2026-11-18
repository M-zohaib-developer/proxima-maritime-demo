import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { Field, Note, useBusy } from '@/components/ui';
import { ai } from '@/services/ai';
import { assessScheduleChange } from '@/services/scheduleRules';
import { vesselOf } from '@/lib/selectors';
import { addHours, fmtHoursDelta, fmtLt, fromInputValue, hoursBetween, isValidLt, nowIso, toInputValue } from '@/lib/time';
import { usd, usdDelta } from '@/lib/format';
import type { PortCall } from '@/types';

export const SAMPLE_DELAY_REASON = 'Berth occupied — preceding vessel’s discharge overran (sample event)';

export function ScheduleCard({ pc, onChange }: { pc: PortCall; onChange: () => void }) {
  const changed = pc.etb !== pc.baseline.etb || pc.etd !== pc.baseline.etd || pc.eta !== pc.baseline.eta;
  const rows: [string, string, string][] = [
    ['ETA', pc.eta, pc.baseline.eta],
    ['ETB', pc.etb, pc.baseline.etb],
    ['ETD', pc.etd, pc.baseline.etd],
  ];
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title flex items-center gap-2"><CalendarClock size={15} className="text-ocean-500" />Schedule <span className="text-2xs text-slate font-normal">(port local time)</span></span>
        <button className="btn-secondary btn-sm" onClick={onChange} disabled={pc.status === 'Completed' || pc.status === 'In Transit'}><Clock size={13} />Change berth time</button>
      </div>
      <div className="grid grid-cols-3 divide-x divide-line">
        {rows.map(([k, v, b]) => {
          const d = hoursBetween(b, v);
          return (
            <div key={k} className="px-4 py-3.5">
              <p className="eyebrow">{k}</p>
              <p className="text-[15px] font-semibold tabular mt-0.5">{fmtLt(v)}</p>
              {d !== 0
                ? <p className="text-2xs mt-0.5"><span className="text-slate line-through">{fmtLt(b)}</span> <span className="text-critical font-semibold">{fmtHoursDelta(d)}</span></p>
                : <p className="text-2xs text-slate mt-0.5">as nominated</p>}
            </div>
          );
        })}
      </div>
      {changed && pc.delayReason && <div className="px-4 py-2.5 border-t border-line text-xs text-slate">Reason: <span className="text-graphite">{pc.delayReason}</span></div>}
    </div>
  );
}

export function ScheduleChangeModal({ pc, open, onClose, onApplied }: { pc: PortCall; open: boolean; onClose: () => void; onApplied?: () => void }) {
  const { state, dispatch } = useDemoStore();
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const vessel = vesselOf(state, pc);
  const berthHours = hoursBetween(pc.etb, pc.etd);
  const [etb, setEtb] = useState(toInputValue(pc.etb));
  const [etd, setEtd] = useState(toInputValue(pc.etd));
  const [keep, setKeep] = useState(true);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  const after = useMemo(() => ({ eta: pc.eta, etb: fromInputValue(etb), etd: keep && isValidLt(fromInputValue(etb)) ? addHours(fromInputValue(etb), berthHours) : fromInputValue(etd) }), [etb, etd, keep, pc.eta, berthHours]);
  const errors = {
    etb: !isValidLt(after.etb) ? 'Enter a valid berthing time' : hoursBetween(pc.eta, after.etb) < 0 ? 'ETB cannot be before ETA' : undefined,
    etd: !isValidLt(after.etd) ? 'Enter a valid departure time' : isValidLt(after.etb) && hoursBetween(after.etb, after.etd) <= 0 ? 'ETD must be after ETB' : undefined,
    reason: reason.trim().length < 4 ? 'Give the reason — it appears in warnings, the audit log and the owner update' : undefined,
    same: after.etb === pc.etb && after.etd === pc.etd ? 'Schedule is unchanged' : undefined,
  };
  const valid = !errors.etb && !errors.etd && !errors.reason && !errors.same;
  const preview = useMemo(() => (vessel && !errors.etb && !errors.etd && !errors.same ? assessScheduleChange(pc, vessel, after, state.tasks, reason || '—') : null),
    [after, vessel, pc, state.tasks, reason, errors.etb, errors.etd, errors.same]);

  function applySample() {
    setEtb(toInputValue(addHours(pc.etb, 18)));
    setEtd(toInputValue(addHours(pc.etd, 18)));
    setKeep(true);
    if (!reason) setReason(SAMPLE_DELAY_REASON);
  }

  async function apply() {
    setTouched(true);
    if (!valid || !vessel) return;
    const assessment = await run('apply', () => ai.assessScheduleChange(pc, vessel, after, state.tasks, reason.trim()));
    if (!assessment) return;
    dispatch({ type: 'APPLY_SCHEDULE', portCallId: pc.id, schedule: after, reason: reason.trim(), assessment, at: nowIso() });
    const crit = assessment.warnings.some(w => w.severity === 'critical');
    showToast(crit ? 'warning' : 'info', crit ? 'Early warning raised' : 'Schedule updated', assessment.summary);
    onClose();
    onApplied?.();
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" title={`Change berth time — ${pc.vesselName}`} subtitle="Rule-based early-warning check runs before anything is saved"
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={apply} disabled={busy === 'apply'}>
          {busy === 'apply' ? <><Sparkles size={15} className="animate-pulse" />Checking knock-on effects…</> : <>Apply change</>}
        </button>
      </>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate">Quick scenario:</span>
          <button className="btn-secondary btn-sm" onClick={applySample}><Clock size={13} />Berthing +18 h (sample change event)</button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="New ETB (LT)" htmlFor="etb" error={touched ? errors.etb : undefined} hint={`Currently ${fmtLt(pc.etb, true)}`}>
            <input id="etb" type="datetime-local" className="input tabular" value={etb} onChange={e => setEtb(e.target.value)} />
          </Field>
          <Field label="New ETD (LT)" htmlFor="etd" error={touched ? errors.etd : undefined} hint={keep ? `ETB + ${berthHours} h alongside` : `Currently ${fmtLt(pc.etd, true)}`}>
            <input id="etd" type="datetime-local" className="input tabular disabled:bg-cloud" value={keep && isValidLt(after.etd) ? toInputValue(after.etd) : etd} disabled={keep} onChange={e => setEtd(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-graphite cursor-pointer">
          <input type="checkbox" className="accent-teal-600 w-4 h-4" checked={keep} onChange={e => { setKeep(e.target.checked); if (!e.target.checked) setEtd(toInputValue(after.etd)); }} />
          Keep planned time alongside ({berthHours} h)
        </label>
        <Field label="Reason" htmlFor="reason" error={touched ? errors.reason : undefined}>
          <input id="reason" className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Berth occupied by preceding vessel" />
        </Field>
        {touched && errors.same && <p className="text-xs text-critical">{errors.same}</p>}

        {preview && (
          <div className="rounded-lg border border-line overflow-hidden animate-fade-in">
            <div className="px-4 py-2.5 bg-cloud/60 border-b border-line flex items-center justify-between">
              <p className="text-sm font-semibold">Pre-check: {fmtHoursDelta(preview.deltaEtbHours)} berthing</p>
              <span className="text-2xs text-slate">deterministic rules · sample tariff</span>
            </div>
            <div className="p-4 space-y-2.5 text-sm">
              {preview.transitAfter && (
                preview.transitAfter.missed
                  ? <Note tone="critical" icon={<AlertTriangle size={15} />}>Suez convoy {fmtLt(preview.transitAfter.convoy)} LT would be missed by {Math.abs(preview.transitAfter.bufferHours)} h (arrival {fmtLt(preview.transitAfter.arrival)} vs cut-off {fmtLt(preview.transitAfter.cutoff)}). Next feasible: {fmtLt(preview.transitAfter.nextConvoy)} LT.</Note>
                  : <Note tone="success" icon={<CheckCircle2 size={15} />}>Suez convoy {fmtLt(preview.transitAfter.convoy)} LT still met — {preview.transitAfter.bufferHours} h buffer before cut-off.</Note>
              )}
              {preview.costLines.length > 0 ? (
                <div>
                  <p className="text-xs text-slate mb-1">Schedule-driven cost change</p>
                  <ul className="space-y-1">
                    {preview.costLines.map(l => <li key={l.label} className="flex justify-between gap-3"><span>{l.label}</span><span className="tabular font-medium">{usdDelta(l.amount)}</span></li>)}
                    <li className="flex justify-between gap-3 border-t border-line pt-1 font-semibold"><span>Total</span><span className="tabular">{usdDelta(preview.costTotal)}</span></li>
                  </ul>
                </div>
              ) : <p className="text-slate text-xs">No schedule-driven cost change ({usd(0)}).</p>}
              {preview.taskShifts.length > 0 && <p className="text-xs text-slate">{preview.taskShifts.length} ETB-anchored task(s) will move with the berth.</p>}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
