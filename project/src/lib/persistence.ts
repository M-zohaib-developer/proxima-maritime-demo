// Static-site persistence: the whole demo state is one JSON document in the
// browser's localStorage. No server, no database. If storage is unavailable
// (private mode, blocked), the demo still runs in memory.
import type { DemoState } from '@/types';
import { STATE_VERSION } from '@/lib/sampleData';

export const STORAGE_KEY = 'proxima-demo-state-v3';

export function loadState(): DemoState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoState;
    if (!parsed || parsed.version !== STATE_VERSION || !Array.isArray(parsed.portCalls)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: DemoState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — keep running in memory */
  }
}

export function clearState(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
