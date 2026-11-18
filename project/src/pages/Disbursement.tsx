import { FileText } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { EmptyState, PageHeader, SampleTag } from '@/components/ui';
import { PDAStatusBadge } from '@/components/StatusBadge';
import PdaEditor from '@/components/PdaEditor';
import { nileTrader, pdaStatusOf, pdaTotalOf } from '@/lib/selectors';
import { usd } from '@/lib/format';

export default function Disbursement() {
  const { state, route, navigate } = useDemoStore();
  const calls = state.portCalls;
  const selected = calls.find(p => p.id === route.id) ?? nileTrader(state) ?? calls.find(p => pdaStatusOf(state, p.id) === 'Draft') ?? calls[0];
  const counts = { draft: 0, approved: 0, none: 0 };
  calls.forEach(p => { const s = pdaStatusOf(state, p.id); if (s === 'Draft') counts.draft++; else if (s === 'None') counts.none++; else counts.approved++; });

  return (
    <>
      <PageHeader eyebrow="D/A desk" title="Disbursement Accounts"
        subtitle="PDAs drafted line by line from illustrative tariffs and past calls. The D/A team reviews, edits and approves — nothing is sent automatically."
        actions={<SampleTag label="Illustrative USD" />} />
      <div className="grid lg:grid-cols-[19rem_1fr] gap-4 sm:gap-5 items-start">
        <div className="card overflow-hidden lg:sticky lg:top-0">
          <div className="px-4 py-3 border-b border-line flex gap-3 text-2xs text-slate">
            <span><b className="text-graphite">{counts.draft}</b> draft</span><span><b className="text-graphite">{counts.approved}</b> approved/sent</span><span><b className="text-graphite">{counts.none}</b> not drafted</span>
          </div>
          <ul>
            {calls.map(p => {
              const total = pdaTotalOf(state, p.id);
              const active = selected?.id === p.id;
              return (
                <li key={p.id}>
                  <button onClick={() => navigate('disbursement', p.id)} className={`relative w-full text-left px-4 py-3 border-b border-line transition-colors ${active ? 'bg-harbor-50' : 'hover:bg-cloud/70'}`}>
                    {active && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-harbor-600" />}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold truncate">{p.vesselName}</span>
                      <span className="text-sm tabular">{total !== undefined ? usd(total, false) : '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-2xs text-slate">{p.port} · {p.ref}</span>
                      <PDAStatusBadge status={pdaStatusOf(state, p.id)} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="min-w-0">
          {selected ? <PdaEditor key={selected.id} pc={selected} /> : <div className="card"><EmptyState icon={<FileText size={18} />} title="No port calls" /></div>}
        </div>
      </div>
    </>
  );
}
