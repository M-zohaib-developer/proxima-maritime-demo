import { useState } from 'react';
import { CheckCircle2, FileCheck2, HelpCircle, Inbox, Table2, BarChart3 } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { useToast } from '@/components/Toast';
import { Card, EmptyState, Note, PageHeader, SampleTag } from '@/components/ui';
import { DiffStatusBadge } from '@/components/StatusBadge';
import { DivergingBars } from '@/components/Charts';
import { compareHistorical, comparePdaFda, sampleFinalInvoices, type Comparison } from '@/services/fdaService';
import { fmtLtDate, fmtTimestamp, nowIso } from '@/lib/time';
import { fmtPct, usd, usdDelta } from '@/lib/format';
import { pdaTotalOf, vesselOf } from '@/lib/selectors';

export default function PdaVsFda() {
  const { state, route, navigate, dispatch } = useDemoStore();
  const { showToast } = useToast();
  const [view, setView] = useState<'table' | 'chart'>('table');

  const live = state.portCalls.filter(p => state.pdas[p.id] && state.pdas[p.id].status !== 'Draft' && p.createdFrom === 'email');
  const options = [
    ...live.map(p => ({ id: p.id, label: `${p.vesselName} — ${p.port} ${p.ref}`, sub: state.fdas[p.id] ? 'Final invoices loaded' : 'Awaiting final invoices', live: true })),
    ...state.historical.map(h => ({ id: h.id, label: `${h.vesselName} — ${h.port} ${h.ref}`, sub: `Completed ${fmtLtDate(h.completedAt)}`, live: false })),
  ];
  const selId = options.some(o => o.id === route.id) ? route.id! : options[0]?.id;
  const opt = options.find(o => o.id === selId);

  let cmp: Comparison | null = null;
  let pcId: string | undefined;
  if (opt?.live) {
    pcId = opt.id;
    const fda = state.fdas[opt.id];
    if (fda) cmp = comparePdaFda(state.pdas[opt.id], fda);
  } else if (opt) {
    cmp = compareHistorical(state.historical.find(h => h.id === opt.id)!);
  }
  const pc = pcId ? state.portCalls.find(p => p.id === pcId) : undefined;
  const fda = pcId ? state.fdas[pcId] : undefined;

  function loadFda() {
    if (!pc) return;
    const v = vesselOf(state, pc);
    if (!v) return;
    dispatch({ type: 'LOAD_FDA', fda: { portCallId: pc.id, receivedAt: nowIso(), lines: sampleFinalInvoices(pc, v, state.historical) }, at: nowIso() });
    showToast('info', 'Final invoices loaded', 'Sample supplier and port invoices matched to PDA lines.');
  }

  return (
    <>
      <PageHeader eyebrow="Reconciliation" title="PDA vs FDA"
        subtitle="Final disbursement account compared with the approved pro forma, line by line. Reasons come from invoice notes; anything without one is flagged, not guessed."
        actions={<SampleTag label="Illustrative USD" />} />

      <div className="card px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
        <label className="text-xs text-slate" htmlFor="cmp">Port call</label>
        <select id="cmp" className="input w-auto min-w-[18rem]" value={selId} onChange={e => navigate('pda-vs-fda', e.target.value)}>
          {live.length > 0 && <optgroup label="This demo">{options.filter(o => o.live).map(o => <option key={o.id} value={o.id}>{o.label} · {o.sub}</option>)}</optgroup>}
          <optgroup label="Past calls">{options.filter(o => !o.live).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>
        </select>
        {live.length === 0 && <span className="text-xs text-slate">Approve the MV Nile Trader PDA to reconcile it here.</span>}
        <div className="ml-auto inline-flex rounded border border-line p-0.5 bg-cloud">
          {(['table', 'chart'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className={`btn-sm btn h-7 ${view === v ? 'bg-white shadow-card text-graphite' : 'text-slate'}`}>{v === 'table' ? <Table2 size={13} /> : <BarChart3 size={13} />}{v === 'table' ? 'Table' : 'Chart'}</button>
          ))}
        </div>
      </div>

      {opt?.live && !fda && (
        <div className="card">
          <EmptyState icon={<Inbox size={18} />} title={`Final invoices for ${pc?.vesselName} not loaded`}
            action={<button className="btn-teal" onClick={loadFda}><FileCheck2 size={15} />Load final invoices (sample)</button>}>
            After the call, port, towage, launch and supplier invoices come in. This loads the sample final invoices for the call and compares them with the approved PDA ({usd(pdaTotalOf(state, pcId!))}).
          </EmptyState>
        </div>
      )}

      {cmp && (
        <div className="space-y-4 sm:space-y-5 animate-fade-up" key={selId}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Summary label="PDA (approved)" value={usd(cmp.pdaTotal)} />
            <Summary label="FDA (final)" value={usd(cmp.fdaTotal)} />
            <Summary label="Difference" value={usdDelta(cmp.diff)} sub={fmtPct(cmp.pct)} tone={cmp.diff > 0 ? 'warning' : undefined} />
            <Summary label="Unexplained" value={usdDelta(cmp.unexplainedDiff)} sub={`${cmp.counts.unexplained} line${cmp.counts.unexplained === 1 ? '' : 's'} to query`} tone={cmp.counts.unexplained ? 'critical' : undefined} />
          </div>

          {view === 'table' ? (
            <Card>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm min-w-[920px]">
                  <thead><tr>
                    <th className="th">Line</th><th className="th text-right">PDA</th><th className="th text-right">FDA</th>
                    <th className="th text-right">Difference</th><th className="th text-right">%</th><th className="th">Status</th><th className="th">Reason</th>
                  </tr></thead>
                  <tbody>
                    {cmp.rows.map(r => (
                      <tr key={r.code} className={`border-b border-line last:border-0 ${r.status === 'unexplained' ? 'bg-critical-light/50' : ''}`}>
                        <td className="td font-medium">{r.description}</td>
                        <td className="td text-right tabular">{usd(r.pda)}</td>
                        <td className="td text-right tabular">{usd(r.fda)}</td>
                        <td className={`td text-right tabular font-semibold ${r.diff > 0 ? 'text-warning-dark' : r.diff < 0 ? 'text-harbor-700' : 'text-slate'}`}>{usdDelta(r.diff)}</td>
                        <td className="td text-right tabular text-slate">{r.status === 'match' ? '—' : r.pct === null ? 'new line' : fmtPct(r.pct)}</td>
                        <td className="td"><DiffStatusBadge status={r.status} /></td>
                        <td className="td text-xs max-w-[22rem]">
                          {r.status === 'explained' && <span className="text-graphite">{r.reason}</span>}
                          {r.status === 'unexplained' && <span className="text-critical-dark inline-flex items-start gap-1"><HelpCircle size={12} className="mt-0.5 shrink-0" />No reason on the invoice — query supplier before sending the FDA.</span>}
                          {r.pdaEditNote && <span className="block text-2xs text-harbor-700 mt-0.5">{r.pdaEditNote}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="bg-cloud/60 font-semibold">
                    <td className="td">Total</td><td className="td text-right tabular">{usd(cmp.pdaTotal)}</td><td className="td text-right tabular">{usd(cmp.fdaTotal)}</td>
                    <td className="td text-right tabular">{usdDelta(cmp.diff)}</td><td className="td text-right tabular">{fmtPct(cmp.pct)}</td><td className="td" colSpan={2} />
                  </tr></tfoot>
                </table>
              </div>
            </Card>
          ) : (
            <Card title="Difference by line (FDA − PDA)" subtitle="Hover a bar for details" bodyClass="p-5">
              <DivergingBars data={cmp.rows.map(r => ({
                key: r.code, label: r.description, value: r.diff, display: usdDelta(r.diff),
                tooltip: `${usd(r.pda)} → ${usd(r.fda)} · ${r.status === 'unexplained' ? 'unexplained' : r.status}`,
              }))} />
            </Card>
          )}

          <div className="grid md:grid-cols-3 gap-3 text-sm">
            <Note tone="info"><b>{cmp.counts.explained}</b> differences explained by invoice notes ({usdDelta(cmp.explainedDiff)}).</Note>
            <Note tone={cmp.counts.unexplained ? 'critical' : 'success'}><b>{cmp.counts.unexplained}</b> unexplained ({usdDelta(cmp.unexplainedDiff)}) — no reason is invented.</Note>
            <Note tone="success"><b>{cmp.counts.match}</b> lines match the PDA exactly.</Note>
          </div>

          {fda && pc && (
            <div className="card px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              {fda.reconciledAt
                ? <p className="text-sm flex items-center gap-2"><CheckCircle2 size={16} className="text-success" />Reconciliation reviewed by {fda.reconciledBy} · {fmtTimestamp(fda.reconciledAt)}. FDA is not sent to the owner from this demo.</p>
                : <><p className="text-sm text-slate">Review the differences, then record the reconciliation. Unexplained lines stay flagged for an invoice query.</p>
                  <button className="btn-primary shrink-0" onClick={() => { dispatch({ type: 'RECONCILE_FDA', portCallId: pc.id, at: nowIso() }); showToast('success', 'Reconciliation recorded', 'Logged in the activity log.'); }}><CheckCircle2 size={15} />Mark reconciliation reviewed</button></>}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Summary({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warning' | 'critical' }) {
  return (
    <div className="card px-4 py-3.5">
      <p className="eyebrow">{label}</p>
      <p className={`text-lg font-bold font-display tabular mt-1 ${tone === 'critical' ? 'text-critical-dark' : tone === 'warning' ? 'text-warning-dark' : ''}`}>{value}</p>
      {sub && <p className="text-2xs text-slate mt-0.5">{sub}</p>}
    </div>
  );
}
