// Deterministic "simulated AI" implementation. No model, no network, no API key.
// - Nomination & task extraction: regex parsing of the predefined sample emails.
// - PDA drafting: tariff arithmetic (pdaEngine).
// - Early warnings: rule engine (scheduleRules).
// - Client update: template filled from current port-call data.
import type { DemoEmail, PortName, ServiceKey, Staff, VesselType } from '@/types';
import { draftPdaLines } from '@/services/pdaEngine';
import { assessScheduleChange, cumulativeImpact, checkTransit } from '@/services/scheduleRules';
import { addHours, fmtHoursDelta, fmtLt, hoursBetween } from '@/lib/time';
import { round2, sumMoney, usd, usdDelta } from '@/lib/format';
import type { AIService, ClientUpdateDraft, ClientUpdateInput, NominationDraft, NominationExtraction, TaskSuggestion } from '@/services/ai/types';

const PORTS: PortName[] = ['Alexandria', 'Damietta', 'Port Said', 'Dubai'];
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const pad = (n: number) => String(n).padStart(2, '0');

export function findLabel(body: string, label: string): { value: string; line: string } | undefined {
  const m = body.match(new RegExp(`^[ \\t]*${esc(label)}[ \\t]*:[ \\t]*(.+)$`, 'im'));
  return m ? { value: m[1].trim(), line: m[0].trim() } : undefined;
}

/** "20 Nov 2026 14:00 LT" → "2026-11-20T14:00:00"; date-only → T00:00 */
export function parseLtDate(s: string): string {
  const m = s.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/);
  if (!m) return '';
  const mon = MONTHS[m[2].toLowerCase()];
  if (!mon) return '';
  return `${m[3]}-${pad(mon)}-${pad(+m[1])}T${pad(m[4] ? +m[4] : 0)}:${m[5] ?? '00'}:00`;
}

function vesselType(s: string): VesselType {
  const x = s.toLowerCase();
  if (x.includes('bulk')) return 'Bulk Carrier';
  if (x.includes('tank')) return 'Tanker';
  if (x.includes('container')) return 'Container';
  return 'General Cargo';
}

function section(body: string, header: string): string[] {
  const lines = body.split('\n');
  const start = lines.findIndex(l => l.trim().toUpperCase().startsWith(header.toUpperCase()));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) { if (out.length) break; continue; }
    if (/^(\d+\.|-)\s+/.test(l)) out.push(l); else if (out.length) break;
  }
  return out;
}

const pause = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export function createSimulatedAI(latencyMs = 450): AIService {
  const wait = () => (latencyMs > 0 ? pause(latencyMs) : Promise.resolve());

  return {
    mode: 'simulated',
    label: 'Simulated AI — deterministic rules on sample data',

    async extractNomination(email, ctx): Promise<NominationExtraction> {
      await wait();
      const b = email.body;
      const ev: NominationExtraction['evidence'] = {};
      const notes: string[] = [];
      const get = (key: keyof NominationDraft, label: string) => {
        const f = findLabel(b, label);
        if (f) ev[key] = f.line;
        return f?.value ?? '';
      };

      const vesselName = get('vesselName', 'Vessel');
      const imo = get('imo', 'IMO').replace(/\D/g, '');
      const typeRaw = get('vesselType', 'Type');
      const flag = get('flag', 'Flag');
      const dwt = get('dwt', 'DWT').replace(/\s*mt$/i, '');
      const gtNrt = findLabel(b, 'GT / NRT');
      const [gt, nrt] = (gtNrt?.value ?? '').split('/').map(s => s.trim());
      if (gtNrt) { ev.gt = gtNrt.line; ev.nrt = gtNrt.line; }
      const loa = get('loa', 'LOA').replace(/\s*m$/i, '');
      const portRaw = get('port', 'Port');
      const port = PORTS.find(p => portRaw.toLowerCase().includes(p.toLowerCase())) ?? 'Alexandria';
      if (!PORTS.some(p => portRaw.toLowerCase().includes(p.toLowerCase()))) notes.push(`Port "${portRaw}" not recognised — defaulted to Alexandria, please check.`);
      const purpose = get('purpose', 'Operation');
      const cargoRaw = get('cargo', 'Cargo');
      const cm = cargoRaw.match(/^([\d.,]+)\s*(mt|teu|t)\b\s*(.*)$/i);
      const cargoQty = cm ? `${cm[1]} ${cm[2].toUpperCase()}` : '';
      const cargo = cm ? cm[3].charAt(0).toUpperCase() + cm[3].slice(1) : cargoRaw;
      if (cm) ev.cargoQty = ev.cargo;
      const charterer = get('charterer', 'Charterers');
      const eta = parseLtDate(get('eta', 'ETA'));
      const etb = parseLtDate(get('etb', 'ETB (prospect)'));
      const along = findLabel(b, 'Time alongside');
      const alongH = along ? Number((along.value.match(/(\d+(\.\d+)?)/) ?? [])[1]) : NaN;
      let etd = '';
      if (etb && !Number.isNaN(alongH)) { etd = addHours(etb, alongH); ev.etd = along!.line; }
      else { notes.push('No departure estimate in the email — ETD needs to be entered.'); }

      const services: ServiceKey[] = [];
      const svcLines = section(b, 'Services required');
      svcLines.forEach(l => {
        const x = l.toLowerCase();
        if (x.includes('agency') && !services.includes('full-agency')) services.push('full-agency');
        if (x.includes('suez') && !services.includes('suez-transit')) services.push('suez-transit');
        if ((x.includes('husbandry') || x.includes('crew') || x.includes('provision')) && !services.includes('husbandry')) services.push('husbandry');
      });
      if (svcLines.length) ev.services = svcLines.join(' · ');

      const onward = findLabel(b, 'Onward');
      let suezDirection: NominationDraft['suezDirection'] = '';
      let suezCondition: NominationDraft['suezCondition'] = 'Laden';
      let suezConvoyDate = '';
      if (onward && /suez/i.test(onward.value)) {
        suezDirection = /south/i.test(onward.value) ? 'Southbound' : 'Northbound';
        suezCondition = /ballast/i.test(onward.value) ? 'Ballast' : 'Laden';
        suezConvoyDate = parseLtDate(onward.value).slice(0, 10);
        ev.suezDirection = onward.line; ev.suezCondition = onward.line; ev.suezConvoyDate = onward.line;
      }

      const ownerName = get('ownerName', 'Owners') || email.fromCompany;
      const ownerContact = get('ownerContact', 'Contact') || email.from;
      ev.ownerEmail = `From: ${email.from} <${email.fromEmail}>`;

      const matchedVessel = ctx.vessels.find(v => v.imo === imo);
      const domain = email.fromEmail.split('@')[1];
      const matchedOwner = ctx.companies.find(c => c.kind === 'owner' && (c.name.toLowerCase() === ownerName.toLowerCase() || c.email.endsWith(`@${domain}`)));
      const matchedCharterer = ctx.companies.find(c => c.kind === 'charterer' && c.name.toLowerCase() === charterer.toLowerCase());
      if (matchedVessel) notes.push(`Matched existing vessel record by IMO ${imo}.`);
      if (matchedOwner) notes.push(`Matched owner record: ${matchedOwner.name}.`);
      if (charterer && !matchedCharterer) notes.push(`Charterer "${charterer}" is not in the company list.`);

      return {
        draft: {
          vesselName, imo, vesselType: vesselType(typeRaw), flag, dwt, gt: gt ?? '', nrt: nrt ?? '', loa,
          port, purpose, cargo, cargoQty, charterer, eta, etb, etd, services,
          ownerName, ownerContact, ownerEmail: email.fromEmail,
          suezDirection, suezCondition, suezConvoyDate,
        },
        evidence: ev,
        matchedVesselId: matchedVessel?.id,
        matchedOwnerId: matchedOwner?.id,
        matchedChartererId: matchedCharterer?.id,
        notes,
      };
    },

    async extractTasks(email: DemoEmail, pc, staff: Staff[]): Promise<TaskSuggestion[]> {
      await wait();
      const husbandry = staff.filter(s => s.desk === 'Husbandry');
      const lead = husbandry[0] ?? staff[0];
      const second = husbandry[1] ?? lead;
      const due = (h: number) => addHours(pc.etb, h);

      if (email.type === 'crew-change') {
        const off = section(email.body, 'OFF-SIGNERS');
        const on = section(email.body, 'ON-SIGNERS');
        const name = (l: string) => l.replace(/^\d+\.\s+/, '').split(/\s+[—-]\s+/)[0];
        const docs = email.body.split('\n').find(l => /passport|cdc|stcw/i.test(l))?.trim();
        return [
          {
            title: `Crew change — sign off ${off.length} seafarer${off.length === 1 ? '' : 's'}`,
            description: `Off-signers: ${off.map(name).join(', ')}. Immigration sign-off, shore passes, transfer to airport and repatriation flights.`,
            category: 'crew-change', assigneeId: lead.id, etbOffsetHours: 6, dueAt: due(6), priority: 'High',
            rule: 'Crew change → Husbandry desk lead · due ETB + 6 h (sample SLA)',
            evidence: [...off, ...(docs ? [docs] : [])],
          },
          {
            title: `Crew change — sign on ${on.length} seafarer${on.length === 1 ? '' : 's'}`,
            description: `On-signers: ${on.map(name).join(', ')}. Meet and assist at airport, OK-to-board letters, transfer to vessel after berthing.`,
            category: 'crew-change', assigneeId: lead.id, etbOffsetHours: 4, dueAt: due(4), priority: 'High',
            rule: 'Crew change → Husbandry desk lead · due ETB + 4 h (sample SLA)',
            evidence: on,
          },
        ];
      }

      if (email.type === 'provisions') {
        const m = email.body.match(/for\s+(\d+)\s+crew,\s*(\d+)\s+days/i);
        const items = section(email.body, 'Please arrange fresh provisions').map(l => l.replace(/^-\s+/, ''));
        const quoteLine = email.body.split('\n').find(l => /quotation/i.test(l))?.trim();
        const tasks: TaskSuggestion[] = [
          {
            title: `Fresh provisions — ${m ? `${m[1]} crew, ${m[2]} days` : 'as requested'}`,
            description: `Deliver alongside after berthing: ${items.join('; ')}.`,
            category: 'provisions', assigneeId: second.id, etbOffsetHours: 8, dueAt: due(8), priority: 'Medium',
            rule: 'Provisions → Husbandry officer · due ETB + 8 h (sample SLA)',
            evidence: [m ? m[0] : '', ...items].filter(Boolean),
          },
        ];
        if (quoteLine) {
          tasks.push({
            title: 'Send provisions quotation to Master for approval',
            description: 'Obtain supplier quotation and send to the Master before ordering.',
            category: 'provisions', assigneeId: second.id, etbOffsetHours: -24, dueAt: due(-24), priority: 'Medium',
            rule: 'Approval requested in email → due ETB − 24 h',
            evidence: [quoteLine],
          });
        }
        return tasks;
      }
      return [];
    },

    async draftPda(pc, vessel, history) {
      await wait();
      return draftPdaLines(pc, vessel, history);
    },

    async assessScheduleChange(pc, vessel, after, tasks, reason) {
      await wait();
      return assessScheduleChange(pc, vessel, after, tasks, reason);
    },

    async draftClientUpdate(input: ClientUpdateInput): Promise<ClientUpdateDraft> {
      await wait();
      return draftClientUpdateSync(input);
    },
  };
}

export function draftClientUpdateSync({ portCall: pc, vessel, owner, approvedPdaTotal, pdaStatus, operator, inquiry }: ClientUpdateInput): ClientUpdateDraft {
  const delay = hoursBetween(pc.baseline.etb, pc.etb);
  const etdShift = hoursBetween(pc.baseline.etd, pc.etd);
  const impact = cumulativeImpact(pc, vessel);
  const changed = delay !== 0 || etdShift !== 0 || pc.eta !== pc.baseline.eta;
  const revised = approvedPdaTotal !== undefined ? round2(sumMoney([approvedPdaTotal, impact.total])) : undefined;

  const L: string[] = [];
  L.push(`Dear ${owner.contact},`, '');
  L.push(`${inquiry ? 'Thank you for your email. ' : ''}Please find the latest position for ${pc.vesselName} at ${pc.port} (our ref. ${pc.ref}).`, '');

  L.push('SCHEDULE (local time)');
  L.push(`- ETA: ${fmtLt(pc.eta, true)}${pc.eta === pc.baseline.eta ? ' (unchanged)' : ` — revised from ${fmtLt(pc.baseline.eta, true)}`}`);
  L.push(`- ETB: ${fmtLt(pc.etb, true)}${delay === 0 ? ' (unchanged)' : ` — revised from ${fmtLt(pc.baseline.etb, true)} (${fmtHoursDelta(delay)} berthing ${delay > 0 ? 'delay' : 'change'})`}`);
  L.push(`- ETD: ${fmtLt(pc.etd, true)}${etdShift === 0 ? ' (unchanged)' : ` — revised from ${fmtLt(pc.baseline.etd, true)}`}`);
  if (changed && pc.delayReason) L.push(`Reason: ${pc.delayReason}`);
  L.push('');

  let transitStatus: string | undefined;
  let nextStep = pc.nextStep;
  if (pc.suez) {
    L.push(`SUEZ CANAL TRANSIT (${pc.suez.direction.toLowerCase()})`);
    const check = pc.suez.passageHours > 0 ? checkTransit(pc, pc.suez) : undefined;
    if (pc.suez.status === 'Rebooking Requested' && pc.suez.originalConvoy) {
      transitStatus = `Rebooking requested: ${fmtLt(pc.suez.originalConvoy)} → ${fmtLt(pc.suez.convoy)} LT convoy`;
      L.push(`- The revised departure no longer meets the cut-off for the ${fmtLt(pc.suez.originalConvoy, true)} convoy.`);
      L.push(`- We have requested rebooking to the ${fmtLt(pc.suez.convoy, true)} convoy and will confirm as soon as it is accepted.`);
      nextStep = `Proxima Suez desk to confirm the ${fmtLt(pc.suez.convoy)} LT convoy; berthing expected ${fmtLt(pc.etb)} LT.`;
    } else if (check?.missed) {
      transitStatus = `Convoy ${fmtLt(pc.suez.convoy)} LT at risk`;
      L.push(`- The revised departure misses the cut-off for the ${fmtLt(pc.suez.convoy, true)} convoy by ${Math.abs(check.bufferHours)} h.`);
      L.push(`- We are arranging rebooking to the next feasible convoy (${fmtLt(check.nextConvoy, true)}).`);
      nextStep = `Proxima Suez desk to rebook the transit for the ${fmtLt(check.nextConvoy)} LT convoy.`;
    } else {
      transitStatus = `On track for ${fmtLt(pc.suez.convoy)} LT convoy`;
      L.push(`- On track for the ${fmtLt(pc.suez.convoy, true)} convoy.`);
    }
    L.push('');
  }

  L.push('ESTIMATED PORT COSTS (USD, estimate — final figures follow in the FDA)');
  if (approvedPdaTotal !== undefined) {
    L.push(`- Approved PDA: ${usd(approvedPdaTotal)}`);
    if (impact.lines.length) {
      L.push(`- Estimated additional costs from the revised schedule: ${usdDelta(impact.total)}`);
      impact.lines.forEach(l => L.push(`    · ${l.label}: ${usdDelta(l.amount)}`));
      L.push(`- Revised estimate: ${usd(revised)}`);
    } else {
      L.push('- No change to the estimate.');
    }
  } else {
    L.push(`- Our D/A team is ${pdaStatus === 'Draft' ? 'reviewing' : 'preparing'} the PDA; we will send it once approved.`);
    if (impact.lines.length) L.push(`- The revised schedule adds an estimated ${usdDelta(impact.total)} in schedule-driven port costs.`);
  }
  L.push('');
  L.push('NEXT STEP');
  L.push(nextStep, '');
  L.push('We will keep you updated on any further change.', '');
  L.push('Kind regards,', operator.name, `${operator.title}, Proxima Ship Service`);

  const subject = changed
    ? `${pc.vesselName} — ${pc.port}: revised schedule${pc.suez ? ', Suez convoy' : ''} and cost estimate`
    : `${pc.vesselName} — ${pc.port}: status update`;

  return {
    subject,
    body: L.join('\n'),
    snapshot: {
      eta: pc.eta, etb: pc.etb, etd: pc.etd,
      approvedPda: approvedPdaTotal,
      delayImpact: impact.lines.length ? impact.total : undefined,
      revisedEstimate: revised,
      transitStatus,
      nextStep,
    },
    sources: [
      `Port call ${pc.ref}: current schedule vs nominated schedule`,
      approvedPdaTotal !== undefined ? `Approved PDA total ${usd(approvedPdaTotal)}` : `PDA status: ${pdaStatus} (not quoted)`,
      ...(impact.lines.length ? ['Rule R-COST-01: schedule-driven tariff items vs nominated schedule'] : []),
      ...(pc.suez ? [`Suez booking: ${pc.suez.status}`] : []),
      ...(inquiry ? [`Replying to: "${inquiry.subject}"`] : []),
    ],
  };
}
