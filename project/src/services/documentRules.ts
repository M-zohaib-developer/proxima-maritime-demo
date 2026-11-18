// Rule-based check for required pre-arrival documents.
// R-DOCS-01: every required document must be received by ETA − 24 h. Once the
// vessel is within 24 h of ETA and anything is still missing, raise a warning.
// "Now" is a fixed sample clock so the demo behaves identically on every replay.
import type { PortCall, PortDocument, Warning } from '@/types';
import { addHours, fmtLt, hoursBetween } from '@/lib/time';
import { num } from '@/lib/format';

export const SAMPLE_CLOCK_LT = '2026-11-18T12:00:00';
export const DOC_WINDOW_HOURS = 24;
export const DOC_RULE = 'R-DOCS-01 · all required pre-arrival documents received by ETA − 24 h';

export const REQUIRED_DOCUMENTS = ['Crew list', 'Cargo manifest', 'Maritime declaration of health', 'Ship security declaration (ISPS)'];

export function requiredDocuments(pcId: string, received: boolean | string[] = false, by?: string, at?: string): PortDocument[] {
  return REQUIRED_DOCUMENTS.map((name, i) => {
    const ok = received === true || (Array.isArray(received) && received.includes(name));
    return { id: `${pcId}-doc-${i + 1}`, name, status: ok ? 'Received' : 'Missing', ...(ok ? { receivedAt: at, receivedBy: by } : {}) };
  });
}

export interface DocumentCheck {
  total: number;
  missing: PortDocument[];
  deadline: string;        // LT, ETA − 24 h — when the documents were due
  hoursToDeadline: number; // sample clock → deadline (negative = deadline passed)
  hoursToEta: number;      // sample clock → vessel ETA (negative = vessel arrived)
  triggered: boolean;
  severity: 'warning' | 'critical';
}

export function checkDocuments(pc: PortCall, now: string = SAMPLE_CLOCK_LT): DocumentCheck | null {
  if (!pc.documents?.length) return null;
  const missing = pc.documents.filter(d => d.status === 'Missing');
  const hoursToEta = Math.round(hoursBetween(now, pc.eta) * 100) / 100;
  const deadline = addHours(pc.eta, -DOC_WINDOW_HOURS);
  return {
    total: pc.documents.length,
    missing,
    deadline,
    hoursToDeadline: Math.round(hoursBetween(now, deadline) * 100) / 100,
    hoursToEta,
    triggered: missing.length > 0 && hoursToEta <= DOC_WINDOW_HOURS,
    severity: hoursToEta < 12 ? 'critical' : 'warning',
  };
}

export function documentWarning(pc: PortCall, c: DocumentCheck, now: string = SAMPLE_CLOCK_LT): Omit<Warning, 'id' | 'triggeredAt' | 'status'> {
  const n = c.missing.length;
  const docs = `document${n === 1 ? '' : 's'}`;
  return {
    portCallId: pc.id, vesselName: pc.vesselName, kind: 'missing-documents', severity: c.severity,
    title: `${n} pre-arrival ${docs} overdue — ${deadlineText(c.hoursToDeadline)}`,
    reason: `Document deadline: ${fmtLt(c.deadline)} LT (ETA − ${DOC_WINDOW_HOURS} h) — ${deadlineText(c.hoursToDeadline)}, and ${n} of ${c.total} required ${docs} ${n === 1 ? 'is' : 'are'} still missing. Separately, the vessel's ETA is ${fmtLt(pc.eta)} LT — ${etaText(c.hoursToEta)}. Checked at ${fmtLt(now)} LT (sample clock).`,
    facts: [
      { label: 'Missing', value: c.missing.map(d => d.name).join(', ') },
      { label: 'Document deadline', value: `${fmtLt(c.deadline)} LT · ${deadlineText(c.hoursToDeadline)}` },
      { label: 'Vessel ETA', value: `${fmtLt(pc.eta)} LT · ${etaText(c.hoursToEta)}` },
      { label: 'Received', value: `${c.total - n} of ${c.total}` },
    ],
    rule: DOC_RULE,
  };
}

/** Document deadline, relative to the sample clock: "passed 6 h ago" / "due in 26 h". */
export function deadlineText(h: number): string {
  if (Math.abs(h) < 0.01) return 'due now';
  return h < 0 ? `passed ${num(-h)} h ago` : `due in ${num(h)} h`;
}

/** Vessel ETA, relative to the sample clock: "arrives in 18 h" / "arrived 3 h ago". */
export function etaText(h: number): string {
  if (Math.abs(h) < 0.01) return 'arriving now';
  return h < 0 ? `arrived ${num(-h)} h ago` : `arrives in ${num(h)} h`;
}
