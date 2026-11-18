// Rule-based early-warning engine. Given a port call and a proposed schedule
// change, it checks the Suez convoy cut-off and recalculates schedule-driven
// port costs from the illustrative tariff. No randomness: same input, same output.
import type { CostImpactLine, PortCall, Schedule, SuezTransit, Task, Vessel, Warning } from '@/types';
import { PORT_TARIFFS, SUEZ_TABLE } from '@/lib/tariffs';
import { addHours, fmtHoursDelta, fmtLt, hoursBetween, ltToMs, msToLt } from '@/lib/time';
import { lineAmount, num, sumMoney, usd } from '@/lib/format';
import {
  anchorageChargeableHours, anchorageHourlyRate, anchorageWaitHours, extraLaunchTrips,
  portDuePeriods, portDuesRate, portStayHours,
} from '@/services/pdaEngine';

export interface TransitCheck {
  convoy: string;
  cutoff: string;
  arrival: string;          // estimated arrival at the convoy waiting area
  bufferHours: number;      // cutoff − arrival (negative = missed)
  missed: boolean;
  nextConvoy?: string;
  nextCutoff?: string;
}

export interface ScheduleAssessment {
  deltaEtbHours: number;
  deltaEtdHours: number;
  before: Schedule;
  after: Schedule;
  transitBefore?: TransitCheck;
  transitAfter?: TransitCheck;
  costLines: CostImpactLine[];
  costTotal: number;
  taskShifts: { taskId: string; title: string; from: string; to: string }[];
  warnings: Omit<Warning, 'id' | 'triggeredAt' | 'status'>[];
  summary: string;
}

export const RULES = {
  transit: 'R-SUEZ-01 · ETD + passage to waiting area must be ≤ convoy cut-off',
  buffer: 'R-SUEZ-02 · warn when cut-off buffer < 4 h',
  cost: 'R-COST-01 · recalculate schedule-driven tariff items (port dues, anchorage, launch, transit amendment)',
  tasks: 'R-TASK-01 · tasks anchored to ETB move with ETB',
};

export function convoyFor(lt: string): { convoy: string; cutoff: string } {
  // first sample daily convoy whose cut-off is at or after `lt`
  const d = new Date(ltToMs(lt));
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), SUEZ_TABLE.convoyHourLt);
  for (let i = 0; i < 4; i++) {
    const convoyMs = day + i * 86_400_000;
    const cutoffMs = convoyMs - SUEZ_TABLE.cutoffHoursBeforeConvoy * 3_600_000;
    if (cutoffMs >= ltToMs(lt)) return { convoy: msToLt(convoyMs), cutoff: msToLt(cutoffMs) };
  }
  const fallback = day + 4 * 86_400_000;
  return { convoy: msToLt(fallback), cutoff: msToLt(fallback - SUEZ_TABLE.cutoffHoursBeforeConvoy * 3_600_000) };
}

export function checkTransit(s: Schedule, suez: SuezTransit): TransitCheck {
  const arrival = addHours(s.etd, suez.passageHours);
  const bufferHours = Math.round(hoursBetween(arrival, suez.cutoff) * 100) / 100;
  const missed = bufferHours < 0;
  const next = missed ? convoyFor(arrival) : undefined;
  return { convoy: suez.convoy, cutoff: suez.cutoff, arrival, bufferHours, missed, nextConvoy: next?.convoy, nextCutoff: next?.cutoff };
}

/** Cost difference of `after` versus `before` for schedule-driven tariff items. */
export function scheduleCostImpact(pc: PortCall, vessel: Vessel, before: Schedule, after: Schedule, transitMissed: boolean): CostImpactLine[] {
  const t = PORT_TARIFFS[pc.port];
  const out: CostImpactLine[] = [];

  const pB = portDuePeriods(before), pA = portDuePeriods(after);
  if (pA !== pB) {
    const rate = portDuesRate(t, vessel);
    out.push({
      label: 'Port dues',
      basis: `Stay ${num(portStayHours(before))} h → ${num(portStayHours(after))} h: ${pB} → ${pA} started 24 h periods × ${usd(rate)}`,
      amount: lineAmount(pA - pB, rate),
    });
  }

  const aB = anchorageChargeableHours(t, before), aA = anchorageChargeableHours(t, after);
  if (aA !== aB) {
    const rate = anchorageHourlyRate(t, vessel);
    out.push({
      label: 'Anchorage dues',
      basis: `Wait ${num(anchorageWaitHours(before))} h → ${num(anchorageWaitHours(after))} h (${t.anchorageFreeHours} h free): ${num(aB)} → ${num(aA)} chargeable h × ${usd(rate)}/h`,
      amount: lineAmount(aA - aB, rate),
    });
  }

  const lB = extraLaunchTrips(t, before), lA = extraLaunchTrips(t, after);
  if (lA !== lB) {
    out.push({
      label: 'Launch hire',
      basis: `${lA - lB > 0 ? '+' : ''}${lA - lB} trips for agent/crew attendance during anchorage wait × ${usd(t.launchPerTrip)}`,
      amount: lineAmount(lA - lB, t.launchPerTrip),
    });
  }

  if (transitMissed) {
    out.push({
      label: 'Suez transit amendment',
      basis: 'Convoy booking amended after missed cut-off — illustrative charge, not an SCA tariff',
      amount: SUEZ_TABLE.amendmentCharge,
    });
  }
  return out;
}

export function assessScheduleChange(
  pc: PortCall, vessel: Vessel, after: Schedule, tasks: Task[], reason: string,
): ScheduleAssessment {
  const before: Schedule = { eta: pc.eta, etb: pc.etb, etd: pc.etd };
  const deltaEtbHours = hoursBetween(before.etb, after.etb);
  const deltaEtdHours = hoursBetween(before.etd, after.etd);
  const warnings: ScheduleAssessment['warnings'] = [];

  let transitBefore: TransitCheck | undefined;
  let transitAfter: TransitCheck | undefined;
  if (pc.suez && pc.suez.passageHours > 0 && pc.status !== 'In Transit' && pc.status !== 'Completed') {
    transitBefore = checkTransit(before, pc.suez);
    transitAfter = checkTransit(after, pc.suez);
  }
  const newlyMissed = !!transitAfter?.missed && !transitBefore?.missed;

  const costLines = scheduleCostImpact(pc, vessel, before, after, newlyMissed);
  const costTotal = sumMoney(costLines.map(l => l.amount));

  const taskShifts = tasks
    .filter(t => t.portCallId === pc.id && t.status !== 'Done' && t.etbOffsetHours !== undefined && deltaEtbHours !== 0)
    .map(t => ({ taskId: t.id, title: t.title, from: t.dueAt, to: addHours(after.etb, t.etbOffsetHours!) }));

  const changeText = `ETB ${fmtLt(before.etb)} → ${fmtLt(after.etb)} LT (${fmtHoursDelta(deltaEtbHours)}), ETD ${fmtLt(before.etd)} → ${fmtLt(after.etd)} LT`;

  if (transitAfter && pc.suez) {
    if (transitAfter.missed && newlyMissed) {
      warnings.push({
        portCallId: pc.id, vesselName: pc.vesselName, kind: 'transit-risk', severity: 'critical',
        title: `Suez transit slot at risk — convoy ${fmtLt(pc.suez.convoy)} LT`,
        reason: `${changeText}. With ${pc.suez.passageHours} h passage to the ${pc.suez.waitingArea} waiting area the vessel arrives ${fmtLt(transitAfter.arrival)} LT, ${num(Math.abs(transitAfter.bufferHours))} h after the ${fmtLt(transitAfter.cutoff)} LT cut-off.`,
        facts: [
          { label: 'Booked convoy', value: `${fmtLt(pc.suez.convoy)} LT` },
          { label: 'Cut-off', value: `${fmtLt(transitAfter.cutoff)} LT` },
          { label: 'New arrival at waiting area', value: `${fmtLt(transitAfter.arrival)} LT` },
          { label: 'Missed by', value: `${num(Math.abs(transitAfter.bufferHours))} h` },
          { label: 'Next feasible convoy', value: `${fmtLt(transitAfter.nextConvoy)} LT (cut-off ${fmtLt(transitAfter.nextCutoff)})` },
        ],
        rule: RULES.transit,
      });
    } else if (!transitAfter.missed && transitAfter.bufferHours < 4 && transitAfter.bufferHours < (transitBefore?.bufferHours ?? Infinity)) {
      warnings.push({
        portCallId: pc.id, vesselName: pc.vesselName, kind: 'transit-risk', severity: 'warning',
        title: `Suez cut-off buffer down to ${num(transitAfter.bufferHours)} h`,
        reason: `${changeText}. Arrival at the waiting area ${fmtLt(transitAfter.arrival)} LT leaves ${num(transitAfter.bufferHours)} h before the ${fmtLt(transitAfter.cutoff)} LT cut-off.`,
        facts: [
          { label: 'Booked convoy', value: `${fmtLt(pc.suez.convoy)} LT` },
          { label: 'Buffer before', value: `${num(transitBefore?.bufferHours ?? 0)} h` },
          { label: 'Buffer after', value: `${num(transitAfter.bufferHours)} h` },
        ],
        rule: RULES.buffer,
      });
    }
  }

  if (costLines.length) {
    warnings.push({
      portCallId: pc.id, vesselName: pc.vesselName, kind: 'cost-impact', severity: costTotal > 0 ? 'warning' : 'info',
      title: `Estimated port costs ${costTotal >= 0 ? 'up' : 'down'} ${usd(Math.abs(costTotal))}`,
      reason: `${changeText}. Reason given: ${reason}. Schedule-driven tariff items were recalculated from ${PORT_TARIFFS[pc.port].ref}.`,
      facts: [
        { label: 'Time in port', value: `${num(portStayHours(before))} h → ${num(portStayHours(after))} h` },
        { label: 'Anchorage wait', value: `${num(anchorageWaitHours(before))} h → ${num(anchorageWaitHours(after))} h` },
      ],
      costImpact: costTotal,
      costBreakdown: costLines,
      rule: RULES.cost,
    });
  }

  if (taskShifts.length) {
    warnings.push({
      portCallId: pc.id, vesselName: pc.vesselName, kind: 'task-reschedule', severity: 'info',
      title: `${taskShifts.length} husbandry task${taskShifts.length > 1 ? 's' : ''} rescheduled with ETB`,
      reason: 'These tasks are anchored to berthing time, so their due times moved with the new ETB.',
      facts: taskShifts.map(s => ({ label: s.title, value: `${fmtLt(s.from)} → ${fmtLt(s.to)} LT` })),
      rule: RULES.tasks,
    });
  }

  const summary = warnings.length
    ? `${warnings.length} warning${warnings.length > 1 ? 's' : ''}: ${warnings.map(w => w.title).join('; ')}`
    : 'No knock-on effects detected.';

  return { deltaEtbHours, deltaEtdHours, before, after, transitBefore, transitAfter, costLines, costTotal, taskShifts, warnings, summary };
}

/** Cumulative cost impact of the current schedule against the nominated baseline. */
export function cumulativeImpact(pc: PortCall, vessel: Vessel): { lines: CostImpactLine[]; total: number } {
  const missed = !!pc.suez && pc.suez.passageHours > 0 &&
    (!!pc.suez.originalConvoy || checkTransit(pc, pc.suez).missed);
  const lines = scheduleCostImpact(pc, vessel, pc.baseline, pc, missed);
  return { lines, total: sumMoney(lines.map(l => l.amount)) };
}
