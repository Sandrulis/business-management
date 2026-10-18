export type WorkSession = {
  id: string;
  employeeId: string;
  employeeName: string;
  siteId: string | null;
  placeName: string;
  placeAddress: string;
  startedAt: string;
  endedAt: string | null;
  pausedAt: string | null;
  pauseSeconds: number;
};

export function formatClock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatStamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${formatClock(iso)}`;
}

export function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const pad = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(rest)}`;
}

export function elapsedSeconds(startedAt: string, now: number, endedAt: string | null = null) {
  const start = Date.parse(startedAt);
  const end = endedAt ? Date.parse(endedAt) : now;
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function workedSeconds(session: WorkSession, now: number) {
  const start = Date.parse(session.startedAt);
  const end = session.pausedAt ? Date.parse(session.pausedAt) : session.endedAt ? Date.parse(session.endedAt) : now;
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000) - session.pauseSeconds);
}

export function overlapSeconds(session: WorkSession, fromIso: string, toIso: string, now: number) {
  const start = Date.parse(session.startedAt);
  const end = session.endedAt ? Date.parse(session.endedAt) : now;
  const rangeStart = dayStart(fromIso);
  const rangeEnd = dayStart(toIso) + 86_400_000;
  if (Number.isNaN(start) || Number.isNaN(end) || Number.isNaN(rangeStart)) return 0;
  const from = Math.max(start, rangeStart);
  const to = Math.min(end, rangeEnd);
  if (to <= from) return 0;
  const raw = (to - from) / 1000;
  const span = (end - start) / 1000;
  const stored = span > 0 ? session.pauseSeconds * (raw / span) : 0;
  let live = 0;
  if (session.pausedAt) {
    const pausedAt = Date.parse(session.pausedAt);
    const pauseFrom = Math.max(pausedAt, from);
    const pauseTo = Math.min(to, now);
    if (pauseTo > pauseFrom) live = (pauseTo - pauseFrom) / 1000;
  }
  return Math.max(0, Math.floor(raw - stored - live));
}

function dayStart(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return Number.NaN;
  return new Date(year, month - 1, day).getTime();
}
