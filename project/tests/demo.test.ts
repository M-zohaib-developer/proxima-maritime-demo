// Unit + scenario tests for the deterministic demo logic.
// Run: npm test   (Node built-in test runner, no extra dependencies)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInitialState, EMAILS, DEMO_OWNER_ID } from '@/lib/sampleData';
import { reducer, type Action } from '@/lib/demoReducer';
import { createSimulatedAI, draftClientUpdateSync } from '@/services/ai/simulated';
import { buildPortCallFromNomination, validateNomination } from '@/services/portCalls';
import { draftPdaLines, pdaTotal } from '@/services/pdaEngine';
import { assessScheduleChange, convoyFor } from '@/services/scheduleRules';
import { compareHistorical, comparePdaFda, sampleFinalInvoices } from '@/services/fdaService';
import { getOwnerPortal } from '@/services/clientPortal';
import { addHours } from '@/lib/time';
import { sumMoney, round2, lineAmount } from '@/lib/format';
import type { DemoState, PDA, Task } from '@/types';

const ai = createSimulatedAI(0);
const AT = '2026-11-18T12:00:00.000Z';
const run = (s: DemoState, ...actions: Action[]) => actions.reduce(reducer, s);
const asUser = (s: DemoState, id: string) => reducer(s, { type: 'SET_USER', userId: id });

async function withNileTrader() {
  let s = buildInitialState();
  const email = s.emails.find(e => e.id === 'em-nomination')!;
  const ext = await ai.extractNomination(email, s);
  const { portCall, vessel } = buildPortCallFromNomination(ext.draft, s, { vesselId: ext.matchedVesselId, ownerId: ext.matchedOwnerId, chartererId: ext.matchedChartererId }, AT);
  s = reducer(s, { type: 'CREATE_PORT_CALL', emailId: email.id, portCall, vessel, at: AT });
  return { s, pcId: portCall.id, ext };
}

test('sample data: 5–8 calls, fictional IMO numbers fail the check digit, 4 emails, 3 past calls', () => {
  const s = buildInitialState();
  assert.ok(s.portCalls.length >= 5 && s.portCalls.length <= 8);
  assert.ok(s.vessels.length >= 5 && s.vessels.length <= 8);
  assert.equal(s.emails.length, 4);
  assert.equal(s.historical.length, 3);
  for (const v of s.vessels) {
    const d = v.imo.split('').map(Number);
    const check = d.slice(0, 6).reduce((acc, x, i) => acc + x * (7 - i), 0) % 10;
    assert.notEqual(check, d[6], `${v.name} IMO ${v.imo} must not be a valid IMO`);
  }
  const ports = new Set(s.portCalls.map(p => p.port));
  for (const p of ['Alexandria', 'Damietta', 'Port Said', 'Dubai']) assert.ok(ports.has(p as never));
});

test('money helpers sum in cents', () => {
  assert.equal(sumMoney([0.1, 0.2]), 0.3);
  assert.equal(lineAmount(3, 1299.35), 3898.05);
  assert.equal(round2(1.005), 1.01);
});

test('nomination extraction reads the email deterministically with evidence', async () => {
  const s = buildInitialState();
  const ext = await ai.extractNomination(EMAILS[0], s);
  const d = ext.draft;
  assert.equal(d.vesselName, 'MV Nile Trader');
  assert.equal(d.imo, '9526012');
  assert.equal(d.vesselType, 'Bulk Carrier');
  assert.equal(d.port, 'Alexandria');
  assert.equal(d.cargoQty, '45,000 MT');
  assert.equal(d.cargo, 'Wheat in bulk');
  assert.equal(d.eta, '2026-11-20T14:00:00');
  assert.equal(d.etb, '2026-11-20T18:00:00');
  assert.equal(d.etd, '2026-11-23T06:00:00');
  assert.deepEqual(d.services, ['full-agency', 'suez-transit', 'husbandry']);
  assert.equal(d.suezDirection, 'Southbound');
  assert.equal(d.suezCondition, 'Ballast');
  assert.equal(d.suezConvoyDate, '2026-11-24');
  assert.equal(ext.matchedOwnerId, DEMO_OWNER_ID);
  assert.equal(ext.matchedVesselId, 'vsl-nile');
  assert.match(ext.evidence.eta!, /ETA:\s+20 Nov 2026 14:00 LT/);
  assert.deepEqual(validateNomination(d), {});
});

test('validation catches bad operator edits', async () => {
  const ext = await ai.extractNomination(EMAILS[0], buildInitialState());
  const errs = validateNomination({ ...ext.draft, imo: '12', etd: '2026-11-20T10:00:00', vesselName: ' ' });
  assert.ok(errs.imo && errs.etd && errs.vesselName);
});

test('creating the port call from the nomination is idempotent and logged', async () => {
  const { s, pcId } = await withNileTrader();
  assert.equal(s.portCalls.length, 7);
  const pc = s.portCalls.find(p => p.id === pcId)!;
  assert.equal(pc.ownerId, DEMO_OWNER_ID);
  assert.equal(pc.suez?.convoy, '2026-11-24T03:00:00');
  assert.equal(pc.suez?.cutoff, '2026-11-23T22:00:00');
  assert.equal(s.emails.find(e => e.id === 'em-nomination')!.status, 'Processed');
  assert.equal(s.activity[0].action, 'Port call created');
  const again = reducer(s, { type: 'CREATE_PORT_CALL', emailId: 'em-nomination', portCall: pc, at: AT });
  assert.equal(again.portCalls.length, 7);
});

test('PDA draft lines and total for MV Nile Trader', async () => {
  const { s, pcId } = await withNileTrader();
  const pc = s.portCalls.find(p => p.id === pcId)!;
  const v = s.vessels.find(x => x.id === pc.vesselId)!;
  const { lines, basedOn } = draftPdaLines(pc, v, s.historical);
  const by = Object.fromEntries(lines.map(l => [l.code, l]));
  assert.equal(by['port-dues'].amount, 10969.2);
  assert.equal(by['pilotage-in'].amount, 2950);
  assert.equal(by['towage-out'].amount, 4500);
  assert.equal(by['berth'].amount, 3898.05);
  assert.equal(by['agency'].editable, false);
  assert.equal(by['suez-dues'].amount, 132300);
  assert.equal(by['launch'].quantity, 4);
  assert.equal(by['sundries'].amount, 980);
  assert.equal(by['anchorage'], undefined);
  for (const l of lines) {
    assert.equal(l.amount, lineAmount(l.quantity, l.rate));
    assert.ok(l.source && l.basis);
  }
  assert.equal(pdaTotal({ lineItems: lines }), 168267.25);
  assert.equal(basedOn.length, 2);
});

test('PDA edit recalculates, approval requires the D/A desk, nothing is auto-sent', async () => {
  const nt = await withNileTrader();
  const pcId = nt.pcId;
  let s = nt.s;
  const pc = s.portCalls.find(p => p.id === pcId)!;
  const v = s.vessels.find(x => x.id === pc.vesselId)!;
  const { lines, basedOn } = draftPdaLines(pc, v, s.historical);
  const pda: PDA = { id: 'pda-x', portCallId: pcId, status: 'Draft', lineItems: lines, basedOn, generatedAt: AT, generatedBy: 'test' };
  s = reducer(s, { type: 'SET_PDA', pda, at: AT });
  s = reducer(s, { type: 'EDIT_PDA_LINE', portCallId: pcId, lineId: `${pcId}-sundries`, quantity: 1, rate: 1050, note: 'Courier for crew documents', at: AT });
  assert.equal(pdaTotal(s.pdas[pcId]), 168337.25);
  const edited = s.pdas[pcId].lineItems.find(l => l.code === 'sundries')!;
  assert.equal(edited.original?.amount, 980);
  // locked line cannot be edited
  const locked = reducer(s, { type: 'EDIT_PDA_LINE', portCallId: pcId, lineId: `${pcId}-agency`, quantity: 1, rate: 1, note: 'x', at: AT });
  assert.equal(locked, s);
  // operator cannot approve
  assert.equal(reducer(s, { type: 'APPROVE_PDA', portCallId: pcId, at: AT }).pdas[pcId].status, 'Draft');
  // cannot send before approval
  assert.equal(reducer(s, { type: 'SEND_PDA', portCallId: pcId, at: AT }).pdas[pcId].status, 'Draft');
  s = asUser(s, 'st-karim');
  s = reducer(s, { type: 'APPROVE_PDA', portCallId: pcId, at: AT });
  assert.equal(s.pdas[pcId].status, 'Approved');
  assert.equal(s.pdas[pcId].approvedBy, 'Karim Fawzy');
  // approved PDA is frozen
  const frozen = reducer(s, { type: 'EDIT_PDA_LINE', portCallId: pcId, lineId: `${pcId}-launch`, quantity: 9, rate: 180, note: 'x', at: AT });
  assert.equal(frozen, s);
});

test('task extraction from crew-change and provisions emails', async () => {
  const { s, pcId } = await withNileTrader();
  const pc = s.portCalls.find(p => p.id === pcId)!;
  const crew = await ai.extractTasks(s.emails.find(e => e.id === 'em-crew')!, pc, s.staff);
  assert.equal(crew.length, 2);
  assert.match(crew[0].title, /sign off 2 seafarers/);
  assert.match(crew[0].description, /AB Stelios Karras, Oiler Petros Alexiou/);
  assert.equal(crew[0].dueAt, addHours(pc.etb, 6));
  assert.equal(crew[0].assigneeId, 'st-nour');
  const prov = await ai.extractTasks(s.emails.find(e => e.id === 'em-provisions')!, pc, s.staff);
  assert.equal(prov.length, 2);
  assert.match(prov[0].title, /23 crew, 7 days/);
  assert.equal(prov[1].dueAt, '2026-11-19T18:00:00');
});

test('18 h berthing delay: transit risk + exact cost impact + task shift', async () => {
  const nt = await withNileTrader();
  const pcId = nt.pcId;
  let s = nt.s;
  const pc = s.portCalls.find(p => p.id === pcId)!;
  const v = s.vessels.find(x => x.id === pc.vesselId)!;
  const task: Task = { id: 't1', portCallId: pcId, vesselName: pc.vesselName, category: 'crew-change', title: 'Crew', description: '', assigneeId: 'st-nour', dueAt: addHours(pc.etb, 6), etbOffsetHours: 6, priority: 'High', status: 'Open', createdFrom: 'email' };
  s = reducer(s, { type: 'CREATE_TASKS', tasks: [task], at: AT });

  const after = { eta: pc.eta, etb: addHours(pc.etb, 18), etd: addHours(pc.etd, 18) };
  const as = assessScheduleChange(pc, v, after, s.tasks, 'Berth occupied');
  assert.equal(as.deltaEtbHours, 18);
  assert.equal(as.transitBefore?.missed, false);
  assert.equal(as.transitBefore?.bufferHours, 2);
  assert.equal(as.transitAfter?.missed, true);
  assert.equal(as.transitAfter?.bufferHours, -16);
  assert.equal(as.transitAfter?.nextConvoy, '2026-11-25T03:00:00');
  const cost = Object.fromEntries(as.costLines.map(l => [l.label, l.amount]));
  assert.deepEqual(cost, { 'Port dues': 3656.4, 'Anchorage dues': 664.8, 'Launch hire': 360, 'Suez transit amendment': 1500 });
  assert.equal(as.costTotal, 6181.2);
  assert.deepEqual(as.warnings.map(w => w.kind), ['transit-risk', 'cost-impact', 'task-reschedule']);
  assert.equal(as.warnings[0].severity, 'critical');

  s = reducer(s, { type: 'APPLY_SCHEDULE', portCallId: pcId, schedule: after, reason: 'Berth occupied', assessment: as, at: AT });
  const pc2 = s.portCalls.find(p => p.id === pcId)!;
  assert.equal(pc2.etb, '2026-11-21T12:00:00');
  assert.equal(pc2.suez?.status, 'At Risk');
  assert.equal(s.tasks.find(t => t.id === 't1')!.dueAt, '2026-11-21T18:00:00');
  assert.equal(s.warnings.filter(w => w.status === 'Open').length, 3);

  // a change with no effect raises nothing
  const none = assessScheduleChange(pc, v, { ...pc }, [], 'n/a');
  assert.equal(none.warnings.length, 0);

  // rebook resolves the transit warning and adds a Suez desk task
  s = reducer(s, { type: 'REBOOK_TRANSIT', portCallId: pcId, at: AT });
  const pc3 = s.portCalls.find(p => p.id === pcId)!;
  assert.equal(pc3.suez?.convoy, '2026-11-25T03:00:00');
  assert.equal(pc3.suez?.originalConvoy, '2026-11-24T03:00:00');
  assert.equal(s.warnings.find(w => w.kind === 'transit-risk')!.status, 'Resolved');
  assert.ok(s.tasks.some(t => t.category === 'transit' && t.assigneeId === 'st-youssef'));
});

test('convoyFor picks the first convoy whose cut-off is not passed', () => {
  assert.deepEqual(convoyFor('2026-11-24T14:00:00'), { convoy: '2026-11-25T03:00:00', cutoff: '2026-11-24T22:00:00' });
  assert.deepEqual(convoyFor('2026-11-23T22:00:00'), { convoy: '2026-11-24T03:00:00', cutoff: '2026-11-23T22:00:00' });
});

test('full scenario: client update, owner isolation, FDA reconciliation, reset', async () => {
  const nt = await withNileTrader();
  const pcId = nt.pcId;
  let s = nt.s;
  let pc = s.portCalls.find(p => p.id === pcId)!;
  const v = s.vessels.find(x => x.id === pc.vesselId)!;
  const { lines, basedOn } = draftPdaLines(pc, v, s.historical);
  s = run(s,
    { type: 'SET_PDA', pda: { id: 'p', portCallId: pcId, status: 'Draft', lineItems: lines, basedOn, generatedAt: AT, generatedBy: 't' }, at: AT },
    { type: 'SET_USER', userId: 'st-karim' },
    { type: 'APPROVE_PDA', portCallId: pcId, at: AT },
    { type: 'SET_USER', userId: 'st-mona' },
  );
  const after = { eta: pc.eta, etb: addHours(pc.etb, 18), etd: addHours(pc.etd, 18) };
  s = reducer(s, { type: 'APPLY_SCHEDULE', portCallId: pcId, schedule: after, reason: 'Berth occupied', assessment: assessScheduleChange(pc, v, after, s.tasks, 'Berth occupied'), at: AT });

  // portal before the owner update: schedule live, revised estimate pending approval
  let portal = getOwnerPortal(s, DEMO_OWNER_ID)!;
  assert.equal(portal.calls.length, 1);
  assert.equal(portal.calls[0].schedule.etb, '2026-11-21T12:00:00');
  assert.equal(portal.calls[0].approvedPda, 168267.25);
  assert.equal(portal.calls[0].estimatePending, true);
  assert.equal(portal.calls[0].revisedEstimate, undefined);

  s = reducer(s, { type: 'REBOOK_TRANSIT', portCallId: pcId, at: AT });
  pc = s.portCalls.find(p => p.id === pcId)!;
  const owner = s.companies.find(c => c.id === DEMO_OWNER_ID)!;
  const draft = draftClientUpdateSync({ portCall: pc, vessel: v, owner, approvedPdaTotal: 168267.25, pdaStatus: 'Approved', operator: s.staff[0] });
  assert.match(draft.body, /MV Nile Trader/);
  assert.match(draft.body, /\+18 h berthing delay/);
  assert.match(draft.body, /ETA: 20 Nov 2026 14:00/);
  assert.match(draft.body, /Revised estimate: \$174,448\.45/);
  assert.match(draft.body, /25 Nov 2026 03:00 convoy/);
  assert.equal(draft.snapshot.revisedEstimate, 174448.45);

  s = reducer(s, { type: 'CREATE_UPDATE_DRAFT', update: { id: 'u1', portCallId: pcId, ownerId: DEMO_OWNER_ID, vesselName: pc.vesselName, status: 'Draft', subject: draft.subject, body: draft.body, createdAt: AT, createdBy: 'Mona Saleh', edited: false, snapshot: draft.snapshot, inReplyToEmailId: 'em-status' } });
  // drafts never reach the portal
  assert.equal(getOwnerPortal(s, DEMO_OWNER_ID)!.calls[0].updates.length, 0);
  s = reducer(s, { type: 'EDIT_UPDATE', id: 'u1', subject: draft.subject, body: draft.body + '\nPS edited' });
  s = reducer(s, { type: 'SEND_UPDATE', id: 'u1', at: AT });
  assert.equal(s.emails.find(e => e.id === 'em-status')!.status, 'Processed');

  portal = getOwnerPortal(s, DEMO_OWNER_ID)!;
  assert.equal(portal.calls[0].updates.length, 1);
  assert.match(portal.calls[0].updates[0].body, /PS edited/);
  assert.equal(portal.calls[0].revisedEstimate?.total, 174448.45);
  assert.equal(portal.calls[0].estimatePending, false);

  // isolation: no other owner sees Nile Trader, and Thalassa sees nothing else
  for (const o of s.companies.filter(c => c.kind === 'owner' && c.id !== DEMO_OWNER_ID)) {
    const p = getOwnerPortal(s, o.id)!;
    assert.ok(p.calls.every(c => c.id !== pcId));
    assert.ok(p.calls.length > 0);
    assert.ok(JSON.stringify(p).indexOf('Nile Trader') === -1);
  }
  assert.ok(portal.calls.every(c => s.portCalls.find(p => p.id === c.id)!.ownerId === DEMO_OWNER_ID));
  assert.equal(getOwnerPortal(s, 'chr-goldensheaf'), null);

  // FDA
  const fdaLines = sampleFinalInvoices(pc, v, s.historical);
  s = reducer(s, { type: 'LOAD_FDA', fda: { portCallId: pcId, receivedAt: AT, lines: fdaLines }, at: AT });
  const cmp = comparePdaFda(s.pdas[pcId], s.fdas[pcId]);
  assert.equal(cmp.pdaTotal, 168267.25);
  assert.equal(cmp.fdaTotal, 176804.95);
  assert.equal(cmp.diff, 8537.7);
  const row = (c: string) => cmp.rows.find(r => r.code === c)!;
  assert.equal(row('port-dues').diff, 3656.4);
  assert.equal(row('port-dues').status, 'explained');
  assert.equal(row('anchorage').pda, 0);
  assert.equal(row('anchorage').pct, null);
  assert.equal(row('towage-out').pct, 50);
  assert.equal(row('sundries').status, 'unexplained');
  assert.equal(row('sundries').reason, undefined);
  assert.equal(row('suez-dues').status, 'match');
  assert.equal(cmp.unexplainedDiff, 106.5);
  s = reducer(s, { type: 'RECONCILE_FDA', portCallId: pcId, at: AT });
  assert.ok(s.fdas[pcId].reconciledAt);

  // activity covers every required event type
  const actions = new Set(s.activity.map(a => a.action));
  for (const a of ['Port call created', 'PDA draft generated', 'PDA approved', 'Schedule changed', 'Warning raised', 'Suez rebooking requested', 'Client update drafted', 'Client update approved', 'Client update sent (simulated)', 'Final invoices loaded (FDA)', 'FDA reconciliation reviewed']) {
    assert.ok(actions.has(a), `missing activity: ${a}`);
  }

  // reset
  const r = reducer(s, { type: 'RESET' });
  assert.deepEqual(r, buildInitialState());
});

test('historical comparisons: totals and unexplained flags', () => {
  const s = buildInitialState();
  const c = compareHistorical(s.historical.find(h => h.id === 'hist-alx-1021')!);
  assert.equal(c.diff, round2(c.fdaTotal - c.pdaTotal));
  const sund = c.rows.find(r => r.code === 'sundries')!;
  assert.equal(sund.status, 'unexplained');
  assert.equal(sund.diff, 290);
  assert.equal(sund.pct, 34.12);
  const tow = c.rows.find(r => r.code === 'towage-out')!;
  assert.equal(tow.status, 'explained');
  assert.equal(tow.pct, 50);
});
