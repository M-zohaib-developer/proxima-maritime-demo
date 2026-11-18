// Builds a validated port call from a reviewed nomination draft.
import type { DemoState, PortCall, PortName, Vessel } from '@/types';
import type { NominationDraft } from '@/services/ai/types';
import { addHours, hoursBetween, isValidLt } from '@/lib/time';
import { convoyFor } from '@/services/scheduleRules';
import { SUEZ_TABLE } from '@/lib/tariffs';

export const PORT_PREFIX: Record<PortName, string> = { Alexandria: 'ALX', Damietta: 'DAM', 'Port Said': 'PSD', Dubai: 'DXB' };
/** illustrative passage from port to the Suez convoy waiting area */
export const PASSAGE_HOURS: Record<PortName, number> = { Alexandria: 14, Damietta: 6, 'Port Said': 2, Dubai: 0 };

export type NominationErrors = Partial<Record<keyof NominationDraft, string>>;

const toNum = (s: string) => Number(String(s).replace(/,/g, '').trim());

export function validateNomination(d: NominationDraft): NominationErrors {
  const e: NominationErrors = {};
  if (!d.vesselName.trim()) e.vesselName = 'Vessel name is required';
  if (!/^\d{7}$/.test(d.imo)) e.imo = 'IMO-style number must be 7 digits';
  for (const k of ['dwt', 'gt', 'nrt'] as const) {
    if (!(toNum(d[k]) > 0)) e[k] = 'Enter a positive number';
  }
  if (!(toNum(d.loa) > 0 && toNum(d.loa) < 500)) e.loa = 'LOA must be between 0 and 500 m';
  if (!d.purpose.trim()) e.purpose = 'Operation is required';
  if (!d.ownerName.trim()) e.ownerName = 'Owner is required';
  if (!isValidLt(d.eta)) e.eta = 'Valid ETA required';
  if (!isValidLt(d.etb)) e.etb = 'Valid ETB required';
  else if (isValidLt(d.eta) && hoursBetween(d.eta, d.etb) < 0) e.etb = 'ETB cannot be before ETA';
  if (!isValidLt(d.etd)) e.etd = 'Valid ETD required';
  else if (isValidLt(d.etb) && hoursBetween(d.etb, d.etd) <= 0) e.etd = 'ETD must be after ETB';
  if (d.services.includes('suez-transit')) {
    if (!d.suezDirection) e.suezDirection = 'Choose a transit direction';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.suezConvoyDate)) e.suezConvoyDate = 'Requested convoy date required';
  }
  if (!d.services.length) e.services = 'Select at least one service';
  return e;
}

export function nextRef(state: DemoState, port: PortName): string {
  const prefix = PORT_PREFIX[port];
  const nums = state.portCalls.filter(p => p.ref.startsWith(prefix)).map(p => Number(p.ref.split('-').pop()));
  return `${prefix}-26-${String(Math.max(400, ...nums) + 1).padStart(4, '0')}`;
}

export function buildPortCallFromNomination(
  d: NominationDraft, state: DemoState,
  match: { vesselId?: string; ownerId?: string; chartererId?: string }, at: string,
): { portCall: PortCall; vessel?: Vessel } {
  const owner = state.companies.find(c => c.id === match.ownerId) ??
    state.companies.find(c => c.kind === 'owner' && c.name.toLowerCase() === d.ownerName.trim().toLowerCase());
  const existing = state.vessels.find(v => v.id === match.vesselId && v.imo === d.imo) ?? state.vessels.find(v => v.imo === d.imo);
  const vessel: Vessel = existing ?? {
    id: `vsl-${d.imo}`, name: d.vesselName.trim(), imo: d.imo, type: d.vesselType, flag: d.flag.trim() || '—',
    gt: toNum(d.gt), nrt: toNum(d.nrt), dwt: toNum(d.dwt), loa: toNum(d.loa), built: 0,
    scnt: Math.round(toNum(d.gt) * 0.95), ownerId: owner?.id ?? 'own-unknown',
  };

  let suez: PortCall['suez'];
  if (d.services.includes('suez-transit') && d.suezDirection) {
    const passage = PASSAGE_HOURS[d.port as PortName];
    const requested = `${d.suezConvoyDate}T${String(SUEZ_TABLE.convoyHourLt).padStart(2, '0')}:00:00`;
    const c = isValidLt(requested) ? { convoy: requested, cutoff: addHours(requested, -SUEZ_TABLE.cutoffHoursBeforeConvoy) } : convoyFor(addHours(d.etd, passage));
    suez = {
      direction: d.suezDirection, condition: d.suezCondition, convoy: c.convoy, cutoff: c.cutoff,
      waitingArea: d.suezDirection === 'Southbound' ? 'Port Said' : 'Suez', passageHours: passage, status: 'Requested',
    };
  }

  const schedule = { eta: d.eta, etb: d.etb, etd: d.etd };
  const portCall: PortCall = {
    id: `pc-${d.imo}-${PORT_PREFIX[d.port as PortName].toLowerCase()}`,
    ref: nextRef(state, d.port as PortName),
    vesselId: vessel.id, vesselName: vessel.name, vesselType: vessel.type,
    ownerId: owner?.id ?? vessel.ownerId, ownerName: owner?.name ?? d.ownerName.trim(),
    chartererId: match.chartererId,
    port: d.port as PortName, purpose: d.purpose.trim(), cargo: d.cargo.trim() || undefined, cargoQty: d.cargoQty.trim() || undefined,
    services: d.services, status: 'Nominated', ...schedule, baseline: { ...schedule },
    suez, nextStep: 'Draft PDA for owner approval; confirm berth line-up.',
    createdFrom: 'email', createdAt: at,
  };
  return { portCall, vessel: existing ? undefined : vessel };
}
