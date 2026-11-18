// Pure state transitions for the demo. Every user-visible change goes through
// here, and each one appends an audit entry to the activity log.
import { buildInitialState } from '@/lib/sampleData';
import { editLine, pdaTotal } from '@/services/pdaEngine';
import { checkTransit, type ScheduleAssessment } from '@/services/scheduleRules';
import { addHours, fmtHoursDelta, fmtLt } from '@/lib/time';
import { num, usd } from '@/lib/format';
import type {
  ActivityEvent, ClientUpdate, DemoState, FDA, PDA, PortCall, Schedule, Staff, Task, TaskStatus, Vessel, Warning,
} from '@/types';

// ── Actions ───────────────────────────────────────────────────────────────────
export type Action =
  | { type: 'LOAD'; state: DemoState }
  | { type: 'RESET' }
  | { type: 'SET_USER'; userId: string }
  | { type: 'CREATE_PORT_CALL'; emailId?: string; portCall: PortCall; vessel?: Vessel; at: string }
  | { type: 'SET_PDA'; pda: PDA; at: string }
  | { type: 'EDIT_PDA_LINE'; portCallId: string; lineId: string; quantity: number; rate: number; note: string; at: string }
  | { type: 'APPROVE_PDA'; portCallId: string; at: string }
  | { type: 'SEND_PDA'; portCallId: string; at: string }
  | { type: 'CREATE_TASKS'; tasks: Task[]; emailId?: string; at: string }
  | { type: 'SET_TASK_STATUS'; taskId: string; status: TaskStatus; at: string }
  | { type: 'APPLY_SCHEDULE'; portCallId: string; schedule: Schedule; reason: string; assessment: ScheduleAssessment; at: string }
  | { type: 'REBOOK_TRANSIT'; portCallId: string; at: string }
  | { type: 'SET_WARNING_STATUS'; warningId: string; status: Warning['status']; at: string }
  | { type: 'CREATE_UPDATE_DRAFT'; update: ClientUpdate }
  | { type: 'EDIT_UPDATE'; id: string; subject: string; body: string }
  | { type: 'SEND_UPDATE'; id: string; at: string }
  | { type: 'DISCARD_UPDATE'; id: string; at: string }
  | { type: 'LOAD_FDA'; fda: FDA; at: string }
  | { type: 'RECONCILE_FDA'; portCallId: string; at: string };

let seq = 0;
export function uid(prefix: string): string {
  seq = (seq + 1) % 1e6;
  return `${prefix}-${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function currentUserOf(s: DemoState): Staff {
  return s.staff.find(x => x.id === s.currentUserId) ?? s.staff[0];
}

function log(s: DemoState, at: string, e: Omit<ActivityEvent, 'id' | 'timestamp' | 'userId' | 'user'>): ActivityEvent {
  const u = currentUserOf(s);
  return { id: uid('act'), timestamp: at, userId: u.id, user: u.name, ...e };
}

function patchCall(s: DemoState, id: string, patch: Partial<PortCall>): PortCall[] {
  return s.portCalls.map(pc => (pc.id === id ? { ...pc, ...patch } : pc));
}

// ── Reducer ───────────────────────────────────────────────────────────────────
export function reducer(s: DemoState, a: Action): DemoState {
  switch (a.type) {
    case 'LOAD': return a.state;
    case 'RESET': return buildInitialState();

    case 'SET_USER': {
      if (!s.staff.some(x => x.id === a.userId) || a.userId === s.currentUserId) return s;
      const next = { ...s, currentUserId: a.userId };
      const u = currentUserOf(next);
      return { ...next, activity: [log(next, new Date().toISOString(), { action: 'Signed in', category: 'system', entityLabel: u.name, details: `Working as ${u.title} (${u.desk} desk).` }), ...s.activity] };
    }

    case 'CREATE_PORT_CALL': {
      const pc = a.portCall;
      if (s.portCalls.some(p => p.id === pc.id)) return s;
      const ev = log(s, a.at, {
        action: 'Port call created', category: 'port-call', portCallId: pc.id, entityLabel: pc.vesselName,
        details: `${pc.ref} — ${pc.port}, ${pc.purpose}${pc.cargo ? `, ${pc.cargoQty} ${pc.cargo}` : ''}. ETA ${fmtLt(pc.eta)} LT. Created from ${a.emailId ? 'nomination email after operator review' : 'manual entry'}.`,
        changes: [
          { field: 'ETA', from: '—', to: `${fmtLt(pc.eta)} LT` },
          { field: 'ETB', from: '—', to: `${fmtLt(pc.etb)} LT` },
          { field: 'ETD', from: '—', to: `${fmtLt(pc.etd)} LT` },
          ...(pc.suez ? [{ field: 'Suez convoy requested', from: '—', to: `${fmtLt(pc.suez.convoy)} LT` }] : []),
        ],
      });
      return {
        ...s,
        vessels: a.vessel && !s.vessels.some(v => v.id === a.vessel!.id) ? [...s.vessels, a.vessel] : s.vessels,
        portCalls: [...s.portCalls, pc],
        emails: s.emails.map(e => (e.id === a.emailId ? { ...e, status: 'Processed', processedAt: a.at, processedBy: currentUserOf(s).name, linkedPortCallId: pc.id } : e)),
        activity: [ev, ...s.activity],
      };
    }

    case 'SET_PDA': {
      const pc = s.portCalls.find(p => p.id === a.pda.portCallId);
      const existing = s.pdas[a.pda.portCallId];
      if (!pc || (existing && existing.status !== 'Draft')) return s;
      const ev = log(s, a.at, {
        action: existing ? 'PDA draft regenerated' : 'PDA draft generated', category: 'pda', portCallId: pc.id, entityLabel: pc.vesselName,
        details: `${a.pda.lineItems.length} lines, total ${usd(pdaTotal(a.pda))}. Sources: tariff + ${a.pda.basedOn.length} past call(s). Awaiting D/A review.`,
      });
      return { ...s, pdas: { ...s.pdas, [pc.id]: a.pda }, activity: [ev, ...s.activity] };
    }

    case 'EDIT_PDA_LINE': {
      const pda = s.pdas[a.portCallId];
      if (!pda || pda.status !== 'Draft') return s;
      const li = pda.lineItems.find(l => l.id === a.lineId);
      if (!li || !li.editable) return s;
      const user = currentUserOf(s);
      const updated = editLine(li, a.quantity, a.rate, a.note, user.name);
      const nextPda = { ...pda, lineItems: pda.lineItems.map(l => (l.id === li.id ? updated : l)) };
      const pc = s.portCalls.find(p => p.id === a.portCallId)!;
      const ev = log(s, a.at, {
        action: 'PDA line edited', category: 'pda', portCallId: pc.id, entityLabel: pc.vesselName,
        details: `${li.description}: ${a.note}. PDA total ${usd(pdaTotal(pda))} → ${usd(pdaTotal(nextPda))}.`,
        changes: [
          ...(li.quantity !== a.quantity ? [{ field: `${li.description} — quantity`, from: `${num(li.quantity)} ${li.unit}`, to: `${num(a.quantity)} ${li.unit}` }] : []),
          ...(li.rate !== a.rate ? [{ field: `${li.description} — rate`, from: usd(li.rate), to: usd(a.rate) }] : []),
          { field: `${li.description} — amount`, from: usd(li.amount), to: usd(updated.amount) },
        ],
      });
      return { ...s, pdas: { ...s.pdas, [pc.id]: nextPda }, activity: [ev, ...s.activity] };
    }

    case 'APPROVE_PDA': {
      const pda = s.pdas[a.portCallId];
      const user = currentUserOf(s);
      if (!pda || pda.status !== 'Draft' || user.desk !== 'D/A') return s;
      const pc = s.portCalls.find(p => p.id === a.portCallId)!;
      const edited = pda.lineItems.filter(l => l.edited).length;
      const ev = log(s, a.at, {
        action: 'PDA approved', category: 'pda', portCallId: pc.id, entityLabel: pc.vesselName,
        details: `Approved at ${usd(pdaTotal(pda))} (${pda.lineItems.length} lines, ${edited} edited). Not yet sent to owner.`,
        changes: [{ field: 'PDA status', from: 'Draft', to: 'Approved' }, ...(pc.status === 'Nominated' ? [{ field: 'Port call status', from: 'Nominated', to: 'Pre-arrival' }] : [])],
      });
      return {
        ...s,
        pdas: { ...s.pdas, [pc.id]: { ...pda, status: 'Approved', approvedAt: a.at, approvedBy: user.name } },
        portCalls: pc.status === 'Nominated' ? patchCall(s, pc.id, { status: 'Pre-arrival', nextStep: 'Pre-arrival: confirm berth line-up, pilot and tugs; send approved PDA to owner.' }) : s.portCalls,
        activity: [ev, ...s.activity],
      };
    }

    case 'SEND_PDA': {
      const pda = s.pdas[a.portCallId];
      if (!pda || pda.status !== 'Approved') return s;
      const pc = s.portCalls.find(p => p.id === a.portCallId)!;
      const ev = log(s, a.at, {
        action: 'PDA sent to owner (simulated)', category: 'pda', portCallId: pc.id, entityLabel: pc.vesselName,
        details: `Approved PDA ${usd(pdaTotal(pda))} recorded as sent to ${pc.ownerName}. No external email was sent (demo).`,
        changes: [{ field: 'PDA status', from: 'Approved', to: 'Sent' }],
      });
      return { ...s, pdas: { ...s.pdas, [pc.id]: { ...pda, status: 'Sent', sentAt: a.at, sentBy: currentUserOf(s).name } }, activity: [ev, ...s.activity] };
    }

    case 'CREATE_TASKS': {
      if (!a.tasks.length) return s;
      const events = a.tasks.map(t => log(s, a.at, {
        action: 'Task created', category: 'task', portCallId: t.portCallId, entityLabel: t.vesselName,
        details: `${t.title} — assigned to ${s.staff.find(x => x.id === t.assigneeId)?.name ?? '—'}, due ${fmtLt(t.dueAt)} LT${a.emailId ? ' (from email, reviewed by operator)' : ''}.`,
      }));
      return {
        ...s,
        tasks: [...s.tasks, ...a.tasks],
        emails: s.emails.map(e => (e.id === a.emailId ? { ...e, status: 'Processed', processedAt: a.at, processedBy: currentUserOf(s).name, linkedPortCallId: a.tasks[0].portCallId, createdTaskIds: a.tasks.map(t => t.id) } : e)),
        activity: [...events.reverse(), ...s.activity],
      };
    }

    case 'SET_TASK_STATUS': {
      const t = s.tasks.find(x => x.id === a.taskId);
      if (!t || t.status === a.status) return s;
      const user = currentUserOf(s);
      const ev = log(s, a.at, {
        action: a.status === 'Done' ? 'Task completed' : 'Task status changed', category: 'task', portCallId: t.portCallId, entityLabel: t.vesselName,
        details: t.title, changes: [{ field: 'Status', from: t.status, to: a.status }],
      });
      return {
        ...s,
        tasks: s.tasks.map(x => (x.id === t.id ? { ...x, status: a.status, completedAt: a.status === 'Done' ? a.at : undefined, completedBy: a.status === 'Done' ? user.name : undefined } : x)),
        activity: [ev, ...s.activity],
      };
    }

    case 'APPLY_SCHEDULE': {
      const pc = s.portCalls.find(p => p.id === a.portCallId);
      if (!pc) return s;
      const as = a.assessment;
      const missed = !!as.transitAfter?.missed;
      const newWarnings: Warning[] = as.warnings.map(w => ({ ...w, id: uid('wrn'), triggeredAt: a.at, status: 'Open' }));
      const kinds = new Set(newWarnings.map(w => w.kind));
      const supersededWarnings = s.warnings.map(w =>
        w.portCallId === pc.id && w.status !== 'Resolved' && kinds.has(w.kind)
          ? { ...w, status: 'Resolved' as const, resolution: 'Superseded by a later schedule change' } : w);
      const shiftMap = new Map(as.taskShifts.map(x => [x.taskId, x.to]));
      const events: ActivityEvent[] = [
        log(s, a.at, {
          action: 'Schedule changed', category: 'schedule', portCallId: pc.id, entityLabel: pc.vesselName,
          details: `Berthing ${fmtHoursDelta(as.deltaEtbHours)}. Reason: ${a.reason}. ${as.summary}`,
          changes: [
            ...(pc.eta !== a.schedule.eta ? [{ field: 'ETA', from: `${fmtLt(pc.eta)} LT`, to: `${fmtLt(a.schedule.eta)} LT` }] : []),
            ...(pc.etb !== a.schedule.etb ? [{ field: 'ETB', from: `${fmtLt(pc.etb)} LT`, to: `${fmtLt(a.schedule.etb)} LT` }] : []),
            ...(pc.etd !== a.schedule.etd ? [{ field: 'ETD', from: `${fmtLt(pc.etd)} LT`, to: `${fmtLt(a.schedule.etd)} LT` }] : []),
          ],
        }),
        ...newWarnings.map(w => log(s, a.at, {
          action: 'Warning raised', category: 'warning' as const, portCallId: pc.id, entityLabel: pc.vesselName,
          details: `${w.title}${w.costImpact !== undefined ? ` (${usd(w.costImpact)})` : ''}. Rule: ${w.rule}.`,
        })),
        ...as.taskShifts.map(x => log(s, a.at, {
          action: 'Task rescheduled', category: 'task' as const, portCallId: pc.id, entityLabel: pc.vesselName,
          details: `${x.title} moved with ETB.`, changes: [{ field: 'Due', from: `${fmtLt(x.from)} LT`, to: `${fmtLt(x.to)} LT` }],
        })),
      ];
      return {
        ...s,
        portCalls: patchCall(s, pc.id, {
          ...a.schedule,
          delayReason: a.reason,
          nextStep: missed ? 'Rebook Suez convoy and send owner an update.' : 'Send owner an update on the revised schedule.',
          suez: pc.suez && missed && pc.suez.status !== 'Rebooking Requested' ? { ...pc.suez, status: 'At Risk' } : pc.suez,
        }),
        tasks: s.tasks.map(t => (shiftMap.has(t.id) ? { ...t, dueAt: shiftMap.get(t.id)! } : t)),
        warnings: [...newWarnings, ...supersededWarnings],
        activity: [...events.reverse(), ...s.activity],
      };
    }

    case 'REBOOK_TRANSIT': {
      const pc = s.portCalls.find(p => p.id === a.portCallId);
      if (!pc?.suez) return s;
      const check = checkTransit(pc, pc.suez);
      if (!check.missed || !check.nextConvoy || !check.nextCutoff) return s;
      const suezDesk = s.staff.find(x => x.desk === 'Suez') ?? currentUserOf(s);
      const task: Task = {
        id: uid('tsk'), portCallId: pc.id, vesselName: pc.vesselName, category: 'transit',
        title: `Confirm rebooked Suez convoy ${fmtLt(check.nextConvoy)} LT`,
        description: `Rebooking requested from ${fmtLt(pc.suez.convoy)} to ${fmtLt(check.nextConvoy)} LT. Confirm with canal liaison and resubmit transit documents.`,
        assigneeId: suezDesk.id, dueAt: addHours(check.nextCutoff, -12), priority: 'High', status: 'Open', createdFrom: 'manual',
        rule: 'Transit rebooking → Suez desk · due cut-off − 12 h',
      };
      const resolution = `Rebooking requested to convoy ${fmtLt(check.nextConvoy)} LT`;
      const ev = log(s, a.at, {
        action: 'Suez rebooking requested', category: 'transit', portCallId: pc.id, entityLabel: pc.vesselName,
        details: `Internal rebooking request logged; awaiting confirmation via the Suez desk (no booking system is connected in this demo).`,
        changes: [{ field: 'Convoy', from: `${fmtLt(pc.suez.convoy)} LT`, to: `${fmtLt(check.nextConvoy)} LT` }, { field: 'Transit status', from: pc.suez.status, to: 'Rebooking Requested' }],
      });
      return {
        ...s,
        portCalls: patchCall(s, pc.id, {
          suez: { ...pc.suez, originalConvoy: pc.suez.originalConvoy ?? pc.suez.convoy, convoy: check.nextConvoy, cutoff: check.nextCutoff, status: 'Rebooking Requested' },
          nextStep: 'Send owner an update; Suez desk to confirm the rebooked convoy.',
        }),
        warnings: s.warnings.map(w => (w.portCallId === pc.id && w.kind === 'transit-risk' && w.status !== 'Resolved' ? { ...w, status: 'Resolved', resolution } : w)),
        tasks: [...s.tasks, task],
        activity: [ev, ...s.activity],
      };
    }

    case 'SET_WARNING_STATUS': {
      const w = s.warnings.find(x => x.id === a.warningId);
      if (!w || w.status === a.status) return s;
      const ev = log(s, a.at, {
        action: `Warning ${a.status.toLowerCase()}`, category: 'warning', portCallId: w.portCallId, entityLabel: w.vesselName,
        details: w.title, changes: [{ field: 'Status', from: w.status, to: a.status }],
      });
      return { ...s, warnings: s.warnings.map(x => (x.id === w.id ? { ...x, status: a.status } : x)), activity: [ev, ...s.activity] };
    }

    case 'CREATE_UPDATE_DRAFT': {
      const u = a.update;
      const ev = log(s, u.createdAt, {
        action: 'Client update drafted', category: 'client-update', portCallId: u.portCallId, entityLabel: u.vesselName,
        details: `Draft "${u.subject}" generated from current port-call data. Awaiting operator review — not sent.`,
      });
      return {
        ...s,
        clientUpdates: [u, ...s.clientUpdates.filter(x => !(x.portCallId === u.portCallId && x.status === 'Draft'))],
        activity: [ev, ...s.activity],
      };
    }

    case 'EDIT_UPDATE':
      return { ...s, clientUpdates: s.clientUpdates.map(u => (u.id === a.id && u.status === 'Draft' ? { ...u, subject: a.subject, body: a.body, edited: true } : u)) };

    case 'DISCARD_UPDATE': {
      const u = s.clientUpdates.find(x => x.id === a.id);
      if (!u || u.status !== 'Draft') return s;
      const ev = log(s, a.at, { action: 'Client update discarded', category: 'client-update', portCallId: u.portCallId, entityLabel: u.vesselName, details: u.subject });
      return { ...s, clientUpdates: s.clientUpdates.filter(x => x.id !== a.id), activity: [ev, ...s.activity] };
    }

    case 'SEND_UPDATE': {
      const u = s.clientUpdates.find(x => x.id === a.id);
      if (!u || u.status !== 'Draft') return s;
      const user = currentUserOf(s);
      const owner = s.companies.find(c => c.id === u.ownerId);
      const events = [
        log(s, a.at, { action: 'Client update approved', category: 'client-update', portCallId: u.portCallId, entityLabel: u.vesselName, details: `"${u.subject}" approved by ${user.name}${u.edited ? ' after edits' : ''}.` }),
        log(s, a.at, { action: 'Client update sent (simulated)', category: 'client-update', portCallId: u.portCallId, entityLabel: u.vesselName, details: `Recorded as sent to ${owner?.contact} (${owner?.name}). No external email was sent. Now visible in the owner's portal.` }),
      ];
      return {
        ...s,
        clientUpdates: s.clientUpdates.map(x => (x.id === u.id ? { ...x, status: 'Sent', sentAt: a.at, approvedBy: user.name } : x)),
        emails: s.emails.map(e => (e.id === u.inReplyToEmailId ? { ...e, status: 'Processed', processedAt: a.at, processedBy: user.name, linkedPortCallId: u.portCallId } : e)),
        portCalls: patchCall(s, u.portCallId, { nextStep: u.snapshot.nextStep }),
        activity: [...events.reverse(), ...s.activity],
      };
    }

    case 'LOAD_FDA': {
      const pc = s.portCalls.find(p => p.id === a.fda.portCallId);
      if (!pc || s.fdas[pc.id]) return s;
      const ev = log(s, a.at, {
        action: 'Final invoices loaded (FDA)', category: 'fda', portCallId: pc.id, entityLabel: pc.vesselName,
        details: `${a.fda.lines.length} sample final invoice lines loaded for reconciliation against the approved PDA.`,
        changes: [{ field: 'Port call status', from: pc.status, to: 'Completed' }],
      });
      return { ...s, fdas: { ...s.fdas, [pc.id]: a.fda }, portCalls: patchCall(s, pc.id, { status: 'Completed', nextStep: 'FDA under reconciliation by the D/A team.' }), activity: [ev, ...s.activity] };
    }

    case 'RECONCILE_FDA': {
      const fda = s.fdas[a.portCallId];
      if (!fda || fda.reconciledAt) return s;
      const pc = s.portCalls.find(p => p.id === a.portCallId)!;
      const ev = log(s, a.at, {
        action: 'FDA reconciliation reviewed', category: 'fda', portCallId: pc.id, entityLabel: pc.vesselName,
        details: 'PDA vs FDA differences reviewed. Unexplained items flagged for invoice query before the FDA goes to the owner.',
      });
      return { ...s, fdas: { ...s.fdas, [pc.id]: { ...fda, reconciledAt: a.at, reconciledBy: currentUserOf(s).name } }, activity: [ev, ...s.activity] };
    }

    default:
      return s;
  }
}
