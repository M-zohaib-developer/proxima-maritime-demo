import { useState } from 'react';
import { Anchor, Search } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { EmptyState, PageHeader } from '@/components/ui';
import { PortCallStatusBadge } from '@/components/StatusBadge';
import { num } from '@/lib/format';

export default function Vessels() {
  const { state, navigate } = useDemoStore();
  const [q, setQ] = useState('');
  const list = state.vessels.filter(v => `${v.name} ${v.imo} ${v.type} ${v.flag}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <PageHeader eyebrow="Registry" title="Vessels" subtitle="Fictional vessels with made-up IMO-style numbers (they deliberately fail the IMO check digit)." />
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-line">
          <div className="relative max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
            <input className="input pl-9" placeholder="Search name, IMO, type, flag…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search vessels" />
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm min-w-[920px]">
            <thead><tr>
              <th className="th">Vessel</th><th className="th">IMO-style no.</th><th className="th">Flag</th>
              <th className="th text-right">DWT</th><th className="th text-right">GT</th><th className="th text-right">LOA</th>
              <th className="th">Owner</th><th className="th">Current call</th>
            </tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={8}><EmptyState icon={<Anchor size={18} />} title="No vessels match" /></td></tr>}
              {list.map(v => {
                const owner = state.companies.find(c => c.id === v.ownerId);
                const calls = state.portCalls.filter(p => p.vesselId === v.id);
                const current = calls.find(p => p.status !== 'Completed') ?? calls[calls.length - 1];
                return (
                  <tr key={v.id} className="border-b border-line last:border-0 tr-hover">
                    <td className="td"><p className="font-semibold">{v.name}</p><p className="text-2xs text-slate">{v.type}{v.built ? ` · built ${v.built}` : ''}</p></td>
                    <td className="td font-mono text-xs">{v.imo}</td>
                    <td className="td">{v.flag}</td>
                    <td className="td text-right tabular">{num(v.dwt)}</td>
                    <td className="td text-right tabular">{num(v.gt)}</td>
                    <td className="td text-right tabular">{v.loa} m</td>
                    <td className="td">{owner?.name ?? '—'}</td>
                    <td className="td">
                      {current ? (
                        <button className="text-left group" onClick={() => navigate('port-call-detail', current.id)}>
                          <span className="text-harbor-600 group-hover:underline text-sm">{current.port} · {current.ref}</span>
                          <span className="block mt-1"><PortCallStatusBadge status={current.status} /></span>
                        </button>
                      ) : <span className="text-slate text-xs">No active call{v.id === 'vsl-nile' ? ' — nomination in inbox' : ''}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
