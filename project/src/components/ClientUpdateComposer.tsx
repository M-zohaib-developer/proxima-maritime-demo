import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Mail, RefreshCw, Send, Sparkles, Trash2 } from 'lucide-react';
import { useDemoStore, uid } from '@/lib/demoStore';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/Modal';
import { Collapsible, EmptyState, Field, Note, SimBadge, SkeletonRows, useBusy } from '@/components/ui';
import { ai } from '@/services/ai';
import { pdaTotal } from '@/services/pdaEngine';
import { vesselOf } from '@/lib/selectors';
import { fmtTimestamp, nowIso } from '@/lib/time';
import type { PortCall } from '@/types';

export default function ClientUpdateComposer({ pc }: { pc: PortCall }) {
  const { state, dispatch, user, navigate } = useDemoStore();
  const { showToast } = useToast();
  const { busy, run } = useBusy();
  const draft = state.clientUpdates.find(u => u.portCallId === pc.id && u.status === 'Draft');
  const sent = state.clientUpdates.filter(u => u.portCallId === pc.id && u.status === 'Sent');
  const owner = state.companies.find(c => c.id === pc.ownerId);
  const inquiry = state.emails.find(e => e.type === 'status-inquiry' && e.status === 'New' && e.body.includes(pc.vesselName));
  const [subject, setSubject] = useState(draft?.subject ?? '');
  const [body, setBody] = useState(draft?.body ?? '');
  const [sources, setSources] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<'send' | 'discard' | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => { setSubject(draft?.subject ?? ''); setBody(draft?.body ?? ''); }, [draft?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    const vessel = vesselOf(state, pc);
    if (!vessel || !owner) return;
    const pda = state.pdas[pc.id];
    const approved = pda && pda.status !== 'Draft' ? pdaTotal(pda) : undefined;
    const res = await run('gen', () => ai.draftClientUpdate({ portCall: pc, vessel, owner, approvedPdaTotal: approved, pdaStatus: pda?.status ?? 'None', operator: user, inquiry }));
    if (!res) return;
    dispatch({
      type: 'CREATE_UPDATE_DRAFT',
      update: { id: uid('upd'), portCallId: pc.id, ownerId: pc.ownerId, vesselName: pc.vesselName, status: 'Draft', subject: res.subject, body: res.body, createdAt: nowIso(), createdBy: user.name, edited: false, snapshot: res.snapshot, inReplyToEmailId: inquiry?.id },
    });
    setSources(res.sources);
    showToast('success', 'Update drafted', 'Review and edit before sending. Nothing has been sent.');
  }

  const dirty = !!draft && (subject !== draft.subject || body !== draft.body);
  const saveEdits = () => { if (draft && dirty) dispatch({ type: 'EDIT_UPDATE', id: draft.id, subject, body }); };
  const errs = { subject: subject.trim().length < 5 ? 'Subject is required' : undefined, body: body.trim().length < 20 ? 'Message is too short' : undefined };

  return (
    <div className="space-y-4">
      {busy === 'gen' ? (
        <div className="card"><div className="card-header"><span className="card-title flex items-center gap-2"><Sparkles size={15} className="text-teal-500" />Drafting from latest port-call data…</span><SimBadge /></div><SkeletonRows rows={6} /></div>
      ) : !draft ? (
        <div className="card">
          <EmptyState icon={<Mail size={18} />} title="No owner update in draft"
            action={<button className="btn-teal" onClick={generate}><Sparkles size={15} />Draft owner update</button>}>
            Drafted from the current schedule, Suez booking, approved PDA and schedule-driven cost changes for {pc.vesselName}. You review and approve before anything is sent.
            {inquiry && <span className="block mt-2 text-harbor-700">Will reply to: “{inquiry.subject}”</span>}
          </EmptyState>
        </div>
      ) : (
        <div className="card animate-fade-up">
          <div className="card-header">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="card-title">Owner update — draft</span>
              <span className="badge bg-warning-light text-warning-dark">Not sent</span>
              <SimBadge />
              {draft.edited || dirty ? <span className="badge bg-harbor-100 text-harbor-700">Edited</span> : null}
            </div>
            <span className="text-2xs text-slate hidden sm:block">To: {owner?.contact} · {owner?.email}</span>
          </div>
          <div className="p-5 space-y-3">
            <Field label="Subject" htmlFor="subj" error={touched ? errs.subject : undefined}>
              <input id="subj" className="input" value={subject} onChange={e => setSubject(e.target.value)} onBlur={saveEdits} />
            </Field>
            <Field label="Message" htmlFor="body" error={touched ? errs.body : undefined}>
              <textarea id="body" rows={20} className="input font-mono text-[12.5px] leading-relaxed" value={body} onChange={e => setBody(e.target.value)} onBlur={saveEdits} />
            </Field>
            {sources.length > 0 && (
              <Collapsible title={<><Sparkles size={14} className="text-teal-500" />Data used for this draft</>}>
                <ul className="text-xs space-y-1 mt-2">{sources.map(s => <li key={s}>• {s}</li>)}</ul>
              </Collapsible>
            )}
            <Note tone="info">Sending is simulated: it records the approved message and shows it in the owner’s portal. No external email is sent.</Note>
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn-teal" onClick={() => { setTouched(true); if (!errs.subject && !errs.body) setConfirm('send'); }}><Send size={15} />Approve & send (simulated)</button>
              <button className="btn-secondary" onClick={generate}><RefreshCw size={14} />Regenerate from latest data</button>
              <button className="btn-ghost text-critical hover:text-critical" onClick={() => setConfirm('discard')}><Trash2 size={14} />Discard</button>
            </div>
          </div>
        </div>
      )}

      {sent.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Sent updates (simulated)</span><button className="btn-ghost btn-sm" onClick={() => navigate('client-portal', pc.ownerId)}><ExternalLink size={13} />See owner view</button></div>
          <ul className="divide-y divide-line">
            {sent.map(u => (
              <li key={u.id} className="px-5 py-3">
                <Collapsible title={<><CheckCircle2 size={14} className="text-success" /><span className="truncate">{u.subject}</span></>} meta={<span className="text-2xs whitespace-nowrap">{fmtTimestamp(u.sentAt!)} · {u.approvedBy}</span>}>
                  <pre className="whitespace-pre-wrap font-mono text-xs text-graphite mt-2">{u.body}</pre>
                </Collapsible>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog open={confirm === 'send'} onClose={() => setConfirm(null)} title="Approve and send this update?" confirmLabel="Approve & send" tone="teal"
        onConfirm={() => {
          if (!draft) return;
          if (dirty) dispatch({ type: 'EDIT_UPDATE', id: draft.id, subject, body });
          dispatch({ type: 'SEND_UPDATE', id: draft.id, at: nowIso() });
          showToast('success', 'Update sent (simulated)', `Logged and visible in ${owner?.name}’s portal.`);
        }}>
        <p>Approving as <b>{user.name}</b>. The message goes to <b>{owner?.contact}</b> ({owner?.name}).</p>
        <p className="text-slate">Demo: the send is recorded in the activity log and the client portal. No email leaves the app.</p>
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'discard'} onClose={() => setConfirm(null)} title="Discard this draft?" confirmLabel="Discard" tone="danger"
        onConfirm={() => { if (draft) dispatch({ type: 'DISCARD_UPDATE', id: draft.id, at: nowIso() }); }}>
        <p>The draft will be removed. This is recorded in the activity log.</p>
      </ConfirmDialog>
    </div>
  );
}
