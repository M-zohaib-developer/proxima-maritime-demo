// PDA ↔ FDA reconciliation. Reasons come only from invoice notes or recorded
// PDA edits — a difference with neither is flagged "unexplained", never guessed.
import type { FDA, FDALine, HistoricalCall, LineCode, PDA, PortCall, Vessel } from '@/types';
import { PORT_TARIFFS, SUEZ_TABLE, band, tugsForLoa } from '@/lib/tariffs';
import { fmtLt, hoursBetween } from '@/lib/time';
import { lineAmount, num, pctOf, round2, sumMoney } from '@/lib/format';
import {
  anchorageChargeableHours, anchorageHourlyRate, berthDays, berthRate, extraLaunchTrips,
  portDuePeriods, portDuesRate, portStayHours, similarCalls, suezRate,
} from '@/services/pdaEngine';

export type DiffStatus = 'match' | 'explained' | 'unexplained';

export interface ComparisonRow {
  code: LineCode;
  description: string;
  pda: number;
  fda: number;
  diff: number;
  pct: number | null;
  status: DiffStatus;
  reason?: string;
  pdaEditNote?: string;
}

export interface Comparison {
  rows: ComparisonRow[];
  pdaTotal: number;
  fdaTotal: number;
  diff: number;
  pct: number | null;
  explainedDiff: number;
  unexplainedDiff: number;
  counts: Record<DiffStatus, number>;
}

const ORDER: LineCode[] = ['port-dues', 'anchorage', 'pilotage-in', 'pilotage-out', 'towage-in', 'towage-out', 'berth', 'agency', 'suez-dues', 'transit-amendment', 'launch', 'sundries'];

function finish(rows: ComparisonRow[]): Comparison {
  rows.sort((a, b) => ORDER.indexOf(a.code) - ORDER.indexOf(b.code));
  const pdaTotal = sumMoney(rows.map(r => r.pda));
  const fdaTotal = sumMoney(rows.map(r => r.fda));
  const diff = round2(fdaTotal - pdaTotal);
  const counts = { match: 0, explained: 0, unexplained: 0 } as Record<DiffStatus, number>;
  rows.forEach(r => { counts[r.status]++; });
  return {
    rows, pdaTotal, fdaTotal, diff, pct: pctOf(diff, pdaTotal),
    explainedDiff: sumMoney(rows.filter(r => r.status === 'explained').map(r => r.diff)),
    unexplainedDiff: sumMoney(rows.filter(r => r.status === 'unexplained').map(r => r.diff)),
    counts,
  };
}

function row(code: LineCode, description: string, pda: number, fda: number, note?: string, pdaEditNote?: string): ComparisonRow {
  const diff = round2(fda - pda);
  const status: DiffStatus = Math.abs(diff) < 0.005 ? 'match' : note ? 'explained' : 'unexplained';
  return { code, description, pda, fda, diff, pct: pctOf(diff, pda), status, reason: status === 'match' ? undefined : note, pdaEditNote };
}

export function compareHistorical(h: HistoricalCall): Comparison {
  return finish(h.lines.map(l => row(l.code, l.description, l.pda, l.fda, l.invoiceNote)));
}

export function comparePdaFda(pda: PDA, fda: FDA): Comparison {
  const codes = new Set<LineCode>([...pda.lineItems.map(l => l.code), ...fda.lines.map(l => l.code)]);
  const rows: ComparisonRow[] = [];
  codes.forEach(code => {
    const p = pda.lineItems.find(l => l.code === code);
    const f = fda.lines.find(l => l.code === code);
    rows.push(row(code, f?.description ?? p!.description, p?.amount ?? 0, f?.amount ?? 0,
      f?.invoiceNote, p?.edited ? `PDA edited by ${p.editedBy}: ${p.editNote}` : undefined));
  });
  return finish(rows);
}

/**
 * Sample final invoices for a call. Amounts follow the illustrative tariff
 * applied to the schedule as it actually ran, plus two fixed sample events:
 * a weather-related third tug on departure and a sundries invoice that arrives
 * without a breakdown (left unexplained on purpose).
 */
export function sampleFinalInvoices(pc: PortCall, vessel: Vessel, history: HistoricalCall[]): FDALine[] {
  const t = PORT_TARIFFS[pc.port];
  const inv = (n: number) => `INV-${pc.ref}-${String(n).padStart(2, '0')}`;
  const lines: FDALine[] = [];
  const periods = portDuePeriods(pc);
  const basePeriods = portDuePeriods(pc.baseline);
  lines.push({
    code: 'port-dues', description: 'Port dues', invoiceRef: inv(1),
    amount: lineAmount(periods, portDuesRate(t, vessel)),
    invoiceNote: periods !== basePeriods
      ? `Vessel in port ${num(portStayHours(pc))} h (ETA ${fmtLt(pc.eta)} → ETD ${fmtLt(pc.etd)}): ${periods} × 24 h periods instead of ${basePeriods}.`
      : undefined,
  });
  const ancH = anchorageChargeableHours(t, pc);
  if (ancH > 0) {
    lines.push({
      code: 'anchorage', description: 'Anchorage dues', invoiceRef: inv(2),
      amount: lineAmount(ancH, anchorageHourlyRate(t, vessel)),
      invoiceNote: `${num(hoursBetween(pc.eta, pc.etb))} h at anchorage awaiting berth (${num(ancH)} h chargeable after ${t.anchorageFreeHours} h free).${pc.delayReason ? ` Cause: ${pc.delayReason}` : ''}`,
    });
  }
  const pil = band(t.pilotage, vessel.gt).value;
  lines.push({ code: 'pilotage-in', description: 'Pilotage — inward', invoiceRef: inv(3), amount: pil });
  lines.push({ code: 'pilotage-out', description: 'Pilotage — outward', invoiceRef: inv(3), amount: pil });
  const tugs = tugsForLoa(t, vessel.loa);
  lines.push({ code: 'towage-in', description: 'Towage — inward', invoiceRef: inv(4), amount: lineAmount(tugs, t.tugPerMove) });
  lines.push({
    code: 'towage-out', description: 'Towage — outward', invoiceRef: inv(4), amount: lineAmount(tugs + 1, t.tugPerMove),
    invoiceNote: 'Third tug ordered by harbour master — wind above 25 kn on departure (sample event).',
  });
  lines.push({ code: 'berth', description: 'Berth charges', invoiceRef: inv(5), amount: lineAmount(berthDays(pc), berthRate(t, vessel)) });
  lines.push({ code: 'agency', description: 'Agency fee', invoiceRef: inv(6), amount: band(t.agencyFee, vessel.gt).value });
  if (pc.suez && pc.services.includes('suez-transit')) {
    lines.push({
      code: 'suez-dues', description: `Suez Canal dues (${pc.suez.direction.toLowerCase()}, ${pc.suez.condition.toLowerCase()})`, invoiceRef: inv(7),
      amount: lineAmount(vessel.scnt, suezRate(vessel, pc.suez.condition)),
    });
    if (pc.suez.originalConvoy) {
      lines.push({
        code: 'transit-amendment', description: 'Suez transit amendment', invoiceRef: inv(8), amount: SUEZ_TABLE.amendmentCharge,
        invoiceNote: `Convoy moved ${fmtLt(pc.suez.originalConvoy)} → ${fmtLt(pc.suez.convoy)} LT after missed cut-off (illustrative charge).`,
      });
    }
  }
  const past = similarCalls(pc, history);
  const baseTrips = past.length ? Math.round(past.reduce((s, p) => s + p.metrics.launchTrips, 0) / past.length) : 3;
  const extra = extraLaunchTrips(t, pc) - extraLaunchTrips(t, pc.baseline);
  lines.push({
    code: 'launch', description: 'Launch hire', invoiceRef: inv(9), amount: lineAmount(baseTrips + extra, t.launchPerTrip),
    invoiceNote: extra > 0 ? `${baseTrips + extra} trips, including ${extra} during the anchorage wait.` : undefined,
  });
  lines.push({ code: 'sundries', description: 'Sundries & communications', invoiceRef: inv(10), amount: 1_086.5 });
  return lines;
}
