// Port-local time helpers.
// Schedule times are naive "YYYY-MM-DDTHH:mm:ss" strings in port local time (LT).
// They are handled as UTC internally so arithmetic never shifts with the
// presenter's browser time zone or DST.

export function ltToMs(lt: string): number {
  let s = lt.endsWith('Z') ? lt.slice(0, -1) : lt;
  if (s.length === 16) s += ':00';
  return Date.parse(s + 'Z');
}

export function msToLt(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

export function isValidLt(lt: string | undefined | null): boolean {
  if (!lt) return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(lt) && !Number.isNaN(ltToMs(lt));
}

export function addHours(lt: string, hours: number): string {
  return msToLt(ltToMs(lt) + hours * 3_600_000);
}

export function hoursBetween(from: string, to: string): number {
  return (ltToMs(to) - ltToMs(from)) / 3_600_000;
}

const LT_FMT = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
});
const LT_FMT_YEAR = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
});
const LT_DATE = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "20 Nov 14:00" (port local time) */
export function fmtLt(lt: string | undefined, withYear = false): string {
  if (!lt || !isValidLt(lt)) return '—';
  return (withYear ? LT_FMT_YEAR : LT_FMT).format(new Date(ltToMs(lt))).replace(',', '');
}

export function fmtLtDate(lt: string | undefined): string {
  if (!lt || !isValidLt(lt)) return '—';
  return LT_DATE.format(new Date(ltToMs(lt)));
}

/** value for <input type="datetime-local"> */
export function toInputValue(lt: string): string {
  return lt.slice(0, 16);
}

export function fromInputValue(v: string): string {
  return v.length === 16 ? `${v}:00` : v;
}

/** "+18 h", "−2.5 h" */
export function fmtHoursDelta(h: number): string {
  const r = Math.round(h * 10) / 10;
  if (r === 0) return '0 h';
  return `${r > 0 ? '+' : '−'}${Math.abs(r)} h`;
}

/** Real audit timestamps (UTC ISO) shown in the viewer's locale. */
export function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}

export function nowIso(): string {
  return new Date().toISOString();
}
