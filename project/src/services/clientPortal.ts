// Owner-scoped read model for the client portal.
// The portal UI only ever receives the output of `getOwnerPortal`, which
// contains nothing that belongs to another owner, no drafts, no internal
// tasks/warnings, and only human-approved financial figures.
import type { ClientUpdate, DemoState, PortCallStatus, Schedule, SuezTransit } from '@/types';
import { pdaTotal } from '@/services/pdaEngine';
import { cumulativeImpact } from '@/services/scheduleRules';

export interface TimelineItem {
  key: string;
  label: string;
  at?: string;           // LT
  previous?: string;     // LT before change
  state: 'done' | 'current' | 'upcoming';
  note?: string;
}

export interface OwnerCallView {
  id: string;
  ref: string;
  vesselName: string;
  vesselType: string;
  imo: string;
  flag: string;
  dwt: number;
  port: string;
  purpose: string;
  cargo?: string;
  status: PortCallStatus;
  statusNote?: string;
  schedule: Schedule;
  baseline: Schedule;
  suez?: Pick<SuezTransit, 'direction' | 'convoy' | 'status' | 'originalConvoy'>;
  timeline: TimelineItem[];
  approvedPda?: number;
  /** revised estimate taken from the latest approved & sent owner update */
  revisedEstimate?: { total: number; delayImpact: number; approvedAt: string };
  estimatePending: boolean;
  nextStep: string;
  updates: Pick<ClientUpdate, 'id' | 'subject' | 'body' | 'sentAt' | 'approvedBy'>[];
}

export interface OwnerPortal {
  owner: { id: string; name: string; contact: string; city: string; country: string };
  calls: OwnerCallView[];
}

const ARRIVED: PortCallStatus[] = ['At Anchorage', 'At Berth', 'In Transit', 'Completed'];
const BERTHED: PortCallStatus[] = ['At Berth', 'In Transit', 'Completed'];
const SAILED: PortCallStatus[] = ['In Transit', 'Completed'];

export function getOwnerPortal(state: DemoState, ownerId: string): OwnerPortal | null {
  const owner = state.companies.find(c => c.id === ownerId && c.kind === 'owner');
  if (!owner) return null;

  const calls = state.portCalls
    .filter(pc => pc.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))   // newest call first
    .map((pc): OwnerCallView => {
      const vessel = state.vessels.find(v => v.id === pc.vesselId && v.ownerId === ownerId);
      const pda = state.pdas[pc.id];
      const approved = pda && (pda.status === 'Approved' || pda.status === 'Sent') ? pda : undefined;
      const sent = state.clientUpdates
        .filter(u => u.portCallId === pc.id && u.ownerId === ownerId && u.status === 'Sent')
        .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''));
      const latest = sent[0];
      const scheduleChanged = pc.etb !== pc.baseline.etb || pc.etd !== pc.baseline.etd;
      const impact = vessel ? cumulativeImpact(pc, vessel).total : 0;
      const latestCoversCurrent = !!latest && latest.snapshot.etb === pc.etb && latest.snapshot.etd === pc.etd;
      const revised = latest?.snapshot.revisedEstimate !== undefined
        ? { total: latest.snapshot.revisedEstimate, delayImpact: latest.snapshot.delayImpact ?? 0, approvedAt: latest.sentAt ?? latest.createdAt }
        : undefined;

      const timeline: TimelineItem[] = [
        { key: 'nominated', label: 'Nomination accepted', state: 'done', note: pc.ref },
        { key: 'pda', label: 'PDA approved', state: approved ? 'done' : 'upcoming', note: approved ? undefined : 'Being prepared by the D/A team' },
        { key: 'eta', label: 'Arrival (ETA)', at: pc.eta, previous: pc.eta !== pc.baseline.eta ? pc.baseline.eta : undefined, state: ARRIVED.includes(pc.status) ? 'done' : 'upcoming' },
        { key: 'etb', label: 'Berthing (ETB)', at: pc.etb, previous: pc.etb !== pc.baseline.etb ? pc.baseline.etb : undefined, state: BERTHED.includes(pc.status) ? 'done' : 'upcoming', note: pc.etb !== pc.baseline.etb && pc.delayReason ? pc.delayReason : undefined },
        { key: 'etd', label: 'Departure (ETD)', at: pc.etd, previous: pc.etd !== pc.baseline.etd ? pc.baseline.etd : undefined, state: SAILED.includes(pc.status) ? 'done' : 'upcoming' },
      ];
      if (pc.suez) {
        timeline.push({
          key: 'suez', label: `Suez transit (${pc.suez.direction.toLowerCase()})`, at: pc.suez.convoy, previous: pc.suez.originalConvoy,
          state: pc.status === 'Completed' ? 'done' : pc.status === 'In Transit' ? 'current' : 'upcoming',
          note: pc.suez.status === 'Rebooking Requested' ? 'Rebooking requested — awaiting canal confirmation' : pc.suez.status === 'At Risk' ? 'Slot under review by Proxima' : undefined,
        });
      }
      const firstOpen = timeline.findIndex(t => t.state === 'upcoming');
      if (firstOpen >= 0 && !timeline.some(t => t.state === 'current')) timeline[firstOpen].state = 'current';

      return {
        id: pc.id, ref: pc.ref, vesselName: pc.vesselName, vesselType: pc.vesselType,
        imo: vessel?.imo ?? '—', flag: vessel?.flag ?? '—', dwt: vessel?.dwt ?? 0,
        port: pc.port, purpose: pc.purpose, cargo: pc.cargo ? `${pc.cargoQty ?? ''} ${pc.cargo}`.trim() : undefined,
        status: pc.status,
        statusNote: scheduleChanged ? 'Schedule revised' : undefined,
        schedule: { eta: pc.eta, etb: pc.etb, etd: pc.etd },
        baseline: pc.baseline,
        suez: pc.suez ? { direction: pc.suez.direction, convoy: pc.suez.convoy, status: pc.suez.status, originalConvoy: pc.suez.originalConvoy } : undefined,
        timeline,
        approvedPda: approved ? pdaTotal(approved) : undefined,
        revisedEstimate: revised,
        estimatePending: scheduleChanged && impact !== 0 && !latestCoversCurrent,
        nextStep: latest && latestCoversCurrent ? latest.snapshot.nextStep : pc.nextStep,
        updates: sent.map(u => ({ id: u.id, subject: u.subject, body: u.body, sentAt: u.sentAt, approvedBy: u.approvedBy })),
      };
    });

  return { owner: { id: owner.id, name: owner.name, contact: owner.contact, city: owner.city, country: owner.country }, calls };
}
