// ─────────────────────────────────────────────────────────────────────────────
// Domain types — Proxima Ship Service demo (all data fictional / illustrative)
// Port-local times are stored as naive ISO strings "YYYY-MM-DDTHH:mm:ss" (LT).
// Audit timestamps (activity, approvals) are real UTC ISO strings.
// ─────────────────────────────────────────────────────────────────────────────

export type VesselType = 'Bulk Carrier' | 'Tanker' | 'Container' | 'General Cargo';
export type PortName = 'Alexandria' | 'Damietta' | 'Port Said' | 'Dubai';
export type PortCallStatus =
  | 'Nominated' | 'Pre-arrival' | 'At Anchorage' | 'At Berth'
  | 'In Transit' | 'Completed';
export type TaskPriority = 'High' | 'Medium' | 'Low';
export type TaskStatus = 'Open' | 'In Progress' | 'Done';
export type TaskCategory = 'crew-change' | 'provisions' | 'documents' | 'transit' | 'other';
export type PDAStatus = 'None' | 'Draft' | 'Approved' | 'Sent';
export type EmailType = 'nomination' | 'crew-change' | 'provisions' | 'status-inquiry';
export type WarningSeverity = 'critical' | 'warning' | 'info';
export type Desk = 'Operations' | 'D/A' | 'Suez' | 'Husbandry' | 'Logistics';
export type ServiceKey = 'full-agency' | 'suez-transit' | 'husbandry' | 'bunkering' | 'crew-change';
export type ActivityCategory =
  | 'port-call' | 'schedule' | 'pda' | 'task' | 'warning'
  | 'client-update' | 'email' | 'fda' | 'transit' | 'document' | 'system';

export interface Staff {
  id: string;
  name: string;
  title: string;
  desk: Desk;
  office: string;
  initials: string;
}

export interface Company {
  id: string;
  name: string;
  kind: 'owner' | 'charterer';
  country: string;
  city: string;
  contact: string;
  email: string;
  code: string;
}

export interface Vessel {
  id: string;
  name: string;
  imo: string;
  type: VesselType;
  flag: string;
  gt: number;
  nrt: number;
  dwt: number;
  loa: number;
  built: number;
  scnt: number;            // illustrative Suez Canal net tonnage
  ownerId: string;
}

export interface SuezTransit {
  direction: 'Southbound' | 'Northbound';
  condition: 'Laden' | 'Ballast';
  convoy: string;          // LT, convoy start
  cutoff: string;          // LT, latest arrival at waiting area
  waitingArea: 'Port Said' | 'Suez';
  passageHours: number;    // illustrative passage from port to waiting area
  status: 'Requested' | 'Confirmed' | 'At Risk' | 'Rebooking Requested';
  originalConvoy?: string;
}

export interface PortDocument {
  id: string;
  name: string;
  status: 'Missing' | 'Received';
  receivedAt?: string;
  receivedBy?: string;
}

export interface Schedule {
  eta: string;
  etb: string;
  etd: string;
}

export interface PortCall extends Schedule {
  id: string;
  ref: string;
  vesselId: string;
  vesselName: string;
  vesselType: VesselType;
  ownerId: string;
  ownerName: string;
  chartererId?: string;
  port: PortName;
  purpose: string;
  cargo?: string;
  cargoQty?: string;
  services: ServiceKey[];
  status: PortCallStatus;
  baseline: Schedule;        // schedule as nominated — used for change detection & client updates
  delayReason?: string;
  suez?: SuezTransit;
  /** required pre-arrival documents (sample) */
  documents?: PortDocument[];
  nextStep: string;
  createdFrom: 'email' | 'seed' | 'manual';
  createdAt: string;
}

export interface DemoEmail {
  id: string;
  type: EmailType;
  from: string;
  fromEmail: string;
  fromCompany: string;
  to: string;
  subject: string;
  body: string;
  receivedAt: string;
  status: 'New' | 'Processed';
  processedAt?: string;
  processedBy?: string;
  linkedPortCallId?: string;
  createdTaskIds?: string[];
}

export interface Task {
  id: string;
  portCallId: string;
  vesselName: string;
  category: TaskCategory;
  title: string;
  description: string;
  assigneeId: string;
  dueAt: string;               // LT
  priority: TaskPriority;
  status: TaskStatus;
  createdFrom: 'email' | 'manual' | 'seed';
  sourceEmailId?: string;
  /** when set, due time moves with the port call's ETB (offset in hours) */
  etbOffsetHours?: number;
  rule?: string;
  completedAt?: string;
  completedBy?: string;
}

export type LineCode =
  | 'port-dues' | 'anchorage' | 'pilotage-in' | 'pilotage-out'
  | 'towage-in' | 'towage-out' | 'berth' | 'agency'
  | 'suez-dues' | 'transit-amendment' | 'launch' | 'sundries';

export interface PDALineItem {
  id: string;
  code: LineCode;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  source: string;          // short source label
  basis: string;           // how the figure was derived
  editable: boolean;
  edited: boolean;
  original?: { quantity: number; rate: number; amount: number };
  editNote?: string;
  editedBy?: string;
}

export interface PDA {
  id: string;
  portCallId: string;
  status: 'Draft' | 'Approved' | 'Sent';
  lineItems: PDALineItem[];
  generatedAt: string;
  generatedBy: string;
  basedOn: string[];
  approvedAt?: string;
  approvedBy?: string;
  sentAt?: string;
  sentBy?: string;
}

export interface HistoricalLine {
  code: LineCode;
  description: string;
  pda: number;
  fda: number;
  invoiceNote?: string;
}

export interface HistoricalCall {
  id: string;
  ref: string;
  vesselName: string;
  vesselType: VesselType;
  port: PortName;
  completedAt: string;
  gt: number;
  metrics: { tugsIn: number; tugsOut: number; launchTrips: number; sundries: number };
  lines: HistoricalLine[];
}

export interface FDALine {
  code: LineCode;
  description: string;
  amount: number;
  invoiceRef: string;
  invoiceNote?: string;
}

export interface FDA {
  portCallId: string;
  receivedAt: string;
  lines: FDALine[];
  reconciledAt?: string;
  reconciledBy?: string;
}

export interface CostImpactLine {
  label: string;
  basis: string;
  amount: number;
}

export interface Warning {
  id: string;
  portCallId: string;
  vesselName: string;
  kind: 'transit-risk' | 'cost-impact' | 'task-reschedule' | 'missing-documents';
  severity: WarningSeverity;
  title: string;
  reason: string;
  facts: { label: string; value: string }[];
  costImpact?: number;
  costBreakdown?: CostImpactLine[];
  rule: string;
  triggeredAt: string;
  status: 'Open' | 'Acknowledged' | 'Resolved';
  resolution?: string;
  /** follow-up task created from this warning (missing documents) */
  followUpTaskId?: string;
}

export interface ClientUpdateSnapshot {
  eta: string;
  etb: string;
  etd: string;
  approvedPda?: number;
  delayImpact?: number;
  revisedEstimate?: number;
  transitStatus?: string;
  nextStep: string;
}

export interface ClientUpdate {
  id: string;
  portCallId: string;
  ownerId: string;
  vesselName: string;
  status: 'Draft' | 'Sent';
  subject: string;
  body: string;
  createdAt: string;
  createdBy: string;
  edited: boolean;
  approvedBy?: string;
  sentAt?: string;
  inReplyToEmailId?: string;
  snapshot: ClientUpdateSnapshot;
}

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  userId: string;
  user: string;
  action: string;
  category: ActivityCategory;
  portCallId?: string;
  entityLabel: string;
  details: string;
  changes?: FieldChange[];
}

export interface DemoState {
  version: number;
  currentUserId: string;
  staff: Staff[];
  companies: Company[];
  vessels: Vessel[];
  portCalls: PortCall[];
  emails: DemoEmail[];
  tasks: Task[];
  pdas: Record<string, PDA>;
  fdas: Record<string, FDA>;
  historical: HistoricalCall[];
  warnings: Warning[];
  clientUpdates: ClientUpdate[];
  activity: ActivityEvent[];
}
