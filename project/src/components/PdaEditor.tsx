import { useMemo, useState } from 'react';
import { Check, FileText, Lock, Pencil, RefreshCw, Send, ShieldCheck, Sparkles, Undo2 } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { useToast } from '@/components/Toast';
import Modal, { ConfirmDialog } from '@/components/Modal';
import { Collapsible, EmptyState, Field, Note, SimBadge, SkeletonRows, useBusy } from '@/components/ui';
import { PDAStatusBadge } from '@/components/StatusBadge';
import { ai } from '@/services/ai';
import { pdaTotal } from '@/services/pdaEngine';
import { lineAmount, num, usd } from '@/lib/format';
import { fmtTimestamp, nowIso } from '@/lib/time';
import { vesselOf } from '@/lib/selectors';
import type { PDALineItem, PortCall } from '@/types';

export default function PdaEditor({ pc }: { pc: PortCall }) {
  const { state, dispatch, user, navigate } = useDemoStore();
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const pda = state.pdas[pc.id];
  const vessel = vesselOf(state, pc);
  const [editing, setEditing] = useState<PDALineItem | null>(null);
  const [confirm, setConfirm] = useState<'approve' | 'send' | null>(null);
  const isDA = user.desk === 'D/A';
  const total = pdaTotal(pda);
  const editedCount = pda?.lineItems.filter(l => l.edited).length ?? 0;

  async function generate() {
    if (!vessel) return;
    const res = await run('gen', () => ai.draftPda(pc, vessel, state.historical));
    if (!res) return;
    dispatch({
      type: 'SET_PDA', at: nowIso(),
      pda: { id: `pda-${pc.id}`, portCallId: pc.id, status: 'Draft', lineItems: res.lines, basedOn: res.basedOn, generatedAt: nowIso(), generatedBy: `${user.name} (simulated AI draft)` },
    });
    showToast('success', 'PDA draft generated', `${res.lines.length} lines from sample tariff and ${res.basedOn.length} past calls. Review before approval.`);
  }

  if (busy === 'gen') {
    return (
      <div className="card">
        <div className="card-header"><span className="card-title flex items-center gap-2"><Sparkles size={15} className="text-teal-500" />Drafting PDA from tariff and past calls…</span><SimBadge /></div>
        <SkeletonRows rows={8} />
      </div>
    );
  }

  if (!pda) {
    return (
      <div className="card">
        <EmptyState icon={<FileText size={18} />} title="No PDA drafted yet"
          action={<button className="btn-teal" onClick={generate} disabled={!vessel}><Sparkles size={15} />Generate PDA draft</button>}>
          The draft is calculated line by line from the illustrative {pc.port} tariff, the vessel's particulars and similar past calls. Nothing is sent or approved automatically.
        </EmptyState>
      </div>
    );
  }

  const locked = pda.status !== 'Draft';

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-4 justify-between border-b border-line">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold font-sans">Pro forma disbursement account</h2>
              <PDAStatusBadge status={pda.status} />
              <SimBadge />
            </div>
            <p className="text-xs text-slate mt-1">
              {pc.vesselName} · {pc.port} · {pc.ref} · generated {fmtTimestamp(pda.generatedAt)} by {pda.generatedBy}
              {pda.approvedBy && <> · approved by <span className="text-graphite font-medium">{pda.approvedBy}</span> {fmtTimestamp(pda.approvedAt!)}</>}
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <div className="text-right">
              <p className="eyebrow">Total (illustrative USD)</p>
              <p key={total} className="text-2xl font-bold font-display tabular animate-fade-in">{usd(total)}</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 flex flex-wrap items-center gap-2 border-b border-line bg-cloud/40">
          {pda.status === 'Draft' && (
            <>
              <button className="btn-secondary btn-sm" onClick={generate}><RefreshCw size={13} />Regenerate draft</button>
              {isDA ? (
                <button className="btn-teal btn-sm" onClick={() => setConfirm('approve')}><ShieldCheck size={14} />Approve PDA</button>
              ) : (
                <button className="btn-secondary btn-sm" onClick={() => dispatch({ type: 'SET_USER', userId: state.staff.find(s => s.desk === 'D/A')!.id })}
                  title="Approval is restricted to the D/A desk">
                  <Lock size={13} />Approval: switch to D/A Supervisor
                </button>
              )}
            </>
          )}
          {pda.status === 'Approved' && (
            <button className="btn-primary btn-sm" onClick={() => setConfirm('send')}><Send size={13} />Mark as sent to owner (simulated)</button>
          )}
          {pda.status === 'Sent' && <span className="text-xs text-slate">Recorded as sent {fmtTimestamp(pda.sentAt!)} by {pda.sentBy}. No external email was sent.</span>}
          <span className="ml-auto text-xs text-slate">{pda.lineItems.length} lines · {editedCount} edited</span>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr>
                <th className="th">Description</th>
                <th className="th text-right">Qty</th>
                <th className="th text-right">Rate</th>
                <th className="th text-right">Amount</th>
                <th className="th">Source</th>
                <th className="th w-28 text-right">Edit</th>
              </tr>
            </thead>
            <tbody>
              {pda.lineItems.map(li => (
                <tr key={li.id} className={`border-b border-line last:border-0 ${li.edited ? 'bg-harbor-50/60' : ''}`}>
                  <td className="td">
                    <p className="font-medium text-graphite">{li.description}</p>
                    {li.edited && <p className="text-2xs text-harbor-700 mt-0.5">Edited by {li.editedBy}: {li.editNote} (was {usd(li.original!.amount)})</p>}
                  </td>
                  <td className="td text-right tabular whitespace-nowrap">{num(li.quantity)} <span className="text-slate text-xs">{li.unit}</span></td>
                  <td className="td text-right tabular">{usd(li.rate)}</td>
                  <td className="td text-right tabular font-semibold">{usd(li.amount)}</td>
                  <td className="td max-w-[22rem]">
                    <p className="text-xs font-medium text-graphite">{li.source}</p>
                    <p className="text-2xs text-slate leading-snug mt-0.5">{li.basis}</p>
                  </td>
                  <td className="td text-right">
                    {!li.editable ? (
                      <span className="inline-flex items-center gap-1 text-2xs text-slate" title="Contract rate"><Lock size={11} />Locked</span>
                    ) : locked ? (
                      <span className="text-2xs text-slate">—</span>
                    ) : (
                      <button className="btn-ghost btn-sm" onClick={() => setEditing(li)} aria-label={`Edit ${li.description}`}><Pencil size={13} />Edit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-cloud/60">
                <td className="td font-semibold" colSpan={3}>Total</td>
                <td className="td text-right tabular font-bold text-base">{usd(total)}</td>
                <td className="td text-2xs text-slate" colSpan={2}>Illustrative USD — not official port or SCA tariffs</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <Collapsible title={<><Sparkles size={14} className="text-teal-500" />Source data behind this draft</>} meta={<span className="text-2xs">{pda.basedOn.length} past calls</span>}>
        <ul className="text-sm space-y-1.5 mt-2">
          <li>• Tariff: illustrative {pc.port} sample tariff (USD) — see Settings → Tariffs.</li>
          {vessel && <li>• Vessel particulars: GT {num(vessel.gt)}, LOA {vessel.loa} m, SCNT {num(vessel.scnt)} (sample).</li>}
          <li>• Schedule: ETA → ETD drives port dues; ETB → ETD drives berth days.</li>
          {pda.basedOn.map(b => <li key={b}>• Past call: {b}</li>)}
        </ul>
        <button className="btn-ghost btn-sm mt-2 -ml-2" onClick={() => navigate('pda-vs-fda')}>View past PDA vs FDA</button>
      </Collapsible>

      {pda.status === 'Draft' && (
        <Note tone="warning">This is a draft. Figures are not final and are never sent to the owner without approval by the D/A desk.</Note>
      )}

      {editing && <EditLineModal li={editing} onClose={() => setEditing(null)} onSave={(q, r, note) => {
        dispatch({ type: 'EDIT_PDA_LINE', portCallId: pc.id, lineId: editing.id, quantity: q, rate: r, note, at: nowIso() });
        showToast('success', 'Line updated', `${editing.description}: ${usd(editing.amount)} → ${usd(lineAmount(q, r))}. Total recalculated.`);
        setEditing(null);
      }} />}

      <ConfirmDialog open={confirm === 'approve'} onClose={() => setConfirm(null)} title="Approve this PDA?" confirmLabel="Approve PDA" tone="teal"
        onConfirm={() => { dispatch({ type: 'APPROVE_PDA', portCallId: pc.id, at: nowIso() }); showToast('success', 'PDA approved', `${usd(total)} approved by ${user.name}. It has not been sent.`); }}>
        <p>You are approving <b>{usd(total)}</b> for {pc.vesselName} as <b>{user.name}</b> ({user.title}).</p>
        <p className="text-slate">{editedCount} line{editedCount === 1 ? '' : 's'} edited. Approval locks the line items. Sending to the owner is a separate step.</p>
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'send'} onClose={() => setConfirm(null)} title="Record PDA as sent?" confirmLabel="Record as sent"
        onConfirm={() => { dispatch({ type: 'SEND_PDA', portCallId: pc.id, at: nowIso() }); showToast('info', 'PDA recorded as sent (simulated)', 'No external email was sent.'); }}>
        <p>This records the approved PDA ({usd(total)}) as sent to {pc.ownerName}.</p>
        <p className="text-slate">Demo only — no email leaves this application.</p>
      </ConfirmDialog>
    </div>
  );
}

function EditLineModal({ li, onClose, onSave }: { li: PDALineItem; onClose: () => void; onSave: (q: number, r: number, note: string) => void }) {
  const [q, setQ] = useState(String(li.quantity));
  const [r, setR] = useState(String(li.rate));
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const qn = Number(q), rn = Number(r);
  const errors = useMemo(() => ({
    q: q.trim() === '' || !Number.isFinite(qn) || qn < 0 ? 'Enter a quantity ≥ 0' : undefined,
    r: r.trim() === '' || !Number.isFinite(rn) || rn < 0 ? 'Enter a rate ≥ 0' : undefined,
    note: note.trim().length < 4 ? 'Explain the change (min. 4 characters) — it is kept in the audit trail' : undefined,
    same: qn === li.quantity && rn === li.rate ? 'No change to quantity or rate' : undefined,
  }), [q, r, note, qn, rn, li]);
  const valid = !errors.q && !errors.r && !errors.note && !errors.same;
  const preview = !errors.q && !errors.r ? lineAmount(qn, rn) : undefined;

  return (
    <Modal open onClose={onClose} title={`Edit line — ${li.description}`} subtitle={`${li.source} · ${li.basis}`} size="lg"
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => { setTouched(true); if (valid) onSave(qn, rn, note.trim()); }}><Check size={15} />Save line</button>
      </>}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); setTouched(true); if (valid) onSave(qn, rn, note.trim()); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Quantity (${li.unit})`} error={touched ? errors.q : undefined} htmlFor="q">
            <input id="q" className={`input tabular ${touched && errors.q ? 'input-error' : ''}`} inputMode="decimal" value={q} onChange={e => setQ(e.target.value)} />
          </Field>
          <Field label="Rate (USD)" error={touched ? errors.r : undefined} htmlFor="r">
            <input id="r" className={`input tabular ${touched && errors.r ? 'input-error' : ''}`} inputMode="decimal" value={r} onChange={e => setR(e.target.value)} />
          </Field>
        </div>
        <div className="rounded border border-line bg-cloud/50 px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-slate">Amount</span>
          <span className="tabular"><span className="text-slate line-through mr-2">{usd(li.amount)}</span><b>{usd(preview)}</b></span>
        </div>
        <Field label="Reason for change (audit trail)" error={touched ? errors.note ?? errors.same : undefined} htmlFor="note">
          <textarea id="note" rows={2} className={`input ${touched && errors.note ? 'input-error' : ''}`} placeholder="e.g. Courier for crew documents expected" value={note} onChange={e => setNote(e.target.value)} />
        </Field>
        {li.original && (
          <button type="button" className="btn-ghost btn-sm -ml-2" onClick={() => { setQ(String(li.original!.quantity)); setR(String(li.original!.rate)); }}>
            <Undo2 size={13} />Restore drafted values ({num(li.original.quantity)} × {usd(li.original.rate)})
          </button>
        )}
      </form>
    </Modal>
  );
}
