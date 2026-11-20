import type { Alert } from '../message-code/index';

function two(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Sent minute as YYYYMMDDTHHMM in UTC. */
function utcStamp(sentMinute: number): string {
  const d = new Date(sentMinute * 60000);
  const year = String(d.getUTCFullYear()).padStart(4, '0');
  return `${year}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}T${two(d.getUTCHours())}${two(d.getUTCMinutes())}`;
}

/** dead-air-<test|alert>-<event>-<YYYYMMDDTHHMM>Z-s<stationId>-n<counter>.wav */
export function wavFileName(alert: Alert): string {
  const kind = alert.test ? 'test' : 'alert';
  return `dead-air-${kind}-${alert.event}-${utcStamp(alert.sentMinute)}Z-s${alert.stationId}-n${alert.counter}.wav`;
}
