// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE DATA — every vessel, company, person, IMO-style number, tariff and
// amount below is fictional and illustrative. IMO-style numbers deliberately
// fail the IMO check-digit test so they cannot belong to a real ship.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  ActivityEvent, ClientUpdate, Company, DemoEmail, DemoState, HistoricalCall, PDA,
  PortCall, Staff, Task, Vessel, Warning,
} from '@/types';
import { draftPdaLines, pdaTotal } from '@/services/pdaEngine';
import { usd } from '@/lib/format';
import { checkDocuments, documentWarning, requiredDocuments } from '@/services/documentRules';

export const STATE_VERSION = 5;
export const DEMO_VESSEL_ID = 'vsl-nile';
export const DEMO_OWNER_ID = 'own-thalassa';
export const SEED_TIME = '2026-11-18T06:00:00.000Z';

export const STAFF: Staff[] = [
  { id: 'st-mona',   name: 'Mona Saleh',   title: 'Senior Port Call Operator', desk: 'Operations', office: 'Alexandria', initials: 'MS' },
  { id: 'st-karim',  name: 'Karim Fawzy',  title: 'D/A Supervisor',            desk: 'D/A',        office: 'Alexandria', initials: 'KF' },
  { id: 'st-youssef',name: 'Youssef Adel', title: 'Senior Suez Canal Operator',desk: 'Suez',       office: 'Port Said',  initials: 'YA' },
  { id: 'st-nour',   name: 'Nour Hamdy',   title: 'Husbandry Coordinator',     desk: 'Husbandry',  office: 'Alexandria', initials: 'NH' },
  { id: 'st-hana',   name: 'Hana Mansour', title: 'Husbandry Officer',         desk: 'Husbandry',  office: 'Alexandria', initials: 'HM' },
  { id: 'st-tarek',  name: 'Tarek Nabil',  title: 'Operations Supervisor',     desk: 'Operations', office: 'Damietta',   initials: 'TN' },
  { id: 'st-layla',  name: 'Layla Haddad', title: 'Logistics Coordinator',     desk: 'Logistics',  office: 'Dubai',      initials: 'LH' },
];

export const COMPANIES: Company[] = [
  { id: DEMO_OWNER_ID,   kind: 'owner', name: 'Thalassa Bluewater Navigation S.A.', country: 'Greece',    city: 'Piraeus',   contact: 'Nikos Petrakis', email: 'ops@thalassa-bluewater.example', code: 'TBN' },
  { id: 'own-levantia',  kind: 'owner', name: 'Levantia Bulk Trading Ltd',          country: 'Cyprus',    city: 'Limassol',  contact: 'Elena Charalambous', email: 'chartering@levantia-bulk.example', code: 'LBT' },
  { id: 'own-corniche',  kind: 'owner', name: 'Corniche Tankers FZCO',              country: 'UAE',       city: 'Dubai',     contact: 'Faisal Rahimi', email: 'fleet@corniche-tankers.example', code: 'CTF' },
  { id: 'own-meridian',  kind: 'owner', name: 'Meridian Box Lines Pte',             country: 'Singapore', city: 'Singapore', contact: 'Grace Lim', email: 'ops@meridian-box.example', code: 'MBL' },
  { id: 'chr-goldensheaf', kind: 'charterer', name: 'Golden Sheaf Grain Trading SA', country: 'Switzerland', city: 'Geneva', contact: 'Luc Imbert', email: 'freight@goldensheaf.example', code: 'GSG' },
  { id: 'chr-nilebridge',  kind: 'charterer', name: 'Nilebridge Commodities DMCC',   country: 'UAE', city: 'Dubai', contact: 'Sara Qureshi', email: 'ops@nilebridge.example', code: 'NBC' },
];

export const VESSELS: Vessel[] = [
  { id: DEMO_VESSEL_ID, name: 'MV Nile Trader',      imo: '9526012', type: 'Bulk Carrier',  flag: 'Malta',     gt: 33_240, nrt: 19_870, dwt: 58_000, loa: 199.9, built: 2014, scnt: 31_500, ownerId: DEMO_OWNER_ID },
  { id: 'vsl-saffron',  name: 'MV Saffron Meridian', imo: '9815906', type: 'Bulk Carrier',  flag: 'Cyprus',    gt: 31_100, nrt: 18_420, dwt: 56_400, loa: 190.0, built: 2016, scnt: 29_800, ownerId: 'own-levantia' },
  { id: 'vsl-corniche', name: 'MV Corniche Dawn',    imo: '9830164', type: 'Tanker',        flag: 'Marshall Is.', gt: 28_400, nrt: 13_200, dwt: 47_900, loa: 183.0, built: 2018, scnt: 27_100, ownerId: 'own-corniche' },
  { id: 'vsl-lotus',    name: 'MV Lotus Horizon',    imo: '9613188', type: 'Container',     flag: 'Singapore', gt: 25_600, nrt: 12_100, dwt: 32_000, loa: 196.4, built: 2012, scnt: 26_300, ownerId: 'own-meridian' },
  { id: 'vsl-kestrel',  name: 'MV Delta Kestrel',    imo: '9609137', type: 'Bulk Carrier',  flag: 'Liberia',   gt: 29_870, nrt: 17_900, dwt: 52_000, loa: 189.8, built: 2013, scnt: 28_600, ownerId: DEMO_OWNER_ID },
  { id: 'vsl-qamar',    name: 'MV Qamar Voyager',    imo: '9909965', type: 'Tanker',        flag: 'Panama',    gt: 31_200, nrt: 14_700, dwt: 55_000, loa: 194.1, built: 2019, scnt: 29_900, ownerId: 'own-corniche' },
  { id: 'vsl-wren',     name: 'MV Pharos Wren',      imo: '9030829', type: 'General Cargo', flag: 'Antigua & Barbuda', gt: 9_850, nrt: 5_300, dwt: 12_800, loa: 139.5, built: 2010, scnt: 9_200, ownerId: 'own-meridian' },
];

function seedCall(p: Omit<PortCall, 'baseline' | 'createdFrom' | 'createdAt'>): PortCall {
  return { ...p, baseline: { eta: p.eta, etb: p.etb, etd: p.etd }, createdFrom: 'seed', createdAt: '2026-11-14T08:00:00.000Z' };
}

export const PORT_CALLS: PortCall[] = [
  seedCall({
    id: 'pc-101', ref: 'PSD-26-0388', vesselId: 'vsl-saffron', vesselName: 'MV Saffron Meridian', vesselType: 'Bulk Carrier',
    ownerId: 'own-levantia', ownerName: 'Levantia Bulk Trading Ltd', chartererId: 'chr-nilebridge',
    port: 'Port Said', purpose: 'Loading', cargo: 'Phosphate rock', cargoQty: '30,000 MT', services: ['full-agency'],
    eta: '2026-11-17T08:00:00', etb: '2026-11-17T14:00:00', etd: '2026-11-19T20:00:00',
    status: 'At Berth', nextStep: 'Loading 62% complete — draft survey 19 Nov 14:00 LT.',
  }),
  seedCall({
    id: 'pc-102', ref: 'DXB-26-0141', vesselId: 'vsl-corniche', vesselName: 'MV Corniche Dawn', vesselType: 'Tanker',
    ownerId: 'own-corniche', ownerName: 'Corniche Tankers FZCO',
    port: 'Dubai', purpose: 'Bunkering & crew change', services: ['full-agency', 'bunkering', 'crew-change'],
    eta: '2026-11-17T10:00:00', etb: '2026-11-17T16:00:00', etd: '2026-11-19T08:00:00',
    status: 'At Berth', nextStep: 'Bunker delivery 18 Nov 22:00 LT, then sail.',
  }),
  seedCall({
    id: 'pc-103', ref: 'DAM-26-0217', vesselId: 'vsl-lotus', vesselName: 'MV Lotus Horizon', vesselType: 'Container',
    ownerId: 'own-meridian', ownerName: 'Meridian Box Lines Pte',
    port: 'Damietta', purpose: 'Discharge / load', cargo: 'Containers', cargoQty: '1,240 TEU', services: ['full-agency'],
    eta: '2026-11-19T06:00:00', etb: '2026-11-19T12:00:00', etd: '2026-11-20T16:00:00',
    status: 'Pre-arrival', nextStep: 'Pre-arrival documents due 18 Nov 18:00 LT.',
  }),
  seedCall({
    id: 'pc-104', ref: 'PSD-26-0391', vesselId: 'vsl-kestrel', vesselName: 'MV Delta Kestrel', vesselType: 'Bulk Carrier',
    ownerId: DEMO_OWNER_ID, ownerName: 'Thalassa Bluewater Navigation S.A.',
    port: 'Port Said', purpose: 'Suez transit (northbound)', cargo: 'Soybeans', cargoQty: '48,000 MT', services: ['suez-transit'],
    eta: '2026-11-17T22:00:00', etb: '2026-11-18T03:00:00', etd: '2026-11-18T18:00:00',
    status: 'In Transit', nextStep: 'Northbound convoy under way — clear of canal approx. 18:00 LT.',
    suez: { direction: 'Northbound', condition: 'Laden', convoy: '2026-11-18T03:00:00', cutoff: '2026-11-17T22:00:00', waitingArea: 'Suez', passageHours: 0, status: 'Confirmed' },
  }),
  seedCall({
    id: 'pc-105', ref: 'DXB-26-0144', vesselId: 'vsl-qamar', vesselName: 'MV Qamar Voyager', vesselType: 'Tanker',
    ownerId: 'own-corniche', ownerName: 'Corniche Tankers FZCO',
    port: 'Dubai', purpose: 'Loading', cargo: 'Gasoil', cargoQty: '40,000 MT', services: ['full-agency'],
    eta: '2026-11-21T14:00:00', etb: '2026-11-22T08:00:00', etd: '2026-11-24T18:00:00',
    status: 'Pre-arrival', nextStep: 'Awaiting terminal berth confirmation.',
  }),
  seedCall({
    id: 'pc-106', ref: 'ALX-26-0412', vesselId: 'vsl-wren', vesselName: 'MV Pharos Wren', vesselType: 'General Cargo',
    ownerId: 'own-meridian', ownerName: 'Meridian Box Lines Pte',
    port: 'Alexandria', purpose: 'Discharge', cargo: 'Steel coils', cargoQty: '12,500 MT', services: ['full-agency', 'husbandry'],
    eta: '2026-11-18T02:00:00', etb: '2026-11-18T20:00:00', etd: '2026-11-20T10:00:00',
    status: 'At Anchorage', nextStep: 'Berthing 18 Nov 20:00 LT, pilot ordered.',
  }),
];

// ── Past calls with PDA and FDA (used for PDA drafting and comparison) ───────
export const HISTORICAL: HistoricalCall[] = [
  {
    id: 'hist-alx-0917', ref: 'ALX-26-0317', vesselName: 'MV Delta Kestrel', vesselType: 'Bulk Carrier', port: 'Alexandria',
    completedAt: '2026-09-17T16:00:00', gt: 29_870,
    metrics: { tugsIn: 2, tugsOut: 2, launchTrips: 3, sundries: 820 },
    lines: [
      { code: 'port-dues',   description: 'Port dues',          pda: 9_857.10, fda: 9_857.10 },
      { code: 'anchorage',   description: 'Anchorage dues',     pda: 0,        fda: 896.16, invoiceNote: 'Waited 30 h at anchorage for berth (24 h chargeable after 6 h free time).' },
      { code: 'pilotage-in', description: 'Pilotage — inward',  pda: 2_950,    fda: 2_950 },
      { code: 'pilotage-out',description: 'Pilotage — outward', pda: 2_950,    fda: 2_950 },
      { code: 'towage-in',   description: 'Towage — inward',    pda: 4_500,    fda: 4_500 },
      { code: 'towage-out',  description: 'Towage — outward',   pda: 4_500,    fda: 4_500 },
      { code: 'berth',       description: 'Berth charges',      pda: 3_701.10, fda: 4_934.80, invoiceNote: 'Discharge ran one day over plan (grab breakdown on shore crane 3).' },
      { code: 'agency',      description: 'Agency fee',         pda: 4_500,    fda: 4_500 },
      { code: 'launch',      description: 'Launch hire',        pda: 540,      fda: 540 },
      { code: 'sundries',    description: 'Sundries & communications', pda: 800, fda: 820 },
    ],
  },
  {
    id: 'hist-alx-1021', ref: 'ALX-26-0366', vesselName: 'MV Saffron Meridian', vesselType: 'Bulk Carrier', port: 'Alexandria',
    completedAt: '2026-10-21T09:00:00', gt: 31_100,
    metrics: { tugsIn: 2, tugsOut: 3, launchTrips: 5, sundries: 1_140 },
    lines: [
      { code: 'port-dues',   description: 'Port dues',          pda: 10_263, fda: 10_263 },
      { code: 'pilotage-in', description: 'Pilotage — inward',  pda: 2_950,  fda: 2_950 },
      { code: 'pilotage-out',description: 'Pilotage — outward', pda: 2_950,  fda: 2_950 },
      { code: 'towage-in',   description: 'Towage — inward',    pda: 4_500,  fda: 4_500 },
      { code: 'towage-out',  description: 'Towage — outward',   pda: 4_500,  fda: 6_750, invoiceNote: 'Third tug ordered by harbour master — wind above 25 kn on departure.' },
      { code: 'berth',       description: 'Berth charges',      pda: 3_705,  fda: 3_705 },
      { code: 'agency',      description: 'Agency fee',         pda: 4_500,  fda: 4_500 },
      { code: 'launch',      description: 'Launch hire',        pda: 720,    fda: 900,   invoiceNote: 'One extra trip for P&I surveyor attendance.' },
      { code: 'sundries',    description: 'Sundries & communications', pda: 850, fda: 1_140 },
    ],
  },
  {
    id: 'hist-dam-0814', ref: 'DAM-26-0164', vesselName: 'MV Lotus Horizon', vesselType: 'Container', port: 'Damietta',
    completedAt: '2026-08-14T12:00:00', gt: 25_600,
    metrics: { tugsIn: 2, tugsOut: 2, launchTrips: 2, sundries: 655 },
    lines: [
      { code: 'port-dues',   description: 'Port dues',          pda: 5_120,    fda: 5_120 },
      { code: 'pilotage-in', description: 'Pilotage — inward',  pda: 2_700,    fda: 2_700 },
      { code: 'pilotage-out',description: 'Pilotage — outward', pda: 2_700,    fda: 2_700 },
      { code: 'towage-in',   description: 'Towage — inward',    pda: 4_200,    fda: 4_200 },
      { code: 'towage-out',  description: 'Towage — outward',   pda: 4_200,    fda: 4_200 },
      { code: 'berth',       description: 'Berth charges',      pda: 2_396.08, fda: 2_396.08 },
      { code: 'agency',      description: 'Agency fee',         pda: 4_200,    fda: 4_200 },
      { code: 'launch',      description: 'Launch hire',        pda: 480,      fda: 320, invoiceNote: 'Two trips not needed — crew used the shore gangway.' },
      { code: 'sundries',    description: 'Sundries & communications', pda: 700, fda: 655 },
    ],
  },
];

// ── The four predefined emails ───────────────────────────────────────────────
export const EMAILS: DemoEmail[] = [
  {
    id: 'em-nomination', type: 'nomination', status: 'New',
    from: 'Nikos Petrakis', fromEmail: 'ops@thalassa-bluewater.example', fromCompany: 'Thalassa Bluewater Navigation S.A.',
    to: 'agency.alexandria@proxima.example',
    subject: 'Nomination — MV Nile Trader — Alexandria discharge + Suez southbound',
    receivedAt: '2026-11-18T07:12:00.000Z',
    body: `Dear Proxima Alexandria team,

We are pleased to nominate you as full agents for the call below.

Vessel:          MV Nile Trader
IMO:             9526012
Type:            Bulk carrier
Flag:            Malta
DWT:             58,000 mt
GT / NRT:        33,240 / 19,870
LOA:             199.9 m

Port:            Alexandria, Egypt
Operation:       Discharge
Cargo:           45,000 mt wheat in bulk
Charterers:      Golden Sheaf Grain Trading SA
ETA:             20 Nov 2026 14:00 LT
ETB (prospect):  20 Nov 2026 18:00 LT
Time alongside:  approx. 60 hours

Onward:          Suez Canal southbound transit in ballast, convoy 24 Nov 2026

Services required:
- Full agency at Alexandria
- Suez Canal transit (southbound)
- Husbandry: crew change and fresh provisions (Master will send details)

Owners:          Thalassa Bluewater Navigation S.A.
Contact:         Nikos Petrakis

Please send your PDA for our approval.

Best regards,
Nikos Petrakis
Operations Manager
Thalassa Bluewater Navigation S.A. — Piraeus`,
  },
  {
    id: 'em-crew', type: 'crew-change', status: 'New',
    from: 'Capt. Dimitris Varelas', fromEmail: 'master.niletrader@thalassa-bluewater.example', fromCompany: 'MV Nile Trader',
    to: 'agency.alexandria@proxima.example',
    subject: 'MV Nile Trader — crew change at Alexandria (2 seafarers)',
    receivedAt: '2026-11-18T08:41:00.000Z',
    body: `Good morning agents,

Please arrange crew change for 2 seafarers during our Alexandria call.

OFF-SIGNERS
1. AB Stelios Karras — repatriation via HBE to ATH
2. Oiler Petros Alexiou — repatriation via HBE to ATH

ON-SIGNERS
1. AB Yannis Drakos — arriving HBE 20 Nov 2026 22:30 LT
2. Oiler Makis Lianos — arriving HBE 20 Nov 2026 22:30 LT

Passports, CDCs and STCW certificates follow by courier to your office.
Please confirm immigration formalities, shore passes and transport.

Best regards,
Capt. Dimitris Varelas
Master, MV Nile Trader`,
  },
  {
    id: 'em-provisions', type: 'provisions', status: 'New',
    from: 'Capt. Dimitris Varelas', fromEmail: 'master.niletrader@thalassa-bluewater.example', fromCompany: 'MV Nile Trader',
    to: 'agency.alexandria@proxima.example',
    subject: 'MV Nile Trader — fresh provisions on arrival Alexandria',
    receivedAt: '2026-11-18T09:05:00.000Z',
    body: `Dear agents,

Please arrange fresh provisions for 23 crew, 7 days, delivered alongside after berthing.

- Fresh vegetables: 140 kg
- Fresh fruit: 80 kg
- Meat and poultry: 110 kg
- Fish: 35 kg
- Dairy and eggs: 60 kg
- Bread: daily delivery while alongside
- Drinking water 1.5 L: 180 bottles

Please send supplier quotation for Master's approval before delivery.

Regards,
Capt. Dimitris Varelas
Master, MV Nile Trader`,
  },
  {
    id: 'em-status', type: 'status-inquiry', status: 'New',
    from: 'Nikos Petrakis', fromEmail: 'ops@thalassa-bluewater.example', fromCompany: 'Thalassa Bluewater Navigation S.A.',
    to: 'agency.alexandria@proxima.example',
    subject: 'MV Nile Trader — status please (berth, Suez convoy, costs)',
    receivedAt: '2026-11-18T10:26:00.000Z',
    body: `Dear Proxima,

Could you update us on MV Nile Trader:

1. Confirmed berthing time at Alexandria
2. Suez southbound convoy — still on track for 24 Nov?
3. Latest cost estimate against the PDA

Our charterers have a time-sensitive commitment after the transit.

Thanks and regards,
Nikos Petrakis
Thalassa Bluewater Navigation S.A.`,
  },
];

export const TASKS: Task[] = [
  { id: 'tsk-101', portCallId: 'pc-101', vesselName: 'MV Saffron Meridian', category: 'documents', title: 'Draft survey and loading documents', description: 'Book draft surveyor and collect B/L draft and weight certificate from shippers.', assigneeId: 'st-tarek', dueAt: '2026-11-19T14:00:00', priority: 'Medium', status: 'In Progress', createdFrom: 'seed' },
  { id: 'tsk-102', portCallId: 'pc-102', vesselName: 'MV Corniche Dawn', category: 'crew-change', title: 'Crew change — Chief Engineer joining', description: 'On-signer arrives DXB 18 Nov 19:40. OK-to-board letter issued; arrange launch.', assigneeId: 'st-layla', dueAt: '2026-11-18T21:00:00', priority: 'High', status: 'In Progress', createdFrom: 'seed' },
  { id: 'tsk-103', portCallId: 'pc-102', vesselName: 'MV Corniche Dawn', category: 'other', title: 'Confirm bunker barge slot', description: 'Confirm 650 MT VLSFO barge with supplier for 22:00 LT.', assigneeId: 'st-layla', dueAt: '2026-11-18T18:00:00', priority: 'Medium', status: 'Done', createdFrom: 'seed', completedAt: '2026-11-18T05:40:00.000Z', completedBy: 'Layla Haddad' },
  { id: 'tsk-104', portCallId: 'pc-103', vesselName: 'MV Lotus Horizon', category: 'documents', title: 'Pre-arrival documents to port authority', description: 'Submit crew list, cargo manifest and health declaration.', assigneeId: 'st-tarek', dueAt: '2026-11-18T18:00:00', priority: 'High', status: 'Open', createdFrom: 'seed' },
  { id: 'tsk-105', portCallId: 'pc-106', vesselName: 'MV Pharos Wren', category: 'other', title: 'Order pilot and tug for berthing', description: 'Berthing 18 Nov 20:00 LT — order 1 tug, pilot boarding 19:00.', assigneeId: 'st-mona', dueAt: '2026-11-18T14:00:00', priority: 'Medium', status: 'Open', createdFrom: 'seed' },
  { id: 'tsk-106', portCallId: 'pc-105', vesselName: 'MV Qamar Voyager', category: 'documents', title: 'Terminal nomination and cargo documents', description: 'Send ETA notice to terminal and confirm loading quantity with shippers.', assigneeId: 'st-layla', dueAt: '2026-11-20T12:00:00', priority: 'Low', status: 'Open', createdFrom: 'seed' },
];

const ACTIVITY: ActivityEvent[] = [
  { id: 'act-s6', timestamp: '2026-11-18T07:12:00.000Z', userId: 'system', user: 'System', action: 'Email received', category: 'email', entityLabel: 'MV Nile Trader', details: 'Nomination from Thalassa Bluewater Navigation S.A. received in the Alexandria agency inbox.' },
  { id: 'act-s5', timestamp: '2026-11-18T05:40:00.000Z', userId: 'st-layla', user: 'Layla Haddad', action: 'Task completed', category: 'task', portCallId: 'pc-102', entityLabel: 'MV Corniche Dawn', details: 'Confirm bunker barge slot — marked done.' },
  { id: 'act-s4b', timestamp: '2026-11-18T03:12:00.000Z', userId: 'st-youssef', user: 'Youssef Adel', action: 'Client update sent (simulated)', category: 'client-update', portCallId: 'pc-104', entityLabel: 'MV Delta Kestrel', details: 'Recorded as sent to Nikos Petrakis (Thalassa Bluewater Navigation S.A.). No external email was sent. Now visible in the owner\'s portal.' },
  { id: 'act-s4a', timestamp: '2026-11-18T03:12:00.000Z', userId: 'st-youssef', user: 'Youssef Adel', action: 'Client update approved', category: 'client-update', portCallId: 'pc-104', entityLabel: 'MV Delta Kestrel', details: '"MV Delta Kestrel — northbound Suez transit under way" approved by Youssef Adel.' },
  { id: 'act-s4', timestamp: '2026-11-18T03:05:00.000Z', userId: 'st-youssef', user: 'Youssef Adel', action: 'Transit started', category: 'transit', portCallId: 'pc-104', entityLabel: 'MV Delta Kestrel', details: 'Joined northbound convoy 18 Nov 03:00 LT.' },
  { id: 'act-s3', timestamp: '2026-11-17T15:20:00.000Z', userId: 'st-karim', user: 'Karim Fawzy', action: 'PDA approved', category: 'pda', portCallId: 'pc-101', entityLabel: 'MV Saffron Meridian', details: 'PDA approved by D/A Supervisor.' },
  { id: 'act-s2', timestamp: '2026-11-17T14:00:00.000Z', userId: 'st-tarek', user: 'Tarek Nabil', action: 'Status changed', category: 'port-call', portCallId: 'pc-101', entityLabel: 'MV Saffron Meridian', details: 'Vessel all fast Port Said.', changes: [{ field: 'Status', from: 'At Anchorage', to: 'At Berth' }] },
  { id: 'act-s1', timestamp: '2026-11-14T08:00:00.000Z', userId: 'system', user: 'System', action: 'Sample data loaded', category: 'system', entityLabel: 'Demo', details: 'Fictional sample data set loaded (6 port calls, 7 vessels, 3 past calls).' },
];

// Pre-arrival documents per seed call (fictional). MV Lotus Horizon is the one
// still missing documents inside the 24 h window at the sample clock.
const SEED_DOCS: Record<string, { received: boolean | string[]; by: string; at: string }> = {
  'pc-101': { received: true, by: 'Tarek Nabil', at: '2026-11-16T09:00:00.000Z' },
  'pc-102': { received: true, by: 'Layla Haddad', at: '2026-11-16T07:30:00.000Z' },
  'pc-103': { received: ['Crew list', 'Ship security declaration (ISPS)'], by: 'Tarek Nabil', at: '2026-11-17T10:15:00.000Z' },
  'pc-104': { received: true, by: 'Youssef Adel', at: '2026-11-16T18:00:00.000Z' },
  'pc-105': { received: ['Crew list', 'Ship security declaration (ISPS)'], by: 'Layla Haddad', at: '2026-11-18T05:00:00.000Z' },
  'pc-106': { received: true, by: 'Mona Saleh', at: '2026-11-16T11:00:00.000Z' },
};

function seedPda(pcId: string, status: PDA['status']): PDA {
  const pc = PORT_CALLS.find(p => p.id === pcId)!;
  const vessel = VESSELS.find(v => v.id === pc.vesselId)!;
  const { lines, basedOn } = draftPdaLines(pc, vessel, HISTORICAL);
  return {
    id: `pda-${pcId}`, portCallId: pcId, status, lineItems: lines, basedOn,
    generatedAt: '2026-11-16T10:00:00.000Z', generatedBy: 'Karim Fawzy',
    ...(status !== 'Draft' ? { approvedAt: '2026-11-17T15:20:00.000Z', approvedBy: 'Karim Fawzy' } : {}),
    ...(status === 'Sent' ? { sentAt: '2026-11-17T15:45:00.000Z', sentBy: 'Karim Fawzy' } : {}),
  };
}

// One approved & sent owner update for Thalassa's in-transit vessel, so the
// owner portal has a "latest update" from reset (fictional).
function seedKestrelUpdate(approvedPda: number): ClientUpdate {
  const nextStep = 'Northbound convoy under way — clear of canal approx. 18:00 LT.';
  return {
    id: 'upd-seed-kestrel', portCallId: 'pc-104', ownerId: DEMO_OWNER_ID, vesselName: 'MV Delta Kestrel', status: 'Sent',
    subject: 'MV Delta Kestrel — northbound Suez transit under way',
    body: [
      'Dear Nikos Petrakis,', '',
      'MV Delta Kestrel joined the northbound convoy from the Suez waiting area at 03:00 LT today (our ref. PSD-26-0391).', '',
      'SCHEDULE (local time)',
      '- Convoy start: 18 Nov 2026 03:00 (as booked)',
      '- Expected clear of canal: 18 Nov 2026 18:00', '',
      'ESTIMATED COSTS (USD, estimate — final figures follow in the FDA)',
      `- Approved PDA: ${usd(approvedPda)}`, '',
      'NEXT STEP', nextStep, '',
      'Kind regards,', 'Youssef Adel', 'Senior Suez Canal Operator, Proxima Ship Service',
    ].join('\n'),
    createdAt: '2026-11-18T03:10:00.000Z', createdBy: 'Youssef Adel', edited: false,
    approvedBy: 'Youssef Adel', sentAt: '2026-11-18T03:12:00.000Z',
    snapshot: { eta: '2026-11-17T22:00:00', etb: '2026-11-18T03:00:00', etd: '2026-11-18T18:00:00', approvedPda, transitStatus: 'Convoy 18 Nov 03:00 LT confirmed', nextStep },
  };
}

export function buildInitialState(): DemoState {
  const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  const portCalls = clone(PORT_CALLS).map(pc => {
    const d = SEED_DOCS[pc.id];
    return d ? { ...pc, documents: requiredDocuments(pc.id, d.received, d.by, d.at) } : pc;
  });
  const docWarnings: Warning[] = [];
  const docEvents: ActivityEvent[] = [];
  portCalls.forEach(pc => {
    const c = checkDocuments(pc);
    if (!c?.triggered) return;
    const w = documentWarning(pc, c);
    docWarnings.push({ ...w, id: `wrn-docs-${pc.id}`, triggeredAt: SEED_TIME, status: 'Open' });
    docEvents.push({ id: `act-docs-${pc.id}`, timestamp: SEED_TIME, userId: 'system', user: 'System', action: 'Warning raised', category: 'warning', portCallId: pc.id, entityLabel: pc.vesselName, details: `${w.title}. Rule: ${w.rule}.` });
  });
  const pdas: DemoState['pdas'] = {
    'pc-101': seedPda('pc-101', 'Approved'),
    'pc-102': seedPda('pc-102', 'Sent'),
    'pc-103': seedPda('pc-103', 'Draft'),
    'pc-104': seedPda('pc-104', 'Approved'),
    'pc-106': seedPda('pc-106', 'Approved'),
  };
  return {
    version: STATE_VERSION,
    currentUserId: 'st-mona',
    staff: clone(STAFF),
    companies: clone(COMPANIES),
    vessels: clone(VESSELS),
    portCalls,
    emails: clone(EMAILS),
    tasks: clone(TASKS),
    pdas,
    fdas: {},
    historical: clone(HISTORICAL),
    warnings: docWarnings,
    clientUpdates: [seedKestrelUpdate(pdaTotal(pdas['pc-104']))],
    activity: [...clone(ACTIVITY).filter(a => a.timestamp > SEED_TIME), ...docEvents, ...clone(ACTIVITY).filter(a => a.timestamp <= SEED_TIME)],
  };
}
