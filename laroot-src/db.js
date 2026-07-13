import { createClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------------ */
/*  Cliente Supabase                                                   */
/*  Las credenciales viajan por variables de entorno (ver .env.example)*/
/* ------------------------------------------------------------------ */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn(
    "[laroot] Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. " +
      "Copiá .env.example a .env y completá los datos de tu proyecto."
  );
}

export const supabase = createClient(url || "http://localhost", key || "public-anon-key");

/* ------------------------------------------------------------------ */
/*  Normalizadores fila <-> objeto de la app                          */
/* ------------------------------------------------------------------ */
const rowToSession = (r) =>
  r
    ? {
        code: r.code,
        title: r.title,
        questions: r.questions || [],
        activeIndex: r.active_index ?? -1,
        status: r.status || "lobby",
        starts: r.starts || {},
      }
    : null;

const rowToParticipant = (r) =>
  r ? {
    pid: r.pid,
    name: r.name || "",
    avatar: r.avatar || "",
    color: r.color || "",
    answers: r.answers || {},
    answerTimes: r.answer_times || {},
  } : null;

const rowToQuiz = (r) =>
  r
    ? {
        id: r.id,
        ownerId: r.owner_id,
        ownerName: r.owner_name || "",
        title: r.title,
        questions: r.questions || [],
        updatedAt: r.updated_at,
      }
    : null;

/* ------------------------------------------------------------------ */
/*  Biblioteca de quizzes                                              */
/* ------------------------------------------------------------------ */
export async function listQuizzes(ownerId) {
  const { data, error } = await supabase
    .from("quizzes")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) { console.error("[laroot] listQuizzes", error); return []; }
  return (data || []).map(rowToQuiz);
}

export async function getQuiz(id) {
  const { data, error } = await supabase.from("quizzes").select("*").eq("id", id).maybeSingle();
  if (error) { console.error("[laroot] getQuiz", error); return null; }
  return rowToQuiz(data);
}

export async function saveQuiz(quiz) {
  const row = {
    id: quiz.id,
    owner_id: quiz.ownerId,
    owner_name: quiz.ownerName || "",
    title: quiz.title,
    questions: quiz.questions,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("quizzes").upsert(row).select("*").maybeSingle();
  if (error) { console.error("[laroot] saveQuiz", error); return null; }
  return rowToQuiz(data);
}

export async function deleteQuiz(id) {
  const { error } = await supabase.from("quizzes").delete().eq("id", id);
  if (error) console.error("[laroot] deleteQuiz", error);
}

/* ------------------------------------------------------------------ */
/*  Sesiones en vivo                                                   */
/* ------------------------------------------------------------------ */
export async function getSession(code) {
  const { data, error } = await supabase.from("sessions").select("*").eq("code", code).maybeSingle();
  if (error) { console.error("[laroot] getSession", error); return null; }
  return rowToSession(data);
}

export async function upsertSession(s) {
  const row = {
    code: s.code,
    title: s.title,
    questions: s.questions,
    active_index: s.activeIndex,
    status: s.status,
    starts: s.starts || {},
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("sessions").upsert(row, { onConflict: "code" });
  if (error) console.error("[laroot] upsertSession", error);
}

/* ------------------------------------------------------------------ */
/*  Participantes                                                      */
/* ------------------------------------------------------------------ */
export async function listParticipants(code) {
  const { data, error } = await supabase.from("participants").select("*").eq("session_code", code);
  if (error) { console.error("[laroot] listParticipants", error); return []; }
  return (data || []).map(rowToParticipant);
}

export async function upsertParticipant(code, p) {
  const row = {
    session_code: code,
    pid: p.pid,
    name: p.name || "",
    avatar: p.avatar || "",
    color: p.color || "",
    answers: p.answers || {},
    answer_times: p.answerTimes || {},
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("participants").upsert(row, { onConflict: "session_code,pid" });
  if (error) console.error("[laroot] upsertParticipant", error);
}

export async function deleteParticipants(code) {
  const { error } = await supabase.from("participants").delete().eq("session_code", code);
  if (error) console.error("[laroot] deleteParticipants", error);
}

/* ------------------------------------------------------------------ */
/*  Realtime — websockets, sin polling                                */
/* ------------------------------------------------------------------ */
export function subscribeSession(code, onChange) {
  const ch = supabase
    .channel(`session:${code}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sessions", filter: `code=eq.${code}` },
      (payload) => onChange(rowToSession(payload.new))
    )
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export function subscribeParticipants(code, onChange) {
  const ch = supabase
    .channel(`participants:${code}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "participants", filter: `session_code=eq.${code}` },
      () => onChange()
    )
    .subscribe();
  return () => supabase.removeChannel(ch);
}
