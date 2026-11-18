import { useState } from 'react';
import { Database, HardDrive, Layers, RotateCcw, Sparkles, UserRound } from 'lucide-react';
import { useDemoStore } from '@/lib/demoStore';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/Modal';
import { Avatar, Card, InfoRow, Note, PageHeader, Tabs } from '@/components/ui';
import { PORT_TARIFFS } from '@/lib/tariffs';
import { ai } from '@/services/ai';
import { usd } from '@/lib/format';
import type { PortName } from '@/types';

export default function Settings() {
  const { state, user, dispatch, resetDemo, navigate } = useDemoStore();
  const { showToast } = useToast();
  const [confirm, setConfirm] = useState(false);
  const [port, setPort] = useState<PortName>('Alexandria');
  const t = PORT_TARIFFS[port];
  const bandLabel = (i: number, arr: { maxGt: number }[]) => (i === 0 ? `≤ ${arr[0].maxGt.toLocaleString()} GT` : arr[i].maxGt === Infinity ? `> ${arr[i - 1].maxGt.toLocaleString()} GT` : `${arr[i - 1].maxGt.toLocaleString()}–${arr[i].maxGt.toLocaleString()} GT`);

  return (
    <>
      <PageHeader eyebrow="Configuration" title="Settings" subtitle="Demo users, data, tariffs and how the platform works." />
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
        <Card title={<span className="flex items-center gap-2"><UserRound size={15} />Working as</span>} subtitle="Demo users — no sign-in. Role controls who can approve PDAs.">
          <ul className="divide-y divide-line">
            {state.staff.map(s => (
              <li key={s.id} className="px-5 py-2.5 flex items-center gap-3">
                <Avatar initials={s.initials} tone={s.desk === 'D/A' ? 'teal' : 'ocean'} />
                <span className="flex-1 min-w-0"><span className="block text-sm font-medium">{s.name}</span><span className="block text-2xs text-slate">{s.title} · {s.desk} desk · {s.office}</span></span>
                {s.id === user.id ? <span className="badge bg-teal-100 text-teal-700">Current</span>
                  : <button className="btn-secondary btn-sm" onClick={() => { dispatch({ type: 'SET_USER', userId: s.id }); showToast('info', `Now working as ${s.name}`); }}>Switch</button>}
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4 sm:space-y-5">
          <Card title={<span className="flex items-center gap-2"><RotateCcw size={15} />Demo reset</span>} bodyClass="p-5 space-y-3">
            <p className="text-sm text-slate">Restores every sample record and scenario state so the 10-minute demo can be replayed from the start. Takes under a second.</p>
            <button className="btn-danger" onClick={() => setConfirm(true)}><RotateCcw size={15} />Reset demo data</button>
          </Card>
          <Card title={<span className="flex items-center gap-2"><HardDrive size={15} />Data & storage</span>} bodyClass="px-5 py-2">
            <dl>
              <InfoRow label="Hosting">Static site — no server, no database</InfoRow>
              <InfoRow label="Where demo state lives">This browser (localStorage)</InfoRow>
              <InfoRow label="Records">{state.portCalls.length} port calls · {state.tasks.length} tasks · {state.activity.length} log events</InfoRow>
              <InfoRow label="Sample data">Fictional vessels, owners, IMO-style numbers and illustrative USD tariffs</InfoRow>
            </dl>
          </Card>
          <Card title={<span className="flex items-center gap-2"><Sparkles size={15} />AI mode</span>} bodyClass="p-5 space-y-2">
            <p className="text-sm"><b>{ai.label}</b></p>
            <p className="text-sm text-slate">No AI model or API key is used. Email extraction uses pattern matching on the predefined emails; PDAs and warnings use tariff arithmetic and fixed rules; client updates fill a template from current call data. A model-backed service can implement the same <code className="text-xs bg-cloud px-1 rounded">AIService</code> interface later.</p>
          </Card>
        </div>

        <Card className="lg:col-span-2" title={<span className="flex items-center gap-2"><Database size={15} />Illustrative port tariffs</span>} subtitle="Sample USD rates used by the PDA engine and early-warning rules — not official Egyptian or UAE tariffs, not Proxima rates.">
          <div className="px-5"><Tabs active={port} onChange={k => setPort(k as PortName)} tabs={(Object.keys(PORT_TARIFFS) as PortName[]).map(p => ({ key: p, label: p }))} /></div>
          <div className="grid md:grid-cols-2 gap-x-8 px-5 py-3">
            <dl>
              <InfoRow label="Reference">{t.ref}</InfoRow>
              <InfoRow label="Port dues">USD {t.portDuesPerGtPer24h} / GT per started 24 h</InfoRow>
              <InfoRow label="Anchorage dues">USD {t.anchoragePerGtPerDay} / GT / day after {t.anchorageFreeHours} h free</InfoRow>
              <InfoRow label="Towage">{usd(t.tugPerMove)} per tug per move · tugs by LOA</InfoRow>
              <InfoRow label="Berth">USD {t.berthPerMetrePerDay} / m LOA / day</InfoRow>
              <InfoRow label="Launch hire">{usd(t.launchPerTrip)} per trip</InfoRow>
            </dl>
            <dl>
              {t.pilotage.map((b, i, arr) => <InfoRow key={`p${i}`} label={`Pilotage ${bandLabel(i, arr)}`}>{usd(b.value)} / move</InfoRow>)}
              {t.agencyFee.map((b, i, arr) => <InfoRow key={`a${i}`} label={`Agency fee ${bandLabel(i, arr)}`}>{usd(b.value)}</InfoRow>)}
            </dl>
          </div>
        </Card>

        <Card className="lg:col-span-2" title={<span className="flex items-center gap-2"><Layers size={15} />How it works</span>} subtitle="One-page architecture sketch for questions in the meeting" bodyClass="p-5">
          <div className="grid md:grid-cols-4 gap-3 text-sm">
            {[
              ['Inputs', 'Email inbox (nominations, crew change, provisions, owner questions) · schedule changes'],
              ['Services', 'AIService (simulated today) · PDA engine · early-warning rules · FDA reconciliation'],
              ['Controls', 'Operator review of every extraction · D/A-only PDA approval · approve-before-send for owner updates · audit log'],
              ['Outputs', 'Port call board · tasks · warnings · PDA/FDA · read-only owner portal scoped to one owner'],
            ].map(([h, b], i) => (
              <div key={h} className="relative rounded-lg border border-line bg-cloud/50 p-3.5">
                <p className="eyebrow mb-1">{i + 1}. {h}</p><p className="text-graphite">{b}</p>
              </div>
            ))}
          </div>
          <div className="mt-4"><Note tone="info">Possible next steps (not in this demo): live AIS, connections to the agency/accounting system and CRM, WhatsApp intake, real canal booking, automatic sending of D/As.</Note></div>
        </Card>
      </div>

      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Reset the demo?" confirmLabel="Reset demo" tone="danger"
        onConfirm={() => { resetDemo(); navigate('overview'); showToast('success', 'Demo reset', 'Original sample data and scenario restored.'); }}>
        <p>All changes made during the demo are cleared and the original sample data is restored.</p>
      </ConfirmDialog>
    </>
  );
}
