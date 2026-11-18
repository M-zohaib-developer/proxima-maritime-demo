import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Mail, Search, Ship, X } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { activeWarnings, openTasks, pdaStatusOf, pdaTotalOf } from '@/lib/selectors';
import { EmptyState, PageHeader } from '@/components/ui';
import { PDAStatusBadge, PortCallStatusBadge, TransitStatusBadge } from '@/components/StatusBadge';
import { fmtLt, ltToMs } from '@/lib/time';
import { usd } from '@/lib/format';
import type { PortCall, PortCallStatus, PortName } from '@/types';

const PORTS: (PortName | 'All')[] = ['All', 'Alexandria', 'Damietta', 'Port Said', 'Dubai'];
const STATUSES: (PortCallStatus | 'All')[] = ['All', 'Nominated', 'Pre-arrival', 'At Anchorage', 'At Berth', 'In Transit', 'Completed'];
type SortKey = 'vessel' | 'port' | 'eta' | 'etb' | 'etd' | 'tasks' | 'pda';

export default function PortCallBoard() {
  const { state, navigate } = useDemoStore();
  const [q, setQ] = useState('');
  const [port, setPort] = useState<PortName | 'All'>('All');
  const [status, setStatus] = useState<PortCallStatus | 'All'>('All');
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'eta', dir: 1 });

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = state.portCalls.filter(pc => {
      const hay = `${pc.vesselName} ${pc.ownerName} ${pc.port} ${pc.ref} ${pc.cargo ?? ''} ${pc.vesselType}`.toLowerCase();
      return (!needle || hay.includes(needle))
        && (port === 'All' || pc.port === port)
        && (status === 'All' || pc.status === status)
        && (!onlyAlerts || activeWarnings(state, pc.id).length > 0);
    });
    const val = (pc: PortCall): string | number => {
      switch (sort.key) {
        case 'vessel': return pc.vesselName;
        case 'port': return pc.port;
        case 'eta': return ltToMs(pc.eta);
        case 'etb': return ltToMs(pc.etb);
        case 'etd': return ltToMs(pc.etd);
        case 'tasks': return openTasks(state, pc.id).length;
        case 'pda': return pdaTotalOf(state, pc.id) ?? -1;
      }
    };
    return [...list].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [state, q, port, status, onlyAlerts, sort]);

  const filtered = q || port !== 'All' || status !== 'All' || onlyAlerts;
  const alertCount = state.portCalls.filter(pc => activeWarnings(state, pc.id).length > 0).length;

  function Th({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) {
    const active = sort.key === k;
    return (
      <th className={`th ${right ? 'text-right' : ''}`} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button className={`inline-flex items-center gap-1 hover:text-graphite transition-colors ${active ? 'text-graphite' : ''}`}
          onClick={() => setSort(s => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))}>
          {children}{active ? (sort.dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-40" />}
        </button>
      </th>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Live board" title="Port Call Board"
        subtitle={`${state.portCalls.length} port calls across Alexandria, Damietta, Port Said and Dubai. Click a row to open the call.`}
        actions={<><button className="btn-secondary btn-sm" onClick={() => navigate('email-inbox')}><Mail size={13} />Inbox</button></>} />

      <div className="card px-3 sm:px-4 py-3 mb-4 flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[14rem]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
          <input className="input pl-9" placeholder="Search vessel, owner, ref, cargo…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search port calls" />
        </div>
        <select className="input w-auto" value={port} onChange={e => setPort(e.target.value as PortName | 'All')} aria-label="Filter by port">
          {PORTS.map(p => <option key={p} value={p}>{p === 'All' ? 'All ports' : p}</option>)}
        </select>
        <select className="input w-auto" value={status} onChange={e => setStatus(e.target.value as PortCallStatus | 'All')} aria-label="Filter by status">
          {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All statuses' : s}</option>)}
        </select>
        <button onClick={() => setOnlyAlerts(o => !o)} className={`btn btn-sm h-9 border ${onlyAlerts ? 'bg-critical-light border-critical/30 text-critical-dark' : 'bg-white border-line text-slate hover:text-graphite'}`} aria-pressed={onlyAlerts}>
          <AlertTriangle size={13} />With warnings {alertCount > 0 && <span className="tabular">({alertCount})</span>}
        </button>
        {filtered && <button className="btn-ghost btn-sm" onClick={() => { setQ(''); setPort('All'); setStatus('All'); setOnlyAlerts(false); }}><X size={13} />Clear</button>}
        <span className="text-xs text-slate ml-auto tabular">{rows.length} of {state.portCalls.length}</span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[1080px]">
            <thead>
              <tr>
                <Th k="vessel">Vessel</Th>
                <Th k="port">Port</Th>
                <Th k="eta">ETA</Th>
                <Th k="etb">ETB</Th>
                <Th k="etd">ETD</Th>
                <th className="th">Status</th>
                <th className="th">Suez slot</th>
                <Th k="tasks" right>Open tasks</Th>
                <Th k="pda" right>PDA total</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9}><EmptyState title="No port calls match these filters" action={<button className="btn-secondary btn-sm" onClick={() => { setQ(''); setPort('All'); setStatus('All'); setOnlyAlerts(false); }}>Clear filters</button>} /></td></tr>
              ) : rows.map(pc => {
                const w = activeWarnings(state, pc.id).filter(x => x.severity !== 'info');
                const crit = w.some(x => x.severity === 'critical');
                const tasks = openTasks(state, pc.id).length;
                const total = pdaTotalOf(state, pc.id);
                const delayed = pc.etb !== pc.baseline.etb;
                return (
                  <tr key={pc.id} onClick={() => navigate('port-call-detail', pc.id)} onKeyDown={e => { if (e.key === 'Enter') navigate('port-call-detail', pc.id); }}
                    tabIndex={0} className={`border-b border-line last:border-0 tr-hover cursor-pointer focus:outline-none focus-visible:bg-harbor-50 ${crit ? 'bg-critical-light/40' : ''}`}>
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <span className={`relative w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${crit ? 'bg-critical-light text-critical' : 'bg-cloud text-ocean-600'}`}>
                          <Ship size={15} />
                          {w.length > 0 && <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white ${crit ? 'bg-critical animate-pulse-ring' : 'bg-warning'}`} />}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-graphite leading-tight">{pc.vesselName}{pc.createdFrom === 'email' && <span className="badge bg-teal-50 text-teal-700 ml-2 align-middle"><Mail size={10} />new</span>}</p>
                          <p className="text-2xs text-slate truncate">{pc.vesselType} · {pc.ownerName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td"><p className="text-graphite">{pc.port}</p><p className="text-2xs text-slate">{pc.purpose}</p></td>
                    <td className="td tabular whitespace-nowrap">{fmtLt(pc.eta)}</td>
                    <td className="td tabular whitespace-nowrap">{fmtLt(pc.etb)}{delayed && <span className="block text-2xs text-critical font-semibold">delayed</span>}</td>
                    <td className="td tabular whitespace-nowrap">{fmtLt(pc.etd)}</td>
                    <td className="td"><PortCallStatusBadge status={pc.status} /></td>
                    <td className="td">
                      {pc.suez ? (
                        <div className="space-y-1"><p className="tabular text-xs whitespace-nowrap">{fmtLt(pc.suez.convoy)} <span className="text-slate">{pc.suez.direction === 'Southbound' ? 'SB' : 'NB'}</span></p><TransitStatusBadge status={pc.suez.status} /></div>
                      ) : <span className="text-slate">—</span>}
                    </td>
                    <td className="td text-right tabular"><span className={tasks ? 'font-semibold text-graphite' : 'text-slate'}>{tasks}</span></td>
                    <td className="td text-right">
                      <p className="tabular font-semibold">{total !== undefined ? usd(total, false) : '—'}</p>
                      <div className="mt-1"><PDAStatusBadge status={pdaStatusOf(state, pc.id)} /></div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-2xs text-slate mt-3">All times are port local time (LT). PDA totals are illustrative USD from sample tariffs.</p>
    </>
  );
}
