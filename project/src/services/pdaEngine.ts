// Deterministic PDA engine: drafts line items from the illustrative port tariff,
// the vessel's particulars, the port-call schedule and similar past calls.
// Every line carries its source and the basis of the calculation.
import type { HistoricalCall, PDA, PDALineItem, PortCall, Schedule, Vessel } from '@/types';
import { PORT_TARIFFS, SUEZ_TABLE, band, tugsForLoa, type PortTariff } from '@/lib/tariffs';
import { hoursBetween } from '@/lib/time';
import { lineAmount, num, round2, sumMoney } from '@/lib/format';

// ── shared tariff calculations (also used by the early-warning rules) ────────
export function portStayHours(s: Schedule): number {
  return Math.max(0, hoursBetween(s.eta, s.etd));
}
export function portDuePeriods(s: Schedule): number {
  return Math.max(1, Math.ceil(portStayHours(s) / 24 - 1e-9));
}
export function portDuesRate(t: PortTariff, v: Vessel): number {
  return round2(v.gt * t.portDuesPerGtPer24h);
}
export function anchorageWaitHours(s: Schedule): number {
  return Math.max(0, hoursBetween(s.eta, s.etb));
}
export function anchorageChargeableHours(t: PortTariff, s: Schedule): number {
  return Math.max(0, Math.round((anchorageWaitHours(s) - t.anchorageFreeHours) * 100) / 100);
}
export function anchorageHourlyRate(t: PortTariff, v: Vessel): number {
  return round2((v.gt * t.anchoragePerGtPerDay) / 24);
}
export function berthDays(s: Schedule): number {
  return Math.max(1, Math.ceil(Math.max(0, hoursBetween(s.etb, s.etd)) / 24 - 1e-9));
}
export function berthRate(t: PortTariff, v: Vessel): number {
  return round2(v.loa * t.berthPerMetrePerDay);
}
export function extraLaunchTrips(t: PortTariff, s: Schedule): number {
  const h = anchorageChargeableHours(t, s);
  return h > 0 ? Math.ceil(h / 12) * t.extraLaunchTripsPer12hWait : 0;
}
export function suezRate(v: Vessel, condition: 'Laden' | 'Ballast'): number {
  return SUEZ_TABLE.ratePerScnt[v.type][condition];
}

export function similarCalls(pc: Pick<PortCall, 'port' | 'vesselType'>, history: HistoricalCall[]): HistoricalCall[] {
  return history
    .filter(h => h.port === pc.port && h.vesselType === pc.vesselType)
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    .slice(0, 2);
}

export function pdaTotal(pda: Pick<PDA, 'lineItems'> | undefined | null): number {
  return pda ? sumMoney(pda.lineItems.map(l => l.amount)) : 0;
}

function line(
  pcId: string, code: PDALineItem['code'], description: string,
  quantity: number, unit: string, rate: number, source: string, basis: string, editable = true,
): PDALineItem {
  return { id: `${pcId}-${code}`, code, description, quantity, unit, rate, amount: lineAmount(quantity, rate), source, basis, editable, edited: false };
}

export function draftPdaLines(pc: PortCall, vessel: Vessel, history: HistoricalCall[]): { lines: PDALineItem[]; basedOn: string[] } {
  const t = PORT_TARIFFS[pc.port];
  const past = similarCalls(pc, history);
  const pastLabel = past.map(p => `${p.vesselName} (${p.ref})`).join(', ');
  const lines: PDALineItem[] = [];

  const stay = portStayHours(pc);
  const periods = portDuePeriods(pc);
  lines.push(line(pc.id, 'port-dues', 'Port dues', periods, '24 h period', portDuesRate(t, vessel),
    `${t.ref} §1`,
    `${periods} started 24 h periods in port (ETA→ETD ${num(stay)} h) × GT ${num(vessel.gt)} × USD ${t.portDuesPerGtPer24h}/GT`));

  const ancH = anchorageChargeableHours(t, pc);
  if (ancH > 0) {
    lines.push(line(pc.id, 'anchorage', 'Anchorage dues', ancH, 'h', anchorageHourlyRate(t, vessel),
      `${t.ref} §2`,
      `${num(anchorageWaitHours(pc))} h planned wait − ${t.anchorageFreeHours} h free × GT ${num(vessel.gt)} × USD ${t.anchoragePerGtPerDay}/GT/day`));
  }

  const pil = band(t.pilotage, vessel.gt).value;
  const pilBasis = `GT ${num(vessel.gt)} falls in band ≤ ${band(t.pilotage, vessel.gt).maxGt === Infinity ? 'max' : num(band(t.pilotage, vessel.gt).maxGt)} GT`;
  lines.push(line(pc.id, 'pilotage-in', 'Pilotage — inward', 1, 'move', pil, `${t.ref} §3`, pilBasis));
  lines.push(line(pc.id, 'pilotage-out', 'Pilotage — outward', 1, 'move', pil, `${t.ref} §3`, pilBasis));

  const tugs = tugsForLoa(t, vessel.loa);
  const tugHist = past.length ? ` Past calls used ${past.map(p => p.metrics.tugsIn).join('/')} inward, ${past.map(p => p.metrics.tugsOut).join('/')} outward.` : '';
  lines.push(line(pc.id, 'towage-in', 'Towage — inward', tugs, 'tug', t.tugPerMove, `${t.ref} §4`,
    `LOA ${vessel.loa} m → ${tugs} tugs per tariff rule.${tugHist}`));
  lines.push(line(pc.id, 'towage-out', 'Towage — outward', tugs, 'tug', t.tugPerMove, `${t.ref} §4`,
    `LOA ${vessel.loa} m → ${tugs} tugs per tariff rule.${tugHist}`));

  const days = berthDays(pc);
  lines.push(line(pc.id, 'berth', 'Berth charges', days, 'day', berthRate(t, vessel), `${t.ref} §5`,
    `${days} started days alongside (ETB→ETD ${num(Math.max(0, hoursBetween(pc.etb, pc.etd)))} h) × LOA ${vessel.loa} m × USD ${t.berthPerMetrePerDay}/m/day`));

  const agency = band(t.agencyFee, vessel.gt).value;
  lines.push(line(pc.id, 'agency', 'Agency fee', 1, 'lump sum', agency, 'Sample agency schedule A-26',
    `Contract rate for GT band — locked, changes need a contract amendment`, false));

  if (pc.suez && pc.services.includes('suez-transit')) {
    const cond = pc.suez.condition;
    lines.push(line(pc.id, 'suez-dues', `Suez Canal dues (${pc.suez.direction.toLowerCase()}, ${cond.toLowerCase()})`,
      vessel.scnt, 'SCNT', suezRate(vessel, cond), SUEZ_TABLE.ref,
      `SCNT ${num(vessel.scnt)} × illustrative ${vessel.type.toLowerCase()} ${cond.toLowerCase()} rate`));
  }

  const trips = past.length ? Math.round(past.reduce((s, p) => s + p.metrics.launchTrips, 0) / past.length) : 3;
  lines.push(line(pc.id, 'launch', 'Launch hire', trips, 'trip', t.launchPerTrip,
    past.length ? `Past calls + ${t.ref} §6` : `${t.ref} §6`,
    past.length ? `Average of ${past.map(p => `${p.metrics.launchTrips}`).join(' and ')} trips on ${pastLabel}` : 'Default 3 trips'));

  const sundries = past.length ? round2(past.reduce((s, p) => s + p.metrics.sundries, 0) / past.length) : t.sundriesDefault;
  lines.push(line(pc.id, 'sundries', 'Sundries & communications', 1, 'lump sum', sundries,
    past.length ? 'Past calls (FDA actuals)' : 'Default estimate',
    past.length ? `Average of final invoices ${past.map(p => `USD ${num(p.metrics.sundries)}`).join(' and ')} on ${pastLabel} — lowest-confidence line, review` : `Default for ${pc.port}`));

  return { lines, basedOn: past.map(p => `${p.vesselName} — ${p.port} ${p.ref} (PDA + FDA)`) };
}

/** Apply a D/A edit to a line. Returns a new line; amount recalculated from qty × rate. */
export function editLine(li: PDALineItem, quantity: number, rate: number, note: string, editedBy: string): PDALineItem {
  return {
    ...li,
    quantity, rate,
    amount: lineAmount(quantity, rate),
    edited: true,
    original: li.original ?? { quantity: li.quantity, rate: li.rate, amount: li.amount },
    editNote: note,
    editedBy,
  };
}
