import { AlertOctagon, AlertTriangle, CheckCircle2, CircleDashed, HelpCircle, Info, Loader2, Minus } from 'lucide-react';
import type { PDAStatus, PortCallStatus, SuezTransit, TaskPriority, TaskStatus, WarningSeverity, Warning } from '@/types';
import type { DiffStatus } from '@/services/fdaService';

const tone = {
  neutral: 'bg-cloud text-slate border border-line',
  blue: 'bg-harbor-100 text-harbor-700',
  teal: 'bg-teal-100 text-teal-700',
  ocean: 'bg-ocean-700 text-white',
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-warning-dark',
  critical: 'bg-critical-light text-critical-dark',
  info: 'bg-info-light text-info',
};
type Tone = keyof typeof tone;

function B({ t, children, className = '' }: { t: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`badge ${tone[t]} ${className}`}>{children}</span>;
}

const dot = (c: string) => <span className={`w-1.5 h-1.5 rounded-full ${c}`} />;

export function PortCallStatusBadge({ status }: { status: PortCallStatus }) {
  const map: Record<PortCallStatus, [Tone, string]> = {
    'Nominated': ['neutral', 'bg-slate'],
    'Pre-arrival': ['blue', 'bg-harbor-600'],
    'At Anchorage': ['warning', 'bg-warning'],
    'At Berth': ['success', 'bg-success'],
    'In Transit': ['teal', 'bg-teal-500'],
    'Completed': ['neutral', 'bg-ocean-400'],
  };
  const [t, d] = map[status];
  return <B t={t}>{dot(d)}{status}</B>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  if (status === 'Done') return <B t="success"><CheckCircle2 size={11} />Done</B>;
  if (status === 'In Progress') return <B t="blue"><Loader2 size={11} />In progress</B>;
  return <B t="neutral"><CircleDashed size={11} />Open</B>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const t: Record<TaskPriority, Tone> = { High: 'critical', Medium: 'warning', Low: 'neutral' };
  return <B t={t[priority]}>{priority}</B>;
}

export function PDAStatusBadge({ status }: { status: PDAStatus }) {
  const t: Record<PDAStatus, Tone> = { None: 'neutral', Draft: 'warning', Approved: 'success', Sent: 'teal' };
  const label = status === 'None' ? 'Not drafted' : status === 'Sent' ? 'Sent to owner' : status;
  return <B t={t[status]}>{label}</B>;
}

export function SeverityBadge({ severity }: { severity: WarningSeverity }) {
  if (severity === 'critical') return <B t="critical"><AlertOctagon size={11} />Critical</B>;
  if (severity === 'warning') return <B t="warning"><AlertTriangle size={11} />Warning</B>;
  return <B t="info"><Info size={11} />Info</B>;
}

export function WarningStatusBadge({ status }: { status: Warning['status'] }) {
  const t: Record<Warning['status'], Tone> = { Open: 'critical', Acknowledged: 'blue', Resolved: 'success' };
  return <B t={t[status]}>{status}</B>;
}

export function TransitStatusBadge({ status }: { status: SuezTransit['status'] }) {
  const t: Record<SuezTransit['status'], Tone> = { Requested: 'blue', Confirmed: 'success', 'At Risk': 'critical', 'Rebooking Requested': 'warning' };
  return <B t={t[status]}>{status === 'At Risk' && <AlertTriangle size={11} />}{status}</B>;
}

export function DiffStatusBadge({ status }: { status: DiffStatus }) {
  if (status === 'match') return <B t="neutral"><Minus size={11} />Match</B>;
  if (status === 'explained') return <B t="info"><CheckCircle2 size={11} />Explained</B>;
  return <B t="critical"><HelpCircle size={11} />Unexplained</B>;
}
