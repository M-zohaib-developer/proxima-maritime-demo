import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { buildInitialState } from '@/lib/sampleData';
import { STORAGE_KEY, clearState, loadState, saveState } from '@/lib/persistence';
import { currentUserOf, reducer, type Action } from '@/lib/demoReducer';
import type { DemoState, Staff } from '@/types';

export { reducer, uid, currentUserOf, type Action } from '@/lib/demoReducer';

// ── Routing (hash based — works on any static host) ──────────────────────────
export type PageKey =
  | 'overview' | 'port-calls' | 'port-call-detail' | 'vessels' | 'email-inbox' | 'operations'
  | 'suez' | 'disbursement' | 'pda-vs-fda' | 'client-portal' | 'activity-log' | 'settings';

const PAGES: PageKey[] = ['overview', 'port-calls', 'port-call-detail', 'vessels', 'email-inbox', 'operations', 'suez', 'disbursement', 'pda-vs-fda', 'client-portal', 'activity-log', 'settings'];

export interface Route { page: PageKey; id?: string; tab?: string }

export function parseHash(hash: string): Route {
  const [page, id, tab] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  return PAGES.includes(page as PageKey) ? { page: page as PageKey, id: id || undefined, tab: tab || undefined } : { page: 'overview' };
}

export function routeToHash(r: Route): string {
  return `#/${[r.page, r.id, r.tab].filter(Boolean).map(x => encodeURIComponent(x!)).join('/')}`;
}

// ── Context ───────────────────────────────────────────────────────────────────
interface DemoContextValue {
  state: DemoState;
  dispatch: React.Dispatch<Action>;
  route: Route;
  navigate: (page: PageKey, id?: string, tab?: string) => void;
  user: Staff;
  resetDemo: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemoStore(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemoStore must be used within DemoProvider');
  return ctx;
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState() ?? buildInitialState());
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const fromOtherTab = useRef(false);

  // persist every change (one small JSON document)
  useEffect(() => {
    if (fromOtherTab.current) { fromOtherTab.current = false; return; }
    saveState(state);
  }, [state]);

  // keep a second tab (e.g. the client view) in sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = loadState();
      fromOtherTab.current = true;
      dispatch(next ? { type: 'LOAD', state: next } : { type: 'RESET' });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((page: PageKey, id?: string, tab?: string) => {
    const hash = routeToHash({ page, id, tab });
    if (window.location.hash !== hash) window.location.hash = hash;
    else setRoute({ page, id, tab });
  }, []);

  const resetDemo = useCallback(() => {
    clearState();
    dispatch({ type: 'RESET' });
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, route, navigate, user: currentUserOf(state), resetDemo }),
    [state, route, navigate, resetDemo],
  );
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
