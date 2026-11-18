import type { DemoState, PDA, PDAStatus, PortCall, Vessel, Warning } from '@/types';
import { pdaTotal } from '@/services/pdaEngine';

export const vesselOf = (s: DemoState, pc: PortCall): Vessel | undefined => s.vessels.find(v => v.id === pc.vesselId);
export const staffName = (s: DemoState, id: string) => s.staff.find(x => x.id === id)?.name ?? '—';
export const openTasks = (s: DemoState, pcId?: string) => s.tasks.filter(t => t.status !== 'Done' && (!pcId || t.portCallId === pcId));
export const activeWarnings = (s: DemoState, pcId?: string): Warning[] =>
  s.warnings.filter(w => w.status !== 'Resolved' && (!pcId || w.portCallId === pcId));
export const unackWarnings = (s: DemoState) => s.warnings.filter(w => w.status === 'Open');
export const pdaStatusOf = (s: DemoState, pcId: string): PDAStatus => (s.pdas[pcId] as PDA | undefined)?.status ?? 'None';
export const pdaTotalOf = (s: DemoState, pcId: string): number | undefined => ((s.pdas[pcId] as PDA | undefined) ? pdaTotal(s.pdas[pcId]) : undefined);
export const DEMO_PC_ID = 'pc-9526012-alx';
export const nileTrader = (s: DemoState) => s.portCalls.find(p => p.vesselId === 'vsl-nile');
