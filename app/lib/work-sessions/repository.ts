import { createDataClient } from "@/app/lib/invoices/repository";
import type { WorkSession } from "@/app/lib/work-sessions/model";

type SessionRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  site_id: string | null;
  place_name: string;
  place_address: string | null;
  started_at: string;
  ended_at: string | null;
  paused_at: string | null;
  pause_seconds: number;
};

function toSession(row: SessionRow): WorkSession {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    siteId: row.site_id,
    placeName: row.place_name,
    placeAddress: row.place_address ?? "",
    startedAt: row.started_at,
    endedAt: row.ended_at,
    pausedAt: row.paused_at,
    pauseSeconds: row.pause_seconds ?? 0,
  };
}

const columns = "id, employee_id, employee_name, site_id, place_name, place_address, started_at, ended_at, paused_at, pause_seconds";

export async function loadOpenSessions(): Promise<{ ok: true; sessions: WorkSession[] } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { data, error } = await supabase.from("work_sessions").select(columns).is("ended_at", null).order("started_at", { ascending: true });
  if (error || !data) return { ok: false, message: "Darba maiņas neizdevās ielādēt." };
  return { ok: true, sessions: data.map((row) => toSession(row as SessionRow)) };
}

export async function loadSessionsBetween(fromIso: string, toIso: string): Promise<{ ok: true; sessions: WorkSession[] } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const rangeStart = localDay(fromIso);
  const rangeEnd = localDay(toIso) + 86_400_000;
  if (Number.isNaN(rangeStart) || Number.isNaN(rangeEnd)) return { ok: false, message: "Datumu intervāls nav derīgs." };
  const { data, error } = await supabase.from("work_sessions").select(columns).lt("started_at", new Date(rangeEnd).toISOString()).order("started_at", { ascending: true });
  if (error || !data) return { ok: false, message: "Darba laika atskaiti neizdevās ielādēt." };
  const sessions = data
    .map((row) => toSession(row as SessionRow))
    .filter((session) => {
      const end = session.endedAt ? Date.parse(session.endedAt) : Date.now();
      return end >= rangeStart;
    });
  return { ok: true, sessions };
}

function localDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return Number.NaN;
  return new Date(year, month - 1, day).getTime();
}

export async function startWorkSession(input: {
  employeeId: string;
  employeeName: string;
  siteId: string;
  placeName: string;
  placeAddress: string;
}): Promise<{ ok: true; session: WorkSession } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { data: open } = await supabase.from("work_sessions").select("id").eq("employee_id", input.employeeId).is("ended_at", null).maybeSingle();
  if (open) return { ok: false, message: "Šis darbinieks jau ir darbā." };
  const { data, error } = await supabase
    .from("work_sessions")
    .insert({
      employee_id: input.employeeId,
      employee_name: input.employeeName,
      site_id: input.siteId,
      place_name: input.placeName,
      place_address: input.placeAddress,
      started_at: new Date().toISOString(),
    })
    .select(columns)
    .single();
  if (error || !data) return { ok: false, message: "Darbu neizdevās sākt." };
  return { ok: true, session: toSession(data as SessionRow) };
}

export async function pauseWorkSession(id: string): Promise<{ ok: true; session: WorkSession } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { data, error } = await supabase
    .from("work_sessions")
    .update({ paused_at: new Date().toISOString() })
    .eq("id", id)
    .is("ended_at", null)
    .is("paused_at", null)
    .select(columns)
    .single();
  if (error || !data) return { ok: false, message: "Pauzi neizdevās ieslēgt." };
  return { ok: true, session: toSession(data as SessionRow) };
}

export async function resumeWorkSession(id: string): Promise<{ ok: true; session: WorkSession } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { data: current, error: readError } = await supabase.from("work_sessions").select(columns).eq("id", id).is("ended_at", null).not("paused_at", "is", null).maybeSingle();
  if (readError || !current) return { ok: false, message: "Pauzi neizdevās turpināt." };
  const row = current as SessionRow;
  const pausedAt = Date.parse(row.paused_at ?? "");
  const extra = Number.isNaN(pausedAt) ? 0 : Math.max(0, Math.floor((Date.now() - pausedAt) / 1000));
  const { data, error } = await supabase
    .from("work_sessions")
    .update({ paused_at: null, pause_seconds: row.pause_seconds + extra })
    .eq("id", id)
    .is("ended_at", null)
    .select(columns)
    .single();
  if (error || !data) return { ok: false, message: "Pauzi neizdevās turpināt." };
  return { ok: true, session: toSession(data as SessionRow) };
}

export async function endWorkSession(id: string): Promise<{ ok: true; session: WorkSession } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { data: current, error: readError } = await supabase.from("work_sessions").select(columns).eq("id", id).is("ended_at", null).maybeSingle();
  if (readError || !current) return { ok: false, message: "Darbu neizdevās beigt." };
  const row = current as SessionRow;
  const { data, error } = await supabase
    .from("work_sessions")
    .update({ ended_at: row.paused_at ?? new Date().toISOString(), paused_at: null })
    .eq("id", id)
    .is("ended_at", null)
    .select(columns)
    .single();
  if (error || !data) return { ok: false, message: "Darbu neizdevās beigt." };
  return { ok: true, session: toSession(data as SessionRow) };
}

export async function updateWorkSession(input: {
  id: string;
  siteId: string | null;
  placeName: string;
  placeAddress: string;
  startedAt: string;
  endedAt: string | null;
}): Promise<{ ok: true; session: WorkSession } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const started = Date.parse(input.startedAt);
  const ended = input.endedAt ? Date.parse(input.endedAt) : null;
  if (Number.isNaN(started) || (ended != null && (Number.isNaN(ended) || ended < started))) {
    return { ok: false, message: "Beigu laikam jābūt pēc sākuma." };
  }
  const { data: current, error: readError } = await supabase.from("work_sessions").select("employee_id").eq("id", input.id).maybeSingle();
  if (readError || !current) return { ok: false, message: "Ierakstu neizdevās saglabāt." };
  if (input.endedAt == null) {
    const { data: other } = await supabase.from("work_sessions").select("id").eq("employee_id", current.employee_id).is("ended_at", null).neq("id", input.id).maybeSingle();
    if (other) return { ok: false, message: "Šim darbiniekam jau ir nenobeigts darbs." };
  }
  const { data, error } = await supabase
    .from("work_sessions")
    .update({
      site_id: input.siteId,
      place_name: input.placeName,
      place_address: input.placeAddress,
      started_at: input.startedAt,
      ended_at: input.endedAt,
      ...(input.endedAt != null ? { paused_at: null, pause_seconds: 0 } : {}),
    })
    .eq("id", input.id)
    .select(columns)
    .single();
  if (error || !data) return { ok: false, message: "Ierakstu neizdevās saglabāt." };
  return { ok: true, session: toSession(data as SessionRow) };
}

export async function deleteWorkSession(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = createDataClient();
  if (!supabase) return { ok: false, message: "Datubāze nav pieslēgta." };
  const { error } = await supabase.from("work_sessions").delete().eq("id", id);
  if (error) return { ok: false, message: "Ierakstu neizdevās dzēst." };
  return { ok: true };
}
