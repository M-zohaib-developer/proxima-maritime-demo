import { useState } from 'react';
import { CalendarX2, CheckCircle2, CircleDashed, ClipboardList, FileCheck2, ListPlus, Ship } from 'lucide-react';
import { useDemoStore, uid } from '@/lib/demoStore';
import { useToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { Field } from '@/components/ui';
import { checkDocuments, deadlineText, DOC_RULE, etaText, SAMPLE_CLOCK_LT } from '@/services/documentRules';
import { addHours, fmtLt, fmtTimestamp, fromInputValue, hoursBetween, isValidLt, nowIso, toInputValue } from '@/lib/time';
import type { PortCall, Task, Warning } from '@/types';

export default function DocumentsCard({ pc }: { pc: PortCall }) {
  const { state, dispatch } = useDemoStore();
  const { showToast } = useToast();
  const check = checkDocuments(pc);
  if (!check || !pc.documents) return null;
  const warning = state.warnings.find(w => w.portCallId === pc.id && w.kind === 'missing-documents' && w.status !== 'Resolved');
  const received = check.total - check.missing.length;
  const tone = check.triggered ? (check.severity === 'critical' ? 'bg-critical-light text-critical-dark' : 'bg-warning-light text-warning-dark') : check.missing.length ? 'bg-cloud text-slate border border-line' : 'bg-success-light text-success';

  return (
    <section className="card" id="documents">
      <header className="card-header">
        <div className="min-w-0">
          <h2 className="card-title flex items-center gap-2"><ClipboardList size={15} className="text-ocean-500" />Pre-arrival documents</h2>
          <p className="text-xs text-slate mt-0.5">Checked at {fmtLt(SAMPLE_CLOCK_LT)} LT (sample clock)</p>
        </div>
        <span className={`badge ${tone}`}>{received}/{check.total} received</span>
      </header>
      <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
        {(() => {
          const passed = check.hoursToDeadline < 0;
          const overdue = passed && check.missing.length > 0;
          return (
            <div className={`px-5 py-3 ${overdue ? (check.severity === 'critical' ? 'bg-critical-light/60' : 'bg-warning-light/60') : ''}`} data-testid="doc-deadline">
              <p className="eyebrow flex items-center gap-1.5"><CalendarX2 size={12} />Document deadline</p>
              <p className="text-[15px] font-semibold tabular mt-0.5">{fmtLt(check.deadline)} LT</p>
              <p className={`text-xs mt-0.5 ${overdue ? (check.severity === 'critical' ? 'text-critical-dark font-semibold' : 'text-warning-dark font-semibold') : 'text-slate'}`}>
                {check.missing.length === 0 ? 'Met — all documents received' : `${deadlineText(check.hoursToDeadline).replace(/^./, c => c.toUpperCase())}${overdue ? ' · overdue' : ''}`}
              </p>
              <p className="text-2xs text-slate mt-0.5">ETA − 24 h</p>
            </div>
          );
        })()}
        <div className="px-5 py-3" data-testid="vessel-eta">
          <p className="eyebrow flex items-center gap-1.5"><Ship size={12} />Vessel ETA</p>
          <p className="text-[15px] font-semibold tabular mt-0.5">{fmtLt(pc.eta)} LT</p>
          <p className="text-xs text-slate mt-0.5">{etaText(check.hoursToEta).replace(/^./, c => c.toUpperCase())}</p>
          <p className="text-2xs text-slate mt-0.5">Time remaining before arrival</p>
        </div>
      </div>
      <div className="h-1 bg-cloud"><div className={`h-full transition-all duration-500 ${check.missing.length ? 'bg-warning' : 'bg-success'}`} style={{ width: `${(received / check.total) * 100}%` }} /></div>
      <ul className="divide-y divide-line">
        {pc.documents.map(d => (
          <li key={d.id} className="px-5 py-2.5 flex items-center gap-3">
            {d.status === 'Received' ? <CheckCircle2 size={16} className="text-success shrink-0" /> : <CircleDashed size={16} className={`shrink-0 ${check.triggered ? 'text-warning' : 'text-ocean-300'}`} />}
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${d.status === 'Received' ? 'text-graphite' : 'font-medium'}`}>{d.name}</p>
              <p className="text-2xs text-slate">{d.status === 'Received' ? `Received${d.receivedBy ? ` by ${d.receivedBy}` : ''}${d.receivedAt ? ` · ${fmtTimestamp(d.receivedAt)}` : ''}` : check.triggered ? `Overdue — was due by ${fmtLt(check.deadline)} LT` : `Missing — due by ${fmtLt(check.deadline)} LT`}</p>
            </div>
            {d.status === 'Missing' && (
              <button className="btn-secondary btn-sm" aria-label={`Mark ${d.name} received`}
                onClick={() => {
                  dispatch({ type: 'MARK_DOCUMENT_RECEIVED', portCallId: pc.id, documentId: d.id, at: nowIso() });
                  const left = check.missing.length - 1;
                  showToast('success', `${d.name} received`, left === 0 ? (warning ? 'All documents in — warning cleared.' : 'All documents in.') : `${left} still missing.`);
                }}>
                <FileCheck2 size={13} className="text-success" />Mark received
              </button>
            )}
          </li>
        ))}
      </ul>
      <footer className="px-5 py-3 border-t border-line flex flex-wrap items-center gap-2 justify-between">
        <p className="text-2xs text-slate">{check.triggered ? 'Deadline passed with documents missing — warning raised.' : check.missing.length ? 'A warning is raised if anything is still missing when the deadline passes.' : 'All required documents received.'} Rule {DOC_RULE.split(' ·')[0]}.</p>
        {warning && <DocFollowUpButton warning={warning} />}
      </footer>
    </section>
  );
}

/** Create (once) a follow-up task for a missing-documents warning, or show who owns it. */
export function DocFollowUpButton({ warning }: { warning: Warning }) {
  const { state, dispatch } = useDemoStore();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const pc = state.portCalls.find(p => p.id === warning.portCallId);
  const existing = warning.followUpTaskId ? state.tasks.find(t => t.id === warning.followUpTaskId) : undefined;
  const missing = pc?.documents?.filter(d => d.status === 'Missing') ?? [];
  const defaultOwner = state.staff.find(s => s.desk === 'Operations' && pc && s.office === pc.port) ?? state.staff.find(s => s.id === state.currentUserId)!;
  const defaultDue = addHours(SAMPLE_CLOCK_LT, 2);
  const [f, setF] = useState({ title: '', assigneeId: defaultOwner.id, dueAt: toInputValue(defaultDue), priority: 'High' as Task['priority'] });
  const [touched, setTouched] = useState(false);

  if (existing) {
    const who = state.staff.find(s => s.id === existing.assigneeId)?.name ?? '—';
    return <span className="inline-flex items-center gap-1.5 text-xs text-slate"><ListPlus size={13} className="text-teal-600" />Follow-up assigned to <b className="text-graphite">{who}</b> · {existing.status === 'Done' ? 'done' : `due ${fmtLt(existing.dueAt)}`}</span>;
  }
  if (!pc) return null;

  const errs = {
    title: f.title.trim().length < 3 ? 'Title is required' : undefined,
    dueAt: !isValidLt(fromInputValue(f.dueAt)) ? 'Valid due time required' : undefined,
  };

  function save() {
    setTouched(true);
    if (errs.title || errs.dueAt || !pc) return;
    const dueAt = fromInputValue(f.dueAt);
    const task: Task = {
      id: uid('tsk'), portCallId: pc.id, vesselName: pc.vesselName, category: 'documents',
      title: f.title.trim(), description: `Chase and file: ${missing.map(d => d.name).join(', ')}. Raised from warning "${warning.title}".`,
      assigneeId: f.assigneeId, dueAt, priority: f.priority, status: 'Open', createdFrom: 'manual',
      rule: `${DOC_RULE.split(' ·')[0]} follow-up`,
    };
    dispatch({ type: 'CREATE_DOC_FOLLOWUP', warningId: warning.id, task, at: nowIso() });
    showToast('success', 'Follow-up task created', `${task.title} — ${state.staff.find(s => s.id === f.assigneeId)?.name}`);
    setOpen(false);
  }

  return (
    <>
      <button className="btn-primary btn-sm" onClick={() => {
        setF({ title: `Chase missing documents: ${missing.map(d => d.name).join(', ')}`, assigneeId: defaultOwner.id, dueAt: toInputValue(defaultDue), priority: 'High' });
        setTouched(false); setOpen(true);
      }}><ListPlus size={13} />Create follow-up task</button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Follow-up — ${pc.vesselName}`} subtitle={`${missing.length} document${missing.length === 1 ? '' : 's'} missing · ETA ${fmtLt(pc.eta)} LT`} size="lg"
        footer={<><button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" onClick={save}>Create task</button></>}>
        <form className="grid sm:grid-cols-2 gap-3" onSubmit={e => { e.preventDefault(); save(); }}>
          <div className="sm:col-span-2">
            <Field label="Title" htmlFor="df-title" error={touched ? errs.title : undefined}>
              <input id="df-title" className="input" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
            </Field>
          </div>
          <Field label="Owner" htmlFor="df-own">
            <select id="df-own" className="input" value={f.assigneeId} onChange={e => setF({ ...f, assigneeId: e.target.value })}>
              {state.staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.desk}, {s.office}</option>)}
            </select>
          </Field>
          <Field label="Due (LT)" htmlFor="df-due" error={touched ? errs.dueAt : undefined}
            hint={isValidLt(fromInputValue(f.dueAt)) ? `${Math.round(hoursBetween(fromInputValue(f.dueAt), pc.eta))} h before ETA` : undefined}>
            <input id="df-due" type="datetime-local" className="input" value={f.dueAt} onChange={e => setF({ ...f, dueAt: e.target.value })} />
          </Field>
          <Field label="Priority" htmlFor="df-pri">
            <select id="df-pri" className="input" value={f.priority} onChange={e => setF({ ...f, priority: e.target.value as Task['priority'] })}>
              {['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>
        </form>
      </Modal>
    </>
  );
}
