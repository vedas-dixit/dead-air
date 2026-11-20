// Time text from epoch milliseconds and an offset in minutes.
// No clock, no time zone database, no browser API.

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

interface Fields {
  date: string;
  hh: string;
  mm: string;
}

function fieldsAt(ms: number, offsetMinutes: number): Fields {
  const d = new Date(ms + offsetMinutes * 60000);
  return {
    date: `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    hh: pad(d.getUTCHours()),
    mm: pad(d.getUTCMinutes()),
  };
}

/** `YYYY-MM-DD HH:MM UTC` */
export function formatUtc(ms: number): string {
  const f = fieldsAt(ms, 0);
  return `${f.date} ${f.hh}:${f.mm} UTC`;
}

/** `YYYY-MM-DD HH:MM UTC+05:30`: the same fields shifted by the offset. */
export function formatLocal(ms: number, offsetMinutes: number): string {
  const f = fieldsAt(ms, offsetMinutes);
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const oh = pad(Math.floor(abs / 60));
  const om = pad(abs % 60);
  return `${f.date} ${f.hh}:${f.mm} UTC${sign}${oh}:${om}`;
}

/** `HH:MM` in the offset's local time. */
export function formatClock(ms: number, offsetMinutes: number): string {
  const f = fieldsAt(ms, offsetMinutes);
  return `${f.hh}:${f.mm}`;
}
