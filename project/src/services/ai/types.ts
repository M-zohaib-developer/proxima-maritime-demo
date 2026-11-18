// Service boundary for the "AI" steps in the demo. The shipped implementation
// (`simulated.ts`) is deterministic: regex parsing of the predefined emails,
// tariff arithmetic and templated drafting. A real model-backed implementation
// can implement the same interface later without UI changes.
import type {
  Company, DemoEmail, HistoricalCall, PDALineItem, PortCall, PortName,
  Schedule, ServiceKey, Staff, Task, Vessel, VesselType, ClientUpdateSnapshot,
} from '@/types';
import type { ScheduleAssessment } from '@/services/scheduleRules';

export interface NominationDraft {
  vesselName: string;
  imo: string;
  vesselType: VesselType;
  flag: string;
  dwt: string;
  gt: string;
  nrt: string;
  loa: string;
  port: PortName;
  purpose: string;
  cargo: string;
  cargoQty: string;
  charterer: string;
  eta: string;          // LT
  etb: string;          // LT
  etd: string;          // LT
  services: ServiceKey[];
  ownerName: string;
  ownerContact: string;
  ownerEmail: string;
  suezDirection: '' | 'Southbound' | 'Northbound';
  suezCondition: 'Laden' | 'Ballast';
  suezConvoyDate: string; // YYYY-MM-DD
}

export interface NominationExtraction {
  draft: NominationDraft;
  /** field → exact line from the email the value came from */
  evidence: Partial<Record<keyof NominationDraft, string>>;
  matchedVesselId?: string;
  matchedOwnerId?: string;
  matchedChartererId?: string;
  notes: string[];
}

export interface TaskSuggestion {
  title: string;
  description: string;
  category: Task['category'];
  assigneeId: string;
  dueAt: string;
  /** due time follows ETB when set; cleared if the operator overrides the due time */
  etbOffsetHours?: number;
  priority: Task['priority'];
  rule: string;
  evidence: string[];
}

export interface ClientUpdateInput {
  portCall: PortCall;
  vessel: Vessel;
  owner: Company;
  approvedPdaTotal?: number;
  pdaStatus: 'None' | 'Draft' | 'Approved' | 'Sent';
  operator: Staff;
  inquiry?: DemoEmail;
}

export interface ClientUpdateDraft {
  subject: string;
  body: string;
  snapshot: ClientUpdateSnapshot;
  sources: string[];
}

export interface AIService {
  readonly mode: 'simulated' | 'model';
  readonly label: string;
  extractNomination(email: DemoEmail, ctx: { vessels: Vessel[]; companies: Company[] }): Promise<NominationExtraction>;
  extractTasks(email: DemoEmail, portCall: PortCall, staff: Staff[]): Promise<TaskSuggestion[]>;
  draftPda(portCall: PortCall, vessel: Vessel, history: HistoricalCall[]): Promise<{ lines: PDALineItem[]; basedOn: string[] }>;
  assessScheduleChange(portCall: PortCall, vessel: Vessel, after: Schedule, tasks: Task[], reason: string): Promise<ScheduleAssessment>;
  draftClientUpdate(input: ClientUpdateInput): Promise<ClientUpdateDraft>;
}
