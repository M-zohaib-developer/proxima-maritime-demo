import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ExternalLink, Inbox, ListChecks, Mail, MailOpen, Paperclip, Ship, Sparkles, UserRound } from 'lucide-react';
import { useDemoStore, uid } from '@/lib/demoStore';
import { useToast } from '@/components/Toast';
import { Avatar, EmptyState, Field, Note, PageHeader, SampleTag, SimBadge, Skeleton, useBusy } from '@/components/ui';
import { ai } from '@/services/ai';
import type { NominationDraft, NominationExtraction, TaskSuggestion } from '@/services/ai/types';
import { buildPortCallFromNomination, validateNomination, type NominationErrors } from '@/services/portCalls';
import { fmtLt, fmtTimestamp, fromInputValue, nowIso, toInputValue } from '@/lib/time';
import type { DemoEmail, EmailType, PortName, ServiceKey, Task, VesselType } from '@/types';

const TYPE_LABEL: Record<EmailType, string> = { nomination: 'Nomination', 'crew-change': 'Crew change', provisions: 'Provisions', 'status-inquiry': 'Owner inquiry' };
const TYPE_TONE: Record<EmailType, string> = { nomination: 'bg-teal-100 text-teal-700', 'crew-change': 'bg-harbor-100 text-harbor-700', provisions: 'bg-info-light text-info', 'status-inquiry': 'bg-warning-light text-warning-dark' };

export default function EmailInbox() {
  const { state, route, navigate } = useDemoStore();
  const [filter, setFilter] = useState<'all' | 'new'>('all');
  const emails = [...state.emails].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).filter(e => filter === 'all' || e.status === 'New');
  const selected = state.emails.find(e => e.id === route.id);

  return (
    <>
      <PageHeader eyebrow="agency.alexandria@proxima.example" title="Email Inbox"
        subtitle="Requests arrive by email. Extract them into port calls and tracked tasks — every extraction is reviewed by an operator before it is saved."
        actions={<><SampleTag label="Sample emails" /><SimBadge /></>} />
      <div className="grid lg:grid-cols-[22rem_1fr] gap-4 sm:gap-5 items-start">
        <div className={`card overflow-hidden ${selected ? 'hidden lg:block' : ''}`}>
          <div className="px-3 py-2.5 border-b border-line flex gap-1">
            {(['all', 'new'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`btn-sm btn ${filter === f ? 'bg-ocean-900 text-white' : 'text-slate hover:bg-cloud'}`}>
                {f === 'all' ? 'All' : `New (${state.emails.filter(e => e.status === 'New').length})`}
              </button>
            ))}
          </div>
          {emails.length === 0 ? <EmptyState icon={<Inbox size={18} />} title="Inbox zero">All sample emails have been processed.</EmptyState> : (
            <ul>
              {emails.map(e => (
                <li key={e.id}>
                  <button onClick={() => navigate('email-inbox', e.id)}
                    className={`w-full text-left px-4 py-3 border-b border-line transition-colors relative ${selected?.id === e.id ? 'bg-harbor-50' : 'hover:bg-cloud/70'}`}>
                    {selected?.id === e.id && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-harbor-600" />}
                    <div className="flex items-center gap-2">
                      {e.status === 'New' ? <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" /> : <CheckCircle2 size={13} className="text-success shrink-0" />}
                      <span className={`text-sm truncate flex-1 ${e.status === 'New' ? 'font-semibold' : 'text-slate'}`}>{e.from}</span>
                      <span className="text-2xs text-slate shrink-0">{fmtTimestamp(e.receivedAt).split(' ').slice(-1)}</span>
                    </div>
                    <p className={`text-[13px] truncate mt-0.5 ${e.status === 'New' ? 'text-graphite' : 'text-slate'}`}>{e.subject}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`badge ${TYPE_TONE[e.type]}`}>{TYPE_LABEL[e.type]}</span>
                      {e.status === 'Processed' && <span className="text-2xs text-slate">Processed</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected ? <EmailReader key={selected.id} email={selected} onBack={() => navigate('email-inbox')} /> : (
          <div className="card hidden lg:block"><EmptyState icon={<MailOpen size={18} />} title="Select an email">Start with the nomination for MV Nile Trader.</EmptyState></div>
        )}
      </div>
    </>
  );
}

function EmailReader({ email, onBack }: { email: DemoEmail; onBack: () => void }) {
  const { state } = useDemoStore();
  const linked = state.portCalls.find(p => p.id === email.linkedPortCallId);
  return (
    <div className="space-y-4 animate-fade-in min-w-0">
      <div className="card">
        <div className="px-5 py-4 border-b border-line">
          <button className="btn-ghost btn-sm -ml-2 mb-2 lg:hidden" onClick={onBack}><ArrowLeft size={14} />Inbox</button>
          <div className="flex items-start gap-3">
            <Avatar initials={email.from.split(' ').filter(w => /^[A-Z]/.test(w)).slice(-2).map(w => w[0]).join('')} size={36} />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold font-sans leading-snug">{email.subject}</h2>
              <p className="text-xs text-slate mt-0.5 truncate">{email.from} &lt;{email.fromEmail}&gt; · {email.fromCompany}</p>
              <p className="text-2xs text-slate">To {email.to} · {fmtTimestamp(email.receivedAt)}</p>
            </div>
            <span className={`badge ${TYPE_TONE[email.type]} shrink-0`}>{TYPE_LABEL[email.type]}</span>
          </div>
        </div>
        <pre className="px-5 py-4 whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-graphite overflow-x-auto max-h-[28rem] scrollbar-thin">{email.body}</pre>
        {email.type === 'crew-change' && <p className="px-5 pb-3 text-2xs text-slate flex items-center gap-1"><Paperclip size={11} />Crew documents follow by courier (not attached)</p>}
      </div>

      {email.status === 'Processed' && email.type !== 'status-inquiry' && (
        <Note tone="success" icon={<CheckCircle2 size={15} />}>
          Processed by {email.processedBy} · {fmtTimestamp(email.processedAt!)}
          {email.createdTaskIds && ` · ${email.createdTaskIds.length} task(s) created`}
          {linked && <LinkToCall id={linked.id} label={linked.vesselName} tab={email.type === 'nomination' ? 'overview' : 'tasks'} />}
        </Note>
      )}

      {email.status === 'New' && email.type === 'nomination' && <NominationProcessor email={email} />}
      {email.status === 'New' && (email.type === 'crew-change' || email.type === 'provisions') && <TaskProcessor email={email} />}
      {email.type === 'status-inquiry' && <InquiryProcessor email={email} />}
    </div>
  );
}

function LinkToCall({ id, label, tab }: { id: string; label: string; tab?: string }) {
  const { navigate } = useDemoStore();
  return <button className="ml-2 text-harbor-600 font-semibold hover:underline inline-flex items-center gap-1" onClick={() => navigate('port-call-detail', id, tab)}>Open {label}<ExternalLink size={12} /></button>;
}

// ── Nomination → port call ───────────────────────────────────────────────────
function NominationProcessor({ email }: { email: DemoEmail }) {
  const { state, dispatch, navigate } = useDemoStore();
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const [ext, setExt] = useState<NominationExtraction | null>(null);
  const [d, setD] = useState<NominationDraft | null>(null);
  const [errors, setErrors] = useState<NominationErrors>({});
  const [submitted, setSubmitted] = useState(false);

  async function extract() {
    const r = await run('x', () => ai.extractNomination(email, state));
    if (r) { setExt(r); setD(r.draft); }
  }
  useEffect(() => { if (submitted && d) setErrors(validateNomination(d)); }, [d, submitted]);

  if (busy === 'x') return (
    <div className="card p-5 space-y-3">
      <p className="text-sm font-semibold flex items-center gap-2"><Sparkles size={15} className="text-teal-500 animate-pulse" />Reading nomination…</p>
      <div className="grid sm:grid-cols-3 gap-3">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
    </div>
  );

  if (!ext || !d) return (
    <div className="card px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div>
        <p className="text-sm font-semibold">Create a port call from this nomination</p>
        <p className="text-xs text-slate">Fields are extracted from the email for your review. Nothing is saved until you confirm.</p>
      </div>
      <button className="btn-teal shrink-0" onClick={extract}><Sparkles size={15} />Extract port call details</button>
    </div>
  );

  const set = <K extends keyof NominationDraft>(k: K, v: NominationDraft[K]) => setD({ ...d, [k]: v });
  const ev = ext.evidence;
  const err = (k: keyof NominationDraft) => (submitted ? errors[k] : undefined);
  const text = (k: keyof NominationDraft, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label} htmlFor={`n-${k}`} error={err(k)} evidence={ev[k]}>
      <input id={`n-${k}`} className={`input ${err(k) ? 'input-error' : ''}`} value={String(d[k])} onChange={e => set(k, e.target.value as never)} {...extra} />
    </Field>
  );
  const dt = (k: 'eta' | 'etb' | 'etd', label: string) => (
    <Field label={label} htmlFor={`n-${k}`} error={err(k)} evidence={ev[k]}>
      <input id={`n-${k}`} type="datetime-local" className={`input tabular ${err(k) ? 'input-error' : ''}`} value={d[k] ? toInputValue(d[k]) : ''} onChange={e => set(k, fromInputValue(e.target.value))} />
    </Field>
  );
  const toggleService = (s: ServiceKey) => set('services', d.services.includes(s) ? d.services.filter(x => x !== s) : [...d.services, s]);

  function create() {
    setSubmitted(true);
    const e = validateNomination(d!);
    setErrors(e);
    if (Object.keys(e).length) { showToast('error', 'Please fix the highlighted fields'); return; }
    const at = nowIso();
    const { portCall, vessel } = buildPortCallFromNomination(d!, state, { vesselId: ext!.matchedVesselId, ownerId: ext!.matchedOwnerId, chartererId: ext!.matchedChartererId }, at);
    if (state.portCalls.some(p => p.id === portCall.id)) { showToast('warning', 'Port call already exists', `${portCall.vesselName} at ${portCall.port} is already on the board.`); return; }
    dispatch({ type: 'CREATE_PORT_CALL', emailId: email.id, portCall, vessel, at });
    showToast('success', 'Port call created', `${portCall.vesselName} — ${portCall.ref} is now on the board.`);
    navigate('port-call-detail', portCall.id);
  }

  return (
    <div className="card animate-fade-up">
      <div className="card-header">
        <span className="card-title flex items-center gap-2"><Ship size={15} className="text-teal-600" />Review extracted port call</span>
        <SimBadge />
      </div>
      <div className="p-5 space-y-5">
        {ext.notes.length > 0 && <Note tone="info"><ul className="space-y-0.5">{ext.notes.map(n => <li key={n}>{n}</li>)}</ul></Note>}
        <p className="text-xs text-slate">The line under each field (↳) is the exact source text from the email. Edit anything that is wrong.</p>
        <fieldset>
          <legend className="eyebrow mb-2">Vessel</legend>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {text('vesselName', 'Vessel name')}
            {text('imo', 'IMO-style no.', { inputMode: 'numeric', maxLength: 7 })}
            <Field label="Type" htmlFor="n-type" evidence={ev.vesselType}>
              <select id="n-type" className="input" value={d.vesselType} onChange={e => set('vesselType', e.target.value as VesselType)}>
                {['Bulk Carrier', 'Tanker', 'Container', 'General Cargo'].map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            {text('flag', 'Flag')}
            {text('dwt', 'DWT (t)')}
            {text('gt', 'GT')}
            {text('nrt', 'NRT')}
            {text('loa', 'LOA (m)')}
          </div>
        </fieldset>
        <fieldset>
          <legend className="eyebrow mb-2">Call</legend>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Port" htmlFor="n-port" evidence={ev.port}>
              <select id="n-port" className="input" value={d.port} onChange={e => set('port', e.target.value as PortName)}>
                {['Alexandria', 'Damietta', 'Port Said', 'Dubai'].map(p => <option key={p}>{p}</option>)}
              </select>
            </Field>
            {text('purpose', 'Operation')}
            {text('cargoQty', 'Cargo quantity')}
            {text('cargo', 'Cargo')}
            {dt('eta', 'ETA (LT)')}
            {dt('etb', 'ETB (LT)')}
            {dt('etd', 'ETD (LT)')}
            {text('charterer', 'Charterers')}
          </div>
        </fieldset>
        <fieldset>
          <legend className="eyebrow mb-2">Services & Suez transit</legend>
          <div className="flex flex-wrap gap-2 mb-1">
            {([['full-agency', 'Full agency'], ['suez-transit', 'Suez transit'], ['husbandry', 'Husbandry']] as [ServiceKey, string][]).map(([k, l]) => (
              <label key={k} className={`btn btn-sm border cursor-pointer ${d.services.includes(k) ? 'bg-teal-50 border-teal-400 text-teal-700' : 'bg-white border-line text-slate'}`}>
                <input type="checkbox" className="sr-only" checked={d.services.includes(k)} onChange={() => toggleService(k)} />{d.services.includes(k) && <CheckCircle2 size={12} />}{l}
              </label>
            ))}
          </div>
          {ev.services && <p className="text-2xs text-slate font-mono mb-3 truncate">↳ {ev.services}</p>}
          {submitted && errors.services && <p className="text-xs text-critical mb-2">{errors.services}</p>}
          {d.services.includes('suez-transit') && (
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Direction" htmlFor="n-dir" error={err('suezDirection')} evidence={ev.suezDirection}>
                <select id="n-dir" className="input" value={d.suezDirection} onChange={e => set('suezDirection', e.target.value as NominationDraft['suezDirection'])}>
                  <option value="">—</option><option>Southbound</option><option>Northbound</option>
                </select>
              </Field>
              <Field label="Condition" htmlFor="n-cond">
                <select id="n-cond" className="input" value={d.suezCondition} onChange={e => set('suezCondition', e.target.value as 'Laden' | 'Ballast')}>
                  <option>Ballast</option><option>Laden</option>
                </select>
              </Field>
              <Field label="Requested convoy date" htmlFor="n-conv" error={err('suezConvoyDate')} hint="Sample convoy 03:00 LT, cut-off 5 h before">
                <input id="n-conv" type="date" className="input" value={d.suezConvoyDate} onChange={e => set('suezConvoyDate', e.target.value)} />
              </Field>
            </div>
          )}
        </fieldset>
        <fieldset>
          <legend className="eyebrow mb-2">Owner</legend>
          <div className="grid sm:grid-cols-3 gap-3">
            {text('ownerName', 'Owners')}
            {text('ownerContact', 'Contact')}
            {text('ownerEmail', 'Email')}
          </div>
        </fieldset>
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line">
          <button className="btn-teal" onClick={create}><CheckCircle2 size={15} />Confirm & create port call</button>
          <button className="btn-ghost" onClick={() => { setExt(null); setD(null); setSubmitted(false); }}>Cancel</button>
          <span className="text-xs text-slate ml-auto">ETA {fmtLt(d.eta)} · ETB {fmtLt(d.etb)} · ETD {fmtLt(d.etd)} LT</span>
        </div>
      </div>
    </div>
  );
}

// ── Husbandry email → tasks ──────────────────────────────────────────────────
function TaskProcessor({ email }: { email: DemoEmail }) {
  const { state, dispatch, navigate } = useDemoStore();
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const pc = state.portCalls.find(p => email.fromCompany.includes(p.vesselName) || email.subject.includes(p.vesselName));
  const [items, setItems] = useState<(TaskSuggestion & { include: boolean })[] | null>(null);

  if (!pc) return (
    <Note tone="warning">
      There is no port call for <b>{email.fromCompany}</b> yet, so these requests have nowhere to attach.
      <button className="ml-2 text-harbor-600 font-semibold hover:underline" onClick={() => navigate('email-inbox', 'em-nomination')}>Process the nomination first</button>
    </Note>
  );

  async function extract() {
    const r = await run('x', () => ai.extractTasks(email, pc!, state.staff));
    if (r) setItems(r.map(t => ({ ...t, include: true })));
  }

  if (busy === 'x') return <div className="card p-5 space-y-3"><p className="text-sm font-semibold flex items-center gap-2"><Sparkles size={15} className="text-teal-500 animate-pulse" />Turning the request into tasks…</p><Skeleton className="h-14" /><Skeleton className="h-14" /></div>;

  if (!items) return (
    <div className="card px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div>
        <p className="text-sm font-semibold">Turn this request into tracked tasks</p>
        <p className="text-xs text-slate">For {pc.vesselName} ({pc.ref}). Owners and due times are proposed from desk rules — you confirm.</p>
      </div>
      <button className="btn-teal shrink-0" onClick={extract}><ListChecks size={15} />Extract tasks</button>
    </div>
  );

  const upd = (i: number, patch: Partial<TaskSuggestion & { include: boolean }>) => setItems(items.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const chosen = items.filter(t => t.include);

  function create() {
    if (!chosen.length) { showToast('warning', 'Select at least one task'); return; }
    if (chosen.some(t => !t.title.trim())) { showToast('error', 'Every task needs a title'); return; }
    const tasks: Task[] = chosen.map(t => ({
      id: uid('tsk'), portCallId: pc!.id, vesselName: pc!.vesselName, category: t.category, title: t.title.trim(), description: t.description,
      assigneeId: t.assigneeId, dueAt: t.dueAt, priority: t.priority, status: 'Open', createdFrom: 'email', sourceEmailId: email.id,
      etbOffsetHours: t.etbOffsetHours, rule: t.rule,
    }));
    dispatch({ type: 'CREATE_TASKS', tasks, emailId: email.id, at: nowIso() });
    showToast('success', `${tasks.length} task${tasks.length === 1 ? '' : 's'} created`, `Tracked on ${pc!.vesselName} with owners and due times.`);
  }

  return (
    <div className="card animate-fade-up">
      <div className="card-header"><span className="card-title flex items-center gap-2"><ListChecks size={15} className="text-teal-600" />Review proposed tasks — {pc.vesselName}</span><SimBadge /></div>
      <ul className="divide-y divide-line">
        {items.map((t, i) => (
          <li key={i} className={`px-5 py-4 transition-opacity ${t.include ? '' : 'opacity-50'}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" className="mt-2.5 w-4 h-4 accent-teal-600" checked={t.include} onChange={e => upd(i, { include: e.target.checked })} aria-label="Include task" />
              <div className="flex-1 min-w-0 space-y-2.5">
                <input className="input font-medium" value={t.title} onChange={e => upd(i, { title: e.target.value })} aria-label="Task title" />
                <p className="text-xs text-slate">{t.description}</p>
                <div className="grid sm:grid-cols-3 gap-2.5">
                  <Field label="Owner"><select className="input" value={t.assigneeId} onChange={e => upd(i, { assigneeId: e.target.value })}>{state.staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.desk}</option>)}</select></Field>
                  <Field label="Due (LT)"><input type="datetime-local" className="input" value={toInputValue(t.dueAt)} onChange={e => upd(i, { dueAt: fromInputValue(e.target.value), etbOffsetHours: undefined })} /></Field>
                  <Field label="Priority"><select className="input" value={t.priority} onChange={e => upd(i, { priority: e.target.value as Task['priority'] })}>{['High', 'Medium', 'Low'].map(p => <option key={p}>{p}</option>)}</select></Field>
                </div>
                <p className="text-2xs text-slate">Rule: {t.rule}</p>
                <div className="text-2xs font-mono text-slate bg-cloud/70 rounded px-2.5 py-1.5 space-y-0.5">{t.evidence.map(e => <p key={e} className="truncate">↳ {e}</p>)}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div className="px-5 py-3 border-t border-line flex flex-wrap gap-2 items-center">
        <button className="btn-teal" onClick={create}><CheckCircle2 size={15} />Create {chosen.length} task{chosen.length === 1 ? '' : 's'}</button>
        <button className="btn-ghost" onClick={() => setItems(null)}>Cancel</button>
      </div>
    </div>
  );
}

function InquiryProcessor({ email }: { email: DemoEmail }) {
  const { state, navigate } = useDemoStore();
  const pc = state.portCalls.find(p => email.subject.includes(p.vesselName));
  const reply = state.clientUpdates.find(u => u.inReplyToEmailId === email.id && u.status === 'Sent');
  if (reply) return <Note tone="success" icon={<CheckCircle2 size={15} />}>Answered by owner update “{reply.subject}” · {fmtTimestamp(reply.sentAt!)} · approved by {reply.approvedBy}{pc && <LinkToCall id={pc.id} label="updates" tab="updates" />}</Note>;
  if (!pc) return <Note tone="warning">No port call for this vessel yet. <button className="text-harbor-600 font-semibold hover:underline" onClick={() => navigate('email-inbox', 'em-nomination')}>Process the nomination first</button></Note>;
  return (
    <div className="card px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div>
        <p className="text-sm font-semibold flex items-center gap-2"><UserRound size={15} />The owner is asking where the vessel and money stand</p>
        <p className="text-xs text-slate">Draft a reply from live call data ({pc.ref}). It will be marked as answered once you approve and send it.</p>
      </div>
      <button className="btn-teal shrink-0" onClick={() => navigate('port-call-detail', pc.id, 'updates')}><Mail size={15} />Draft reply from call data</button>
    </div>
  );
}
