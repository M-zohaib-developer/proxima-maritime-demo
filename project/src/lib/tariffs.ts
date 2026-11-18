// ─────────────────────────────────────────────────────────────────────────────
// ILLUSTRATIVE SAMPLE TARIFFS — NOT official Egyptian, UAE or Suez Canal
// Authority tariffs, and NOT Proxima's rates. Figures in USD, for demo only.
// ─────────────────────────────────────────────────────────────────────────────
import type { PortName, VesselType } from '@/types';

export interface Band { maxGt: number; value: number }

export interface PortTariff {
  port: PortName;
  ref: string;
  portDuesPerGtPer24h: number;      // charged per started 24 h in port (ETA → ETD)
  anchoragePerGtPerDay: number;     // charged on waiting time beyond free hours (ETA → ETB)
  anchorageFreeHours: number;
  pilotage: Band[];                 // per move, by GT band
  tugPerMove: number;               // per tug per move
  tugsByLoa: { maxLoa: number; tugs: number }[];
  berthPerMetrePerDay: number;      // per metre LOA per started day alongside
  launchPerTrip: number;
  extraLaunchTripsPer12hWait: number;
  agencyFee: Band[];                // sample Proxima-style agency schedule (contract rate)
  sundriesDefault: number;
}

const BANDS = (a: number, b: number, c: number): Band[] => [
  { maxGt: 20_000, value: a }, { maxGt: 40_000, value: b }, { maxGt: Infinity, value: c },
];
const TUGS = [{ maxLoa: 150, tugs: 1 }, { maxLoa: 220, tugs: 2 }, { maxLoa: Infinity, tugs: 3 }];

export const PORT_TARIFFS: Record<PortName, PortTariff> = {
  Alexandria: {
    port: 'Alexandria', ref: 'Sample tariff ALX-S26',
    portDuesPerGtPer24h: 0.11, anchoragePerGtPerDay: 0.03, anchorageFreeHours: 6,
    pilotage: BANDS(1_850, 2_950, 3_900), tugPerMove: 2_250, tugsByLoa: TUGS,
    berthPerMetrePerDay: 6.5, launchPerTrip: 180, extraLaunchTripsPer12hWait: 1,
    agencyFee: BANDS(3_200, 4_500, 5_600), sundriesDefault: 750,
  },
  Damietta: {
    port: 'Damietta', ref: 'Sample tariff DAM-S26',
    portDuesPerGtPer24h: 0.10, anchoragePerGtPerDay: 0.028, anchorageFreeHours: 6,
    pilotage: BANDS(1_700, 2_700, 3_600), tugPerMove: 2_100, tugsByLoa: TUGS,
    berthPerMetrePerDay: 6.1, launchPerTrip: 160, extraLaunchTripsPer12hWait: 1,
    agencyFee: BANDS(3_000, 4_200, 5_300), sundriesDefault: 700,
  },
  'Port Said': {
    port: 'Port Said', ref: 'Sample tariff PSD-S26',
    portDuesPerGtPer24h: 0.105, anchoragePerGtPerDay: 0.03, anchorageFreeHours: 6,
    pilotage: BANDS(1_800, 2_850, 3_750), tugPerMove: 2_200, tugsByLoa: TUGS,
    berthPerMetrePerDay: 6.3, launchPerTrip: 170, extraLaunchTripsPer12hWait: 1,
    agencyFee: BANDS(3_100, 4_400, 5_500), sundriesDefault: 720,
  },
  Dubai: {
    port: 'Dubai', ref: 'Sample tariff DXB-S26',
    portDuesPerGtPer24h: 0.09, anchoragePerGtPerDay: 0.025, anchorageFreeHours: 6,
    pilotage: BANDS(1_600, 2_500, 3_400), tugPerMove: 1_950, tugsByLoa: TUGS,
    berthPerMetrePerDay: 5.8, launchPerTrip: 150, extraLaunchTripsPer12hWait: 1,
    agencyFee: BANDS(2_900, 4_100, 5_200), sundriesDefault: 680,
  },
};

export function band(bands: Band[], gt: number): Band {
  return bands.find(b => gt <= b.maxGt) ?? bands[bands.length - 1];
}

export function tugsForLoa(t: PortTariff, loa: number): number {
  return (t.tugsByLoa.find(x => loa <= x.maxLoa) ?? t.tugsByLoa[t.tugsByLoa.length - 1]).tugs;
}

// ── Illustrative Suez Canal dues table (NOT the SCA tariff) ──────────────────
export const SUEZ_TABLE = {
  ref: 'Illustrative Suez dues table S-26 (sample, not SCA)',
  ratePerScnt: {
    'Bulk Carrier':  { Laden: 5.10, Ballast: 4.20 },
    'Tanker':        { Laden: 6.00, Ballast: 4.90 },
    'Container':     { Laden: 5.60, Ballast: 5.60 },
    'General Cargo': { Laden: 4.80, Ballast: 3.90 },
  } as Record<VesselType, { Laden: number; Ballast: number }>,
  /** illustrative charge when a convoy booking is amended after a missed cut-off */
  amendmentCharge: 1_500,
  /** sample convoy pattern: one daily convoy each direction */
  convoyHourLt: 3,
  cutoffHoursBeforeConvoy: 5,
};
