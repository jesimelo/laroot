import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Users, Plus, Trash2, ChevronLeft, ChevronRight, ArrowLeft,
  BarChart3, Cloud, Gauge, MessageSquare, Check, RotateCcw, Copy,
  Radio, Send, X, ArrowUp, ArrowDown, LogIn, Presentation,
  Trophy, Timer, CheckCircle2, Circle, Pencil, Sparkles, Medal, Eye,
  Image as ImageIcon,
} from "lucide-react";
import {
  getSession, upsertSession,
  listParticipants, upsertParticipant, deleteParticipants,
  subscribeSession, subscribeParticipants,
  listQuizzes, getQuiz, saveQuiz, deleteQuiz,
} from "./lib/db.js";
import { getOwnerId, getOwnerName, setOwnerName } from "./lib/identity.js";
import { isQuiz, isCorrect, pointsFor, leaderboard, normalizeSelection } from "./lib/scoring.js";

/* ------------------------------------------------------------------ */
/*  laroot! — encuestas + quizzes en vivo · identidad Lara AI          */
/*  Backend: Supabase (realtime). Deploy: Netlify.                     */
/* ------------------------------------------------------------------ */
const APP_NAME = "laroot!";

/* ---------- tokens de marca Lara AI ---------- */
const C = {
  navy: "#16228C", blue: "#2F9BE0", blueDeep: "#1F6FD0", sky: "#7FC4F0",
  bg: "#EAF6FE", card: "#F4FAFE", white: "#FFFFFF",
  text: "#111827", textSoft: "#374151", muted: "#8A93A6", border: "#D6E9F8",
  good: "#1F9D6B", goodBg: "#E6F6EF", bad: "#C0392B", gold: "#E3A008",
};
const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const CHART = [C.navy, C.blue, C.blueDeep, C.sky, "#5B6BD6", "#0E7FC0", "#9AA7E8", "#4FB0EA"];

const TYPE_META = {
  mc:        { label: "Opción múltiple",  icon: BarChart3,     hint: "Cada persona elige una o varias opciones." },
  wordcloud: { label: "Nube de palabras", icon: Cloud,         hint: "Mandan palabras que aparecen según su frecuencia." },
  scale:     { label: "Escala",           icon: Gauge,         hint: "Puntúan dentro de un rango." },
  open:      { label: "Texto abierto",    icon: MessageSquare, hint: "Escriben una respuesta libre." },
};
const TIME_OPTIONS = [0, 10, 20, 30, 60];

/* ---------- avatares (personajes divertidos, sin marcas registradas) ---------- */
const AVATARS = [
  "🦊", "🐼", "🦁", "🐸", "🐙", "🦄", "🐵", "🐯",
  "🐨", "🦖", "🐧", "🐷", "🐮", "🐳", "🦉", "🐢",
  "🦋", "🐝", "🦕", "🐬", "🦩", "🦝", "🦭", "🐨",
  "🤖", "👽", "🦸", "🧙", "🐲", "🦈", "🌵", "🍄",
];
const AVATAR_COLORS = [
  "#2F9BE0", "#16228C", "#1F6FD0", "#7FC4F0",
  "#5B6BD6", "#0E7FC0", "#E3A008", "#1F9D6B",
  "#C0392B", "#8E44AD", "#E67E22", "#16A085",
];
const randOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------- fondos por pregunta (gradientes propios + imagen custom) ---------- */
const BACKGROUNDS = [
  { id: "ocean",   label: "Océano",    css: "linear-gradient(135deg, #16228C 0%, #2F9BE0 100%)" },
  { id: "sky",     label: "Cielo",     css: "linear-gradient(135deg, #2F9BE0 0%, #7FC4F0 100%)" },
  { id: "sunset",  label: "Atardecer", css: "linear-gradient(135deg, #7C3AED 0%, #EC4899 55%, #F59E0B 100%)" },
  { id: "mint",    label: "Menta",     css: "linear-gradient(135deg, #0E7FC0 0%, #1F9D6B 100%)" },
  { id: "grape",   label: "Uva",       css: "linear-gradient(135deg, #5B21B6 0%, #2F9BE0 100%)" },
  { id: "coral",   label: "Coral",     css: "linear-gradient(135deg, #C0392B 0%, #E67E22 100%)" },
  { id: "night",   label: "Noche",     css: "linear-gradient(135deg, #0F172A 0%, #1F6FD0 100%)" },
  { id: "candy",   label: "Chicle",    css: "linear-gradient(135deg, #EC4899 0%, #7FC4F0 100%)" },
];
const BG_PRESET = Object.fromEntries(BACKGROUNDS.map((b) => [b.id, b.css]));

// Devuelve la capa CSS de fondo de una pregunta (o null si no tiene).
function questionBg(q) {
  const b = q?.bg;
  if (!b) return null;
  if (b.type === "image" && b.url) return `url("${b.url}")`;
  if (b.type === "preset" && BG_PRESET[b.id]) return BG_PRESET[b.id];
  return null;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const genCode = () => String(Math.floor(100000 + Math.random() * 900000));
const fmtCode = (c) => (c ? `${c.slice(0, 3)} ${c.slice(3)}` : "");
const now = () => Date.now();

const seedQuestions = () => [
  { id: uid(), type: "mc", mode: "quiz", multi: false, timeLimit: 20,
    bg: { type: "preset", id: "ocean" },
    prompt: "¿En qué año se fundó Visma?",
    options: [
      { id: uid(), text: "1996", correct: true },
      { id: uid(), text: "2005" },
      { id: uid(), text: "1988" },
      { id: uid(), text: "2012" },
    ] },
  { id: uid(), type: "mc", mode: "poll", multi: false, timeLimit: 0,
    bg: { type: "preset", id: "sunset" },
    prompt: "¿Cómo venís con el proyecto esta semana?",
    options: [
      { id: uid(), text: "En control" },
      { id: uid(), text: "Vamos bien" },
      { id: uid(), text: "Algo perdido/a" },
      { id: uid(), text: "Necesito una mano" },
    ] },
  { id: uid(), type: "wordcloud", bg: { type: "preset", id: "mint" },
    prompt: "En una palabra, ¿qué define al equipo?", options: [] },
  { id: uid(), type: "scale", bg: { type: "preset", id: "grape" },
    prompt: "¿Qué tan claras están las prioridades?", options: [],
    scaleMin: 1, scaleMax: 5, minLabel: "Nada claras", maxLabel: "Muy claras" },
];

function newQuestion(type) {
  const base = { id: uid(), type, prompt: "", options: [] };
  if (type === "mc") Object.assign(base, {
    mode: "poll", multi: false, timeLimit: 0,
    options: [{ id: uid(), text: "" }, { id: uid(), text: "" }],
  });
  if (type === "scale") Object.assign(base, { scaleMin: 1, scaleMax: 5, minLabel: "", maxLabel: "" });
  return base;
}

const usePrefersReducedMotion = () => {
  const [r, setR] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(m.matches); on();
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return r;
};

// Tick cada segundo para los contadores.
const useNow = (active) => {
  const [t, setT] = useState(now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT(now()), 500);
    return () => clearInterval(id);
  }, [active]);
  return t;
};

/* ================================================================== */
export default function App() {
  const [screen, setScreen] = useState("home");
  const [ownerId] = useState(getOwnerId);
  const [ownerName, setName] = useState(getOwnerName);
  const [quiz, setQuiz] = useState(null);          // quiz en edición
  const [live, setLive] = useState(null);          // { code, title, questions } sesión a presentar
  const [joinCode, setJoinCode] = useState("");
  const [pid] = useState(uid);
  const [player, setPlayer] = useState({ name: "", avatar: "", color: "" });

  const updateName = (n) => { setName(n); setOwnerName(n); };

  const openNewQuiz = () => {
    setQuiz({ id: uid(), ownerId, ownerName, title: "Quiz sin título", questions: seedQuestions() });
    setScreen("editor");
  };
  const openQuiz = (q) => { setQuiz(q); setScreen("editor"); };

  const present = async (q) => {
    const code = genCode();
    await upsertSession({ code, title: q.title, questions: q.questions, activeIndex: -1, status: "lobby", starts: {} });
    setLive({ code, title: q.title, questions: q.questions });
    setScreen("present");
  };

  return (
    <div className="min-h-screen w-full" style={{ background: C.bg, color: C.text, fontFamily: FONT }}>
      {screen === "home" && (
        <Home ownerId={ownerId} ownerName={ownerName} onName={updateName}
          onNew={openNewQuiz} onOpen={openQuiz} onPresent={present} onJoin={() => setScreen("join")} />
      )}
      {screen === "editor" && quiz && (
        <Editor quiz={quiz} onExit={() => setScreen("home")} onPresent={present} />
      )}
      {screen === "present" && live && (
        <Present live={live} onExit={() => setScreen("home")} />
      )}
      {screen === "join" && (
        <Join pid={pid} defaultName={ownerName} onBack={() => setScreen("home")}
          onJoined={(c, p) => { setJoinCode(c); setPlayer(p); setScreen("play"); }} />
      )}
      {screen === "play" && (
        <Participant code={joinCode} pid={pid} player={player} onLeave={() => setScreen("home")} />
      )}
    </div>
  );
}

/* ================================================================== */
function Home({ ownerId, ownerName, onName, onNew, onOpen, onPresent, onJoin }) {
  const [quizzes, setQuizzes] = useState(null);
  const [editingName, setEditingName] = useState(!ownerName);

  useEffect(() => {
    (async () => setQuizzes(await listQuizzes(ownerId)))();
  }, [ownerId]);

  const removeQuiz = async (id) => {
    await deleteQuiz(id);
    setQuizzes((qs) => (qs || []).filter((q) => q.id !== id));
  };

  return (
    <div className="max-w-5xl mx-auto px-5 py-10 md:py-14">
      <div className="flex items-center justify-between">
        <BrandMark large />
        <button onClick={onJoin} className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors hover:border-[#2F9BE0]"
          style={{ borderColor: C.border, background: C.white, color: C.navy }}>
          <LogIn className="w-4 h-4" /> Sumarme a un quiz
        </button>
      </div>

      <h1 className="mt-8 text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05]" style={{ color: C.navy }}>
        Menos slides.<br />Más <span style={{ color: C.blue }}>jugar en equipo.</span>
      </h1>
      <p className="mt-4 max-w-lg text-lg" style={{ color: C.textSoft }}>
        Nuestro Kahoot interno: armá quizzes con puntaje y ranking, o encuestas en vivo para las charlas, onboardings y afters del equipo. Cada quien juega desde el celu con un código. 🌱
      </p>

      {/* Identidad */}
      <div className="mt-6 flex items-center gap-2 text-sm" style={{ color: C.textSoft }}>
        {editingName ? (
          <div className="flex items-center gap-2">
            <input autoFocus defaultValue={ownerName} placeholder="Tu nombre"
              onKeyDown={(e) => { if (e.key === "Enter") { onName(e.target.value.trim()); setEditingName(false); } }}
              onBlur={(e) => { onName(e.target.value.trim()); setEditingName(false); }}
              className="border rounded-lg px-3 py-1.5 outline-none focus:border-[#2F9BE0]"
              style={{ borderColor: C.border, background: C.white, color: C.text }} />
          </div>
        ) : (
          <button onClick={() => setEditingName(true)} className="flex items-center gap-1.5 hover:opacity-70">
            <span>Hola, <b style={{ color: C.navy }}>{ownerName || "invitada/o"}</b></span>
            <Pencil className="w-3.5 h-3.5" style={{ color: C.muted }} />
          </button>
        )}
      </div>

      {/* Biblioteca */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-xl font-bold" style={{ color: C.navy }}>Mis quizzes</h2>
        <button onClick={onNew} className="flex items-center gap-2 rounded-full px-4 py-2.5 font-bold text-white transition-transform hover:-translate-y-0.5"
          style={{ background: C.navy, boxShadow: "0 12px 26px -14px rgba(22,34,140,.7)" }}>
          <Plus className="w-5 h-5" /> Crear quiz
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {quizzes === null && <div className="text-sm" style={{ color: C.muted }}>Cargando…</div>}
        {quizzes && quizzes.length === 0 && (
          <button onClick={onNew} className="sm:col-span-2 rounded-2xl border border-dashed p-8 text-center transition-colors hover:border-[#2F9BE0]"
            style={{ borderColor: C.border, color: C.muted, background: C.white }}>
            <Sparkles className="w-6 h-6 mx-auto mb-2" style={{ color: C.blue }} />
            Todavía no tenés quizzes. Creá el primero.
          </button>
        )}
        {quizzes && quizzes.map((q) => {
          const nq = q.questions.filter(isQuiz).length;
          return (
            <div key={q.id} className="rounded-2xl p-5 flex flex-col" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-bold text-lg leading-tight" style={{ color: C.navy }}>{q.title || "Sin título"}</div>
                <button onClick={() => removeQuiz(q.id)} className="p-1.5 rounded-lg hover:bg-[#EAF6FE]"><Trash2 className="w-4 h-4" style={{ color: C.bad }} /></button>
              </div>
              <div className="mt-1 text-sm" style={{ color: C.muted }}>
                {q.questions.length} pregunta{q.questions.length !== 1 ? "s" : ""}{nq > 0 ? ` · ${nq} de quiz` : ""}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <button onClick={() => onOpen(q)} className="flex-1 flex items-center justify-center gap-1.5 rounded-full border py-2.5 font-semibold transition-colors hover:border-[#2F9BE0]"
                  style={{ borderColor: C.border, color: C.navy, background: C.white }}>
                  <Pencil className="w-4 h-4" /> Editar
                </button>
                <button onClick={() => onPresent(q)} className="flex-1 flex items-center justify-center gap-1.5 rounded-full py-2.5 font-semibold text-white"
                  style={{ background: C.navy }}>
                  <Play className="w-4 h-4" fill="currentColor" /> Presentar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BrandMark({ large }) {
  const reduce = usePrefersReducedMotion();
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-3 w-3">
        {!reduce && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: C.blue }} />}
        <span className="relative inline-flex rounded-full h-3 w-3" style={{ background: C.blue }} />
      </span>
      <span className={`font-extrabold tracking-tight ${large ? "text-2xl" : "text-lg"}`} style={{ color: C.navy }}>{APP_NAME}</span>
      <span className="text-[10px] uppercase tracking-[0.2em] mt-0.5" style={{ color: C.muted }}>en vivo</span>
    </div>
  );
}

/* ================================================================== */
/*  Editor de quiz                                                     */
/* ================================================================== */
function Editor({ quiz, onExit, onPresent }) {
  const [title, setTitle] = useState(quiz.title);
  const [questions, setQuestions] = useState(quiz.questions);
  const [saved, setSaved] = useState("idle"); // idle | saving | saved
  const first = useRef(true);

  // Autosave a la biblioteca.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaved("saving");
    const t = setTimeout(async () => {
      await saveQuiz({ ...quiz, title, questions });
      setSaved("saved");
    }, 600);
    return () => clearTimeout(t);
  }, [title, questions]); // eslint-disable-line react-hooks/exhaustive-deps

  const addQ = (type) => setQuestions((q) => [...q, newQuestion(type)]);
  const update = (id, patch) => setQuestions((q) => q.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const remove = (id) => setQuestions((q) => q.filter((x) => x.id !== id));
  const move = (id, dir) => setQuestions((q) => {
    const i = q.findIndex((x) => x.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= q.length) return q;
    const copy = [...q]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy;
  });

  const launch = async () => { await saveQuiz({ ...quiz, title, questions }); onPresent({ ...quiz, title, questions }); };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm hover:opacity-70" style={{ color: C.textSoft }}>
          <ArrowLeft className="w-4 h-4" /> Mis quizzes
        </button>
        <BrandMark />
        <span className="text-xs" style={{ color: C.muted }}>
          {saved === "saving" ? "Guardando…" : saved === "saved" ? "Guardado ✓" : ""}
        </span>
      </div>

      <div className="mt-6 rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent text-2xl md:text-3xl font-extrabold tracking-tight outline-none"
          style={{ color: C.navy }} placeholder="Título del quiz" />
        <p className="text-sm mt-1" style={{ color: C.muted }}>
          {questions.length} pregunta{questions.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {questions.map((q, i) => (
          <QuestionCard key={q.id} index={i} total={questions.length} q={q}
            onUpdate={(p) => update(q.id, p)} onRemove={() => remove(q.id)} onMove={(d) => move(q.id, d)} />
        ))}
        {questions.length === 0 && (
          <div className="rounded-2xl border border-dashed p-8 text-center" style={{ borderColor: C.border, color: C.muted, background: C.white }}>
            Todavía no hay preguntas. Agregá la primera acá abajo.
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="text-xs uppercase tracking-widest mb-2" style={{ color: C.muted }}>Agregar pregunta</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(TYPE_META).map(([t, m]) => {
            const Icon = m.icon;
            return (
              <button key={t} onClick={() => addQ(t)}
                className="flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors hover:border-[#2F9BE0]"
                style={{ borderColor: C.border, background: C.white }}>
                <Icon className="w-5 h-5" style={{ color: C.blue }} />
                <span className="text-sm font-semibold" style={{ color: C.navy }}>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={launch} disabled={questions.length === 0}
        className="mt-8 w-full flex items-center justify-center gap-2 rounded-full py-4 font-bold text-lg text-white disabled:opacity-40 transition-opacity"
        style={{ background: C.navy, boxShadow: "0 14px 30px -14px rgba(22,34,140,.7)" }}>
        <Play className="w-5 h-5" fill="currentColor" /> Presentar
      </button>
    </div>
  );
}

function QuestionCard({ index, total, q, onUpdate, onRemove, onMove }) {
  const M = TYPE_META[q.type]; const Icon = M.icon;
  const field = { borderColor: C.border, color: C.text };
  const isMc = q.type === "mc";
  const quizMode = isMc && q.mode === "quiz";

  const toggleCorrect = (oid) => {
    const opts = q.options.map((x) => x.id === oid ? { ...x, correct: !x.correct } : x);
    const correctCount = opts.filter((o) => o.correct).length;
    onUpdate({ options: opts, multi: q.multi || correctCount > 1 });
  };

  return (
    <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
        <span className="font-mono font-bold" style={{ color: C.blue }}>{String(index + 1).padStart(2, "0")}</span>
        <Icon className="w-4 h-4" style={{ color: C.blue }} />
        <span>{M.label}</span>
        <div className="ml-auto flex items-center gap-1">
          <IconBtn disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="w-4 h-4" style={{ color: C.textSoft }} /></IconBtn>
          <IconBtn disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown className="w-4 h-4" style={{ color: C.textSoft }} /></IconBtn>
          <IconBtn onClick={onRemove}><Trash2 className="w-4 h-4" style={{ color: C.bad }} /></IconBtn>
        </div>
      </div>

      <input value={q.prompt} onChange={(e) => onUpdate({ prompt: e.target.value })}
        placeholder="Escribí la pregunta…"
        className="mt-3 w-full bg-transparent text-lg font-semibold outline-none" style={{ color: C.text }} />

      <BackgroundPicker q={q} onUpdate={onUpdate} />

      {isMc && (
        <>
          {/* Modo encuesta / quiz */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Segmented value={q.mode} onChange={(mode) => onUpdate({ mode })}
              options={[{ v: "poll", label: "Encuesta" }, { v: "quiz", label: "Quiz" }]} />
            <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none" style={{ color: C.textSoft }}>
              <input type="checkbox" checked={!!q.multi} onChange={(e) => onUpdate({ multi: e.target.checked })} />
              Varias respuestas
            </label>
            {quizMode && (
              <div className="flex items-center gap-1.5 text-sm" style={{ color: C.textSoft }}>
                <Timer className="w-4 h-4" style={{ color: C.blue }} />
                <select value={q.timeLimit ?? 0} onChange={(e) => onUpdate({ timeLimit: +e.target.value })}
                  className="border rounded-lg px-2 py-1 outline-none" style={field}>
                  {TIME_OPTIONS.map((s) => <option key={s} value={s}>{s === 0 ? "Sin tiempo" : `${s}s`}</option>)}
                </select>
              </div>
            )}
          </div>
          {quizMode && (
            <p className="mt-2 text-xs" style={{ color: C.muted }}>Marcá la(s) respuesta(s) correcta(s) con el círculo de la izquierda.</p>
          )}

          <div className="mt-3 space-y-2">
            {q.options.map((o, i) => (
              <div key={o.id} className="flex items-center gap-2">
                {quizMode ? (
                  <button onClick={() => toggleCorrect(o.id)} title="Marcar como correcta">
                    {o.correct
                      ? <CheckCircle2 className="w-5 h-5" style={{ color: C.good }} />
                      : <Circle className="w-5 h-5" style={{ color: C.muted }} />}
                  </button>
                ) : (
                  <span className="w-5 text-center font-bold" style={{ color: CHART[i % CHART.length] }}>{String.fromCharCode(65 + i)}</span>
                )}
                <input value={o.text} onChange={(e) => onUpdate({ options: q.options.map((x) => x.id === o.id ? { ...x, text: e.target.value } : x) })}
                  placeholder={`Opción ${i + 1}`}
                  className="flex-1 bg-transparent border-b outline-none py-1" style={field} />
                {q.options.length > 2 && (
                  <IconBtn onClick={() => onUpdate({ options: q.options.filter((x) => x.id !== o.id) })}>
                    <X className="w-4 h-4" style={{ color: C.muted }} />
                  </IconBtn>
                )}
              </div>
            ))}
            {q.options.length < 8 && (
              <button onClick={() => onUpdate({ options: [...q.options, { id: uid(), text: "" }] })}
                className="flex items-center gap-1.5 text-sm mt-1 hover:opacity-70" style={{ color: C.blueDeep }}>
                <Plus className="w-4 h-4" /> Agregar opción
              </button>
            )}
          </div>
        </>
      )}

      {q.type === "scale" && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <label style={{ color: C.textSoft }}>Mínimo
            <input type="number" value={q.scaleMin} onChange={(e) => onUpdate({ scaleMin: Math.max(0, +e.target.value) })}
              className="mt-1 w-full bg-transparent border rounded-lg px-2 py-1.5" style={field} />
          </label>
          <label style={{ color: C.textSoft }}>Máximo
            <input type="number" value={q.scaleMax} onChange={(e) => onUpdate({ scaleMax: Math.max(+q.scaleMin + 1, +e.target.value) })}
              className="mt-1 w-full bg-transparent border rounded-lg px-2 py-1.5" style={field} />
          </label>
          <label style={{ color: C.textSoft }}>Etiqueta mínima
            <input value={q.minLabel} onChange={(e) => onUpdate({ minLabel: e.target.value })} placeholder="ej. Nada"
              className="mt-1 w-full bg-transparent border rounded-lg px-2 py-1.5" style={field} />
          </label>
          <label style={{ color: C.textSoft }}>Etiqueta máxima
            <input value={q.maxLabel} onChange={(e) => onUpdate({ maxLabel: e.target.value })} placeholder="ej. Mucho"
              className="mt-1 w-full bg-transparent border rounded-lg px-2 py-1.5" style={field} />
          </label>
        </div>
      )}

      {(q.type === "wordcloud" || q.type === "open") && (
        <p className="mt-2 text-xs" style={{ color: C.muted }}>{M.hint}</p>
      )}
    </div>
  );
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-full p-0.5" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)}
            className="px-3 py-1 text-sm font-semibold rounded-full transition-colors"
            style={{ background: on ? C.navy : "transparent", color: on ? "#fff" : C.textSoft }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function BackgroundPicker({ q, onUpdate }) {
  const sel = q.bg;
  const isNone = !sel;
  const isImg = sel?.type === "image";
  const [showUrl, setShowUrl] = useState(isImg);
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs uppercase tracking-widest mr-1" style={{ color: C.muted }}>Fondo</span>
        <button onClick={() => { onUpdate({ bg: null }); setShowUrl(false); }} title="Sin fondo"
          className="w-8 h-8 rounded-lg flex items-center justify-center border transition-transform hover:scale-105"
          style={{ borderColor: isNone ? C.navy : C.border, background: C.white }}>
          <X className="w-4 h-4" style={{ color: C.muted }} />
        </button>
        {BACKGROUNDS.map((b) => {
          const on = sel?.type === "preset" && sel.id === b.id;
          return (
            <button key={b.id} onClick={() => { onUpdate({ bg: { type: "preset", id: b.id } }); setShowUrl(false); }} title={b.label}
              className="w-8 h-8 rounded-lg transition-transform hover:scale-110"
              style={{ background: b.css, outline: on ? `2px solid ${C.navy}` : "none", outlineOffset: 1 }} />
          );
        })}
        <button onClick={() => setShowUrl((s) => !s)} title="Imagen por URL"
          className="w-8 h-8 rounded-lg flex items-center justify-center border transition-transform hover:scale-105"
          style={{ borderColor: isImg ? C.navy : C.border, background: C.white }}>
          <ImageIcon className="w-4 h-4" style={{ color: C.blue }} />
        </button>
      </div>
      {showUrl && (
        <input value={isImg ? sel.url : ""}
          onChange={(e) => onUpdate({ bg: e.target.value ? { type: "image", url: e.target.value.trim() } : null })}
          placeholder="Pegá el link de una imagen (https://…)"
          className="mt-2 w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#2F9BE0]"
          style={{ borderColor: C.border, background: C.white, color: C.text }} />
      )}
    </div>
  );
}

/* ================================================================== */
/*  Presentador                                                        */
/* ================================================================== */
function Present({ live, onExit }) {
  const { code, title, questions } = live;
  const [state, setState] = useState({ activeIndex: -1, status: "lobby", starts: {} });
  const [participants, setParticipants] = useState([]);
  const [revealed, setRevealed] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const push = useCallback(async (patch) => {
    const next = { ...stateRef.current, ...patch };
    setState(next);
    await upsertSession({ code, title, questions, ...next });
  }, [code, title, questions]);

  useEffect(() => {
    (async () => {
      const d = await getSession(code);
      if (d) setState({ activeIndex: d.activeIndex ?? -1, status: d.status ?? "lobby", starts: d.starts || {} });
    })();
  }, [code]);

  useEffect(() => {
    let alive = true;
    const reload = async () => { const docs = await listParticipants(code); if (alive) setParticipants(docs); };
    reload();
    const unsub = subscribeParticipants(code, reload);
    return () => { alive = false; unsub(); };
  }, [code]);

  const startAt = (idx, starts) => {
    const q = questions[idx];
    if (q && !starts[q.id]) return { ...starts, [q.id]: now() };
    return starts;
  };

  const start = () => { setRevealed(false); setShowBoard(false); push({ status: "live", activeIndex: 0, starts: startAt(0, state.starts) }); };
  const go = (dir) => {
    const ni = state.activeIndex + dir;
    if (ni < 0) return;
    setRevealed(false); setShowBoard(false);
    if (ni >= questions.length) return push({ status: "ended" });
    push({ activeIndex: ni, status: "live", starts: startAt(ni, state.starts) });
  };
  const resetSession = async () => {
    await deleteParticipants(code);
    setParticipants([]); setRevealed(false); setShowBoard(false);
    push({ status: "lobby", activeIndex: -1, starts: {} });
  };

  const q = questions[state.activeIndex];
  const answered = q ? participants.filter((p) => hasAnswer(p, q)).length : 0;
  const quizMode = q ? isQuiz(q) : false;
  const board = leaderboard(questions, participants, state.starts);
  const hasQuiz = questions.some(isQuiz);
  const start0 = q ? state.starts[q.id] : null;

  return (
    <div className="min-h-screen flex flex-col max-w-5xl mx-auto px-4 py-5">
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="flex items-center gap-1.5 text-sm hover:opacity-70" style={{ color: C.textSoft }}>
          <ArrowLeft className="w-4 h-4" /> Salir
        </button>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: C.navy }}>
            <Users className="w-4 h-4" /> {participants.length}
          </span>
          <CodeChip code={code} />
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center py-8">
        {state.status === "lobby" && <Lobby code={code} participants={participants} onStart={start} canStart={questions.length > 0} />}

        {state.status === "live" && q && !showBoard && (
          <QuestionStage q={q} index={state.activeIndex} total={questions.length}
            quizMode={quizMode} start0={start0} answered={answered}
            participants={participants} revealed={revealed} />
        )}

        {state.status === "live" && showBoard && (
          <Leaderboard board={board} title="Posiciones" />
        )}

        {state.status === "ended" && (
          hasQuiz
            ? <Podium board={board} count={participants.length} />
            : <div className="text-center">
                <div className="text-5xl md:text-7xl font-extrabold tracking-tight" style={{ color: C.navy }}>¡Gracias!</div>
                <p className="mt-3" style={{ color: C.textSoft }}>
                  Se terminó la sesión. {participants.length} participante{participants.length !== 1 ? "s" : ""}.
                </p>
              </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-4 border-t" style={{ borderColor: C.border }}>
        <button onClick={resetSession} className="flex items-center gap-1.5 text-sm hover:opacity-70" style={{ color: C.muted }}>
          <RotateCcw className="w-4 h-4" /> Reiniciar
        </button>
        {state.status !== "lobby" && (
          <div className="flex items-center gap-2">
            {state.status === "live" && quizMode && !showBoard && (
              <button onClick={() => setRevealed((r) => !r)}
                className="flex items-center gap-1 rounded-full border px-4 py-2.5 font-semibold"
                style={{ borderColor: C.border, background: revealed ? C.goodBg : C.white, color: revealed ? C.good : C.navy }}>
                <Eye className="w-4 h-4" /> {revealed ? "Ocultar" : "Revelar"}
              </button>
            )}
            {state.status === "live" && hasQuiz && (
              <button onClick={() => setShowBoard((b) => !b)}
                className="flex items-center gap-1 rounded-full border px-4 py-2.5 font-semibold"
                style={{ borderColor: C.border, background: showBoard ? C.card : C.white, color: C.navy }}>
                <Trophy className="w-4 h-4" /> {showBoard ? "Pregunta" : "Posiciones"}
              </button>
            )}
            <button onClick={() => go(-1)} disabled={state.activeIndex <= 0}
              className="flex items-center gap-1 rounded-full border px-4 py-2.5 disabled:opacity-30"
              style={{ borderColor: C.border, background: C.white, color: C.navy }}>
              <ChevronLeft className="w-5 h-5" /> Anterior
            </button>
            <button onClick={() => go(1)}
              className="flex items-center gap-1 rounded-full px-5 py-2.5 font-semibold text-white"
              style={{ background: C.navy }}>
              {state.status === "ended" ? "Terminado" : state.activeIndex >= questions.length - 1 ? "Finalizar" : "Siguiente"}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionStage({ q, index, total, quizMode, start0, answered, participants, revealed }) {
  const bg = questionBg(q);
  const onBg = !!bg;
  const header = (
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-mono flex items-center gap-2" style={{ color: onBg ? "rgba(255,255,255,.85)" : C.muted }}>
        {index + 1} / {total}
        {quizMode && <span className="px-2 py-0.5 rounded-full text-xs font-bold"
          style={{ background: onBg ? "rgba(255,255,255,.22)" : C.card, color: onBg ? "#fff" : C.blueDeep }}>QUIZ</span>}
      </span>
      <div className="flex items-center gap-3">
        {quizMode && q.timeLimit > 0 && start0 && <Countdown start={start0} limit={q.timeLimit} />}
        <span className="text-sm flex items-center gap-1.5" style={{ color: onBg ? "rgba(255,255,255,.85)" : C.textSoft }}>
          <Radio className="w-3.5 h-3.5" style={{ color: onBg ? "#fff" : C.blue }} /> {answered} respondieron
        </span>
      </div>
    </div>
  );

  if (!onBg) {
    return (
      <div className="rounded-2xl p-6 md:p-8" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        {header}
        <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-8" style={{ color: C.navy }}>{q.prompt || "—"}</h2>
        <LiveResult q={q} participants={participants} showCorrect={quizMode && revealed} />
      </div>
    );
  }
  return (
    <div className="rounded-2xl overflow-hidden shadow-lg" style={{ border: `1px solid ${C.border}` }}>
      <div className="p-6 md:p-12"
        style={{ backgroundImage: `linear-gradient(rgba(8,12,35,.42), rgba(8,12,35,.60)), ${bg}`, backgroundSize: "cover", backgroundPosition: "center" }}>
        {header}
        <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight"
          style={{ color: "#fff", textShadow: "0 2px 14px rgba(0,0,0,.4)" }}>{q.prompt || "—"}</h2>
      </div>
      <div className="p-6 md:p-8" style={{ background: C.white }}>
        <LiveResult q={q} participants={participants} showCorrect={quizMode && revealed} />
      </div>
    </div>
  );
}

function Countdown({ start, limit }) {
  const t = useNow(true);
  const remaining = Math.max(0, Math.ceil(limit - (t - start) / 1000));
  const over = remaining <= 0;
  return (
    <span className="flex items-center gap-1.5 text-sm font-bold tabular-nums px-2.5 py-1 rounded-full"
      style={{ background: over ? "#FDECEA" : C.card, color: over ? C.bad : C.blueDeep }}>
      <Timer className="w-4 h-4" /> {over ? "¡Tiempo!" : `${remaining}s`}
    </span>
  );
}

function Lobby({ code, participants, onStart, canStart }) {
  const count = participants.length;
  return (
    <div className="text-center">
      <p className="uppercase tracking-[0.25em] text-xs mb-4" style={{ color: C.muted }}>Sumate con el código</p>
      <div className="inline-block rounded-3xl px-8 py-6 text-white"
        style={{ background: `linear-gradient(135deg, ${C.navy} 0%, ${C.blueDeep} 55%, ${C.blue} 100%)`, boxShadow: "0 22px 48px -22px rgba(22,34,140,.65)" }}>
        <div className="font-mono font-extrabold tracking-[0.15em] leading-none" style={{ fontSize: "clamp(3rem, 12vw, 6rem)" }}>
          {fmtCode(code)}
        </div>
      </div>
      <p className="mt-6 text-lg flex items-center justify-center gap-2 font-semibold" style={{ color: C.navy }}>
        <Users className="w-5 h-5" /> {count} conectado{count !== 1 ? "s" : ""}
      </p>

      {count > 0 && (
        <div className="mt-5 flex flex-wrap items-start justify-center gap-3 max-w-2xl mx-auto">
          {participants.map((p) => (
            <div key={p.pid} className="flex flex-col items-center gap-1 w-16" style={{ animation: "laroot-pop .3s ease" }}>
              <Avatar avatar={p.avatar} color={p.color} size={48} />
              <span className="text-xs font-semibold truncate max-w-full" style={{ color: C.textSoft }}>
                {p.name || "Anónimo"}
              </span>
            </div>
          ))}
        </div>
      )}

      <button onClick={onStart} disabled={!canStart}
        className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 font-bold text-lg text-white disabled:opacity-40"
        style={{ background: C.navy, boxShadow: "0 14px 30px -14px rgba(22,34,140,.7)" }}>
        <Play className="w-5 h-5" fill="currentColor" /> Empezar
      </button>
    </div>
  );
}

function Leaderboard({ board, title }) {
  return (
    <div className="rounded-2xl p-6 md:p-8" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-5">
        <Trophy className="w-6 h-6" style={{ color: C.gold }} />
        <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: C.navy }}>{title}</h2>
      </div>
      {board.length === 0 && <Waiting />}
      <div className="space-y-2">
        {board.slice(0, 10).map((r, i) => (
          <div key={r.pid} className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{ background: i < 3 ? C.card : C.white, border: `1px solid ${C.border}` }}>
            <span className="w-7 text-center font-extrabold tabular-nums" style={{ color: i < 3 ? C.gold : C.muted }}>{i + 1}</span>
            <Avatar avatar={r.avatar} color={r.color} size={34} />
            <span className="font-semibold flex-1 truncate" style={{ color: C.text }}>{r.name}</span>
            <span className="text-sm" style={{ color: C.muted }}>{r.correct}/{r.total}</span>
            <span className="font-extrabold tabular-nums" style={{ color: C.navy }}>{r.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Podium({ board, count }) {
  const top = board.slice(0, 3);
  return (
    <div className="text-center">
      <div className="text-4xl md:text-6xl font-extrabold tracking-tight mb-2" style={{ color: C.navy }}>¡Terminamos!</div>
      <p className="mb-8" style={{ color: C.textSoft }}>{count} participante{count !== 1 ? "s" : ""}</p>
      <div className="flex items-end justify-center gap-3 max-w-xl mx-auto">
        {[1, 0, 2].map((slot) => {
          const r = top[slot]; if (!r) return <div key={slot} className="flex-1" />;
          const h = slot === 0 ? "h-40" : slot === 1 ? "h-28" : "h-24";
          const medal = slot === 0 ? C.gold : slot === 1 ? "#9AA7B4" : "#CD7F32";
          return (
            <div key={slot} className="flex-1 flex flex-col items-center">
              <Avatar avatar={r.avatar} color={r.color} size={slot === 0 ? 64 : 52} ring={medal} />
              <Medal className="w-7 h-7 mt-1 mb-0.5" style={{ color: medal }} />
              <div className="font-bold truncate max-w-full" style={{ color: C.navy }}>{r.name}</div>
              <div className="text-sm mb-2 tabular-nums" style={{ color: C.muted }}>{r.score} pts</div>
              <div className={`w-full ${h} rounded-t-xl`} style={{ background: `linear-gradient(180deg, ${C.blue}, ${C.navy})` }} />
            </div>
          );
        })}
      </div>
      {board.length > 3 && (
        <div className="mt-8 max-w-md mx-auto space-y-2 text-left">
          {board.slice(3, 10).map((r, i) => (
            <div key={r.pid} className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <span className="w-6 text-center font-bold tabular-nums" style={{ color: C.muted }}>{i + 4}</span>
              <Avatar avatar={r.avatar} color={r.color} size={30} />
              <span className="font-semibold flex-1 truncate" style={{ color: C.text }}>{r.name}</span>
              <span className="font-extrabold tabular-nums" style={{ color: C.navy }}>{r.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- resultados ---------------- */
function hasAnswer(p, q) {
  const a = p?.answers?.[q.id];
  if (q.type === "wordcloud") return Array.isArray(a) && a.length > 0;
  if (q.type === "mc" && q.multi) return Array.isArray(a) && a.length > 0;
  return a !== undefined && a !== null && a !== "";
}

function LiveResult({ q, participants, showCorrect }) {
  if (q.type === "mc") {
    // Cuenta selecciones (soporta multi: array de ids).
    const counts = q.options.map((o) => participants.filter((p) => normalizeSelection(p?.answers?.[q.id]).includes(o.id)).length);
    const total = counts.reduce((s, n) => s + n, 0) || 1;
    return (
      <div className="space-y-3">
        {q.options.map((o, i) => {
          const n = counts[i]; const pct = Math.round((n / total) * 100);
          const correct = showCorrect && o.correct;
          const wrong = showCorrect && !o.correct;
          return (
            <div key={o.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold flex items-center gap-1.5" style={{ color: correct ? C.good : C.text }}>
                  {showCorrect && (o.correct ? <CheckCircle2 className="w-4 h-4" style={{ color: C.good }} /> : <X className="w-4 h-4" style={{ color: C.muted }} />)}
                  {o.text || `Opción ${i + 1}`}
                </span>
                <span className="tabular-nums" style={{ color: C.muted }}>{n} · {isFinite(pct) ? pct : 0}%</span>
              </div>
              <div className="h-8 rounded-lg overflow-hidden" style={{ background: C.card }}>
                <div className="h-full rounded-lg transition-all duration-500"
                  style={{ width: `${(n / total) * 100}%`, background: correct ? C.good : wrong ? C.sky : CHART[i % CHART.length], minWidth: n > 0 ? "6px" : 0 }} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (q.type === "wordcloud") {
    const freq = {};
    participants.forEach((p) => (p?.answers?.[q.id] || []).forEach((w) => {
      const k = String(w).trim().toLowerCase(); if (k) freq[k] = (freq[k] || 0) + 1;
    }));
    const words = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const max = words[0]?.[1] || 1;
    if (words.length === 0) return <Waiting />;
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 py-6">
        {words.map(([w, n], i) => (
          <span key={w} className="font-extrabold leading-none transition-all"
            style={{ fontSize: `${16 + (n / max) * 52}px`, color: CHART[i % CHART.length], opacity: 0.6 + (n / max) * 0.4 }}>
            {w}
          </span>
        ))}
      </div>
    );
  }

  if (q.type === "scale") {
    const answers = participants.map((p) => p?.answers?.[q.id]).filter((a) => a !== undefined && a !== null && a !== "");
    const nums = answers.map(Number).filter((x) => !isNaN(x));
    const avg = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
    const range = []; for (let v = q.scaleMin; v <= q.scaleMax; v++) range.push(v);
    const maxCount = Math.max(1, ...range.map((v) => nums.filter((n) => n === v).length));
    return (
      <div>
        <div className="flex items-end gap-3 mb-6">
          <span className="text-6xl font-extrabold tabular-nums" style={{ color: C.navy }}>{avg.toFixed(1)}</span>
          <span className="mb-2" style={{ color: C.muted }}>promedio · {nums.length} voto{nums.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-end justify-between gap-2 h-40">
          {range.map((v) => {
            const c = nums.filter((n) => n === v).length;
            return (
              <div key={v} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-xs mb-1 tabular-nums" style={{ color: C.muted }}>{c || ""}</span>
                <div className="w-full rounded-t-md transition-all duration-500"
                  style={{ height: `${(c / maxCount) * 100}%`, minHeight: c > 0 ? "6px" : "2px", background: c > 0 ? C.blue : C.card }} />
                <span className="text-sm font-mono mt-2 font-semibold" style={{ color: C.navy }}>{v}</span>
              </div>
            );
          })}
        </div>
        {(q.minLabel || q.maxLabel) && (
          <div className="flex justify-between text-xs mt-2" style={{ color: C.muted }}>
            <span>{q.minLabel}</span><span>{q.maxLabel}</span>
          </div>
        )}
      </div>
    );
  }

  const texts = participants.map((p) => ({ name: p?.name, t: p?.answers?.[q.id] })).filter((x) => x.t);
  if (texts.length === 0) return <Waiting />;
  return (
    <div className="columns-1 sm:columns-2 gap-3 space-y-3">
      {texts.map((x, i) => (
        <div key={i} className="break-inside-avoid rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
          <p style={{ color: C.text }}>{x.t}</p>
          {x.name && <p className="text-xs mt-2" style={{ color: C.muted }}>— {x.name}</p>}
        </div>
      ))}
    </div>
  );
}

function Waiting() {
  return <div className="text-center py-12" style={{ color: C.muted }}>Esperando respuestas…</div>;
}

/* ================================================================== */
function Join({ pid, defaultName, onBack, onJoined }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState(defaultName || "");
  const [avatar, setAvatar] = useState(() => randOf(AVATARS));
  const [color, setColor] = useState(() => randOf(AVATAR_COLORS));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const shuffle = () => { setAvatar(randOf(AVATARS)); setColor(randOf(AVATAR_COLORS)); };

  const submit = async () => {
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) { setErr("El código tiene 6 dígitos."); return; }
    setBusy(true); setErr("");
    const deck = await getSession(c);
    if (!deck) { setBusy(false); setErr("No encontramos esa sala. Fijate el código."); return; }
    const nm = name.trim();
    await upsertParticipant(c, { pid, name: nm, avatar, color, answers: {}, answerTimes: {} });
    setBusy(false);
    onJoined(c, { name: nm, avatar, color });
  };

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm hover:opacity-70" style={{ color: C.textSoft }}>
        <ArrowLeft className="w-4 h-4" /> Volver
      </button>
      <div className="mt-8">
        <BrandMark />
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight" style={{ color: C.navy }}>Unite a la sesión</h1>
        <p className="mt-1" style={{ color: C.textSoft }}>Ingresá el código de 6 dígitos.</p>

        <input inputMode="numeric" value={fmtCode(code)} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000 000" autoFocus
          className="mt-6 w-full text-center font-mono font-extrabold tracking-[0.15em] border rounded-2xl py-5 outline-none focus:border-[#2F9BE0]"
          style={{ borderColor: C.border, background: C.white, color: C.navy, fontSize: "2.5rem" }} />

        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre (opcional)"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="mt-3 w-full border rounded-xl px-4 py-3 outline-none focus:border-[#2F9BE0]"
          style={{ borderColor: C.border, background: C.white, color: C.text }} />

        {/* Avatar */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold" style={{ color: C.navy }}>Elegí tu personaje</span>
            <button onClick={shuffle} className="text-xs flex items-center gap-1 hover:opacity-70" style={{ color: C.blueDeep }}>
              <RotateCcw className="w-3.5 h-3.5" /> Al azar
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Avatar avatar={avatar} color={color} size={56} />
            <div className="flex-1 grid grid-cols-8 gap-1.5 max-h-28 overflow-y-auto p-1 rounded-xl"
              style={{ background: C.card, border: `1px solid ${C.border}` }}>
              {AVATARS.map((a) => (
                <button key={a} onClick={() => setAvatar(a)}
                  className="aspect-square rounded-lg text-lg flex items-center justify-center transition-transform hover:scale-110"
                  style={{ background: avatar === a ? color : "transparent", outline: avatar === a ? `2px solid ${C.navy}` : "none" }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {AVATAR_COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                style={{ background: c, outline: color === c ? `2px solid ${C.navy}` : "none", outlineOffset: 2 }} />
            ))}
          </div>
        </div>

        {err && <p className="mt-3 text-sm" style={{ color: C.bad }}>{err}</p>}

        <button onClick={submit} disabled={busy}
          className="mt-5 w-full flex items-center justify-center gap-2 rounded-full py-4 font-bold text-lg text-white disabled:opacity-50"
          style={{ background: C.navy }}>
          {busy ? "Buscando…" : "Entrar"} <LogIn className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function Avatar({ avatar, color, size = 40, ring }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full shrink-0"
      style={{
        width: size, height: size, background: color || C.card,
        fontSize: size * 0.55, lineHeight: 1,
        boxShadow: ring ? `0 0 0 3px ${ring}` : "none",
      }}>
      {avatar || "🙂"}
    </span>
  );
}

/* ================================================================== */
function Participant({ code, pid, player, onLeave }) {
  const { name, avatar, color } = player;
  const [deck, setDeck] = useState(null);
  const [answers, setAnswers] = useState({});
  const [times, setTimes] = useState({});
  const answersRef = useRef(answers); answersRef.current = answers;
  const timesRef = useRef(times); timesRef.current = times;

  useEffect(() => {
    let alive = true;
    (async () => { const d = await getSession(code); if (alive && d) setDeck(d); })();
    const unsub = subscribeSession(code, (d) => { if (d) setDeck(d); });
    return () => { alive = false; unsub(); };
  }, [code]);

  const saveAnswer = async (qid, value) => {
    const nextA = { ...answersRef.current, [qid]: value };
    const nextT = timesRef.current[qid] ? timesRef.current : { ...timesRef.current, [qid]: now() };
    setAnswers(nextA); setTimes(nextT);
    await upsertParticipant(code, { pid, name, avatar, color, answers: nextA, answerTimes: nextT });
  };

  if (!deck) return <div className="min-h-screen flex items-center justify-center" style={{ color: C.muted }}>Conectando…</div>;

  const q = deck.questions?.[deck.activeIndex];

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto px-5 py-6">
      <div className="flex items-center justify-between">
        <BrandMark />
        <div className="flex items-center gap-2">
          {name && <span className="text-sm font-semibold hidden sm:inline" style={{ color: C.navy }}>{name}</span>}
          <Avatar avatar={avatar} color={color} size={30} />
          <button onClick={onLeave} className="text-sm hover:opacity-70 ml-1" style={{ color: C.muted }}>Salir</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center py-8">
        {deck.status === "lobby" && (
          <div className="text-center">
            <Avatar avatar={avatar} color={color} size={88} />
            <div className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
              style={{ background: C.card, color: C.blueDeep, border: `1px solid ${C.border}` }}>
              <Check className="w-4 h-4" /> Estás adentro
            </div>
            <h2 className="mt-3 text-2xl font-bold" style={{ color: C.navy }}>{name ? `¡Hola, ${name}!` : "Todo listo"}</h2>
            <p className="mt-2" style={{ color: C.textSoft }}>Esperá a que arranque la sesión. Tu pantalla se actualiza sola.</p>
          </div>
        )}

        {deck.status === "live" && q && (
          <div>
            <p className="text-xs font-mono mb-3" style={{ color: C.muted }}>{deck.activeIndex + 1} / {deck.questions.length}</p>
            <h2 className="text-2xl font-extrabold tracking-tight mb-6" style={{ color: C.navy }}>{q.prompt}</h2>
            <AnswerInput q={q} value={answers[q.id]} answeredAt={times[q.id]} start={deck.starts?.[q.id]}
              onAnswer={(v) => saveAnswer(q.id, v)} />
          </div>
        )}

        {deck.status === "ended" && (
          <div className="text-center">
            <div className="text-4xl font-extrabold" style={{ color: C.navy }}>¡Gracias!</div>
            <p className="mt-2" style={{ color: C.textSoft }}>Se terminó la sesión.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AnswerInput({ q, value, answeredAt, start, onAnswer }) {
  const t = useNow(q.type === "mc" && q.mode === "quiz" && q.timeLimit > 0);
  const quizMode = isQuiz(q);
  const timeUp = quizMode && q.timeLimit > 0 && start && (t - start) / 1000 >= q.timeLimit;
  const locked = quizMode && (answeredAt != null || timeUp); // en quiz no se puede reeditar

  if (q.type === "mc") {
    const selected = normalizeSelection(value);
    const pick = (oid) => {
      if (locked) return;
      if (q.multi) {
        const nx = selected.includes(oid) ? selected.filter((x) => x !== oid) : [...selected, oid];
        onAnswer(nx);
      } else {
        onAnswer(oid);
      }
    };
    return (
      <div>
        {quizMode && q.timeLimit > 0 && start && (
          <div className="mb-4"><Countdown start={start} limit={q.timeLimit} /></div>
        )}
        <div className="space-y-3">
          {q.options.map((o, i) => {
            const sel = selected.includes(o.id);
            const col = CHART[i % CHART.length];
            const reveal = locked && quizMode;
            const isRight = o.correct;
            const border = reveal ? (isRight ? C.good : sel ? C.bad : C.border) : (sel ? col : C.border);
            const bg = reveal ? (isRight ? C.goodBg : C.white) : (sel ? C.card : C.white);
            return (
              <button key={o.id} onClick={() => pick(o.id)} disabled={locked}
                className="w-full flex items-center gap-3 rounded-xl border p-4 text-left transition-all disabled:cursor-default"
                style={{ borderColor: border, background: bg }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                  style={{ background: sel ? col : "transparent", border: `2px solid ${reveal && isRight ? C.good : col}`, color: sel ? "#fff" : col }}>
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="font-medium" style={{ color: C.text }}>{o.text || `Opción ${i + 1}`}</span>
                {reveal && isRight && <CheckCircle2 className="w-5 h-5 ml-auto" style={{ color: C.good }} />}
                {!reveal && sel && <Check className="w-5 h-5 ml-auto" style={{ color: col }} />}
              </button>
            );
          })}
        </div>
        {q.multi && !locked && <p className="mt-3 text-xs" style={{ color: C.muted }}>Podés elegir varias.</p>}
        {locked && quizMode && (
          <QuizFeedback q={q} value={value} answeredAt={answeredAt} start={start} />
        )}
      </div>
    );
  }

  if (q.type === "scale") {
    const range = []; for (let v = q.scaleMin; v <= q.scaleMax; v++) range.push(v);
    return (
      <div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(range.length, 6)}, minmax(0,1fr))` }}>
          {range.map((v) => {
            const sel = value === v;
            return (
              <button key={v} onClick={() => onAnswer(v)}
                className="aspect-square rounded-xl font-extrabold text-xl transition-all"
                style={{ background: sel ? C.navy : C.white, border: `1px solid ${sel ? C.navy : C.border}`, color: sel ? "#fff" : C.textSoft }}>
                {v}
              </button>
            );
          })}
        </div>
        {(q.minLabel || q.maxLabel) && (
          <div className="flex justify-between text-xs mt-2" style={{ color: C.muted }}>
            <span>{q.minLabel}</span><span>{q.maxLabel}</span>
          </div>
        )}
      </div>
    );
  }

  if (q.type === "wordcloud") return <WordInput words={value || []} onAnswer={onAnswer} />;
  return <OpenInput value={value || ""} onAnswer={onAnswer} />;
}

function QuizFeedback({ q, value, answeredAt, start }) {
  const ok = isCorrect(q, value);
  const pts = pointsFor(q, value, answeredAt, start);
  return (
    <div className="mt-4 rounded-xl p-4 text-center" style={{ background: ok ? C.goodBg : "#FDECEA", border: `1px solid ${ok ? C.good : C.bad}` }}>
      <div className="font-extrabold text-lg" style={{ color: ok ? C.good : C.bad }}>
        {ok ? "¡Correcto!" : "Uh, no era esa"}
      </div>
      {ok && <div className="text-sm mt-0.5" style={{ color: C.textSoft }}>+{pts} puntos</div>}
    </div>
  );
}

function WordInput({ words, onAnswer }) {
  const [txt, setTxt] = useState("");
  const add = () => {
    const w = txt.trim(); if (!w || words.length >= 5) return;
    onAnswer([...words, w]); setTxt("");
  };
  return (
    <div>
      <div className="flex gap-2">
        <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Escribí una palabra" maxLength={24}
          className="flex-1 border rounded-xl px-4 py-3 outline-none focus:border-[#2F9BE0]"
          style={{ borderColor: C.border, background: C.white, color: C.text }} />
        <button onClick={add} disabled={!txt.trim() || words.length >= 5}
          className="rounded-xl px-4 font-semibold text-white disabled:opacity-40" style={{ background: C.navy }}>
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {words.map((w, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 rounded-full pl-3 pr-2 py-1.5 text-sm font-medium"
            style={{ background: C.card, color: C.blueDeep, border: `1px solid ${C.border}` }}>
            {w}
            <button onClick={() => onAnswer(words.filter((_, j) => j !== i))}><X className="w-3.5 h-3.5" /></button>
          </span>
        ))}
      </div>
      <p className="text-xs mt-2" style={{ color: C.muted }}>{words.length}/5 palabras enviadas</p>
    </div>
  );
}

function OpenInput({ value, onAnswer }) {
  const [txt, setTxt] = useState(value);
  const [sent, setSent] = useState(!!value);
  useEffect(() => { setTxt(value); }, [value]);
  return (
    <div>
      <textarea value={txt} onChange={(e) => { setTxt(e.target.value); setSent(false); }} rows={4} maxLength={280}
        placeholder="Escribí tu respuesta…"
        className="w-full border rounded-xl px-4 py-3 outline-none focus:border-[#2F9BE0] resize-none"
        style={{ borderColor: C.border, background: C.white, color: C.text }} />
      <button onClick={() => { onAnswer(txt.trim()); setSent(true); }} disabled={!txt.trim()}
        className="mt-3 w-full flex items-center justify-center gap-2 rounded-full py-3.5 font-bold disabled:opacity-40"
        style={{ background: sent ? C.card : C.navy, color: sent ? C.blueDeep : "#fff", border: `1px solid ${sent ? C.border : C.navy}` }}>
        {sent ? <><Check className="w-5 h-5" /> Enviado — lo podés editar</> : <><Send className="w-4 h-4" /> Enviar</>}
      </button>
    </div>
  );
}

/* ---------------- UI común ---------------- */
function CodeChip({ code }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {} };
  return (
    <button onClick={copy} className="flex items-center gap-2 rounded-full border pl-3 pr-2.5 py-1.5"
      style={{ borderColor: C.border, background: C.white }}>
      <span className="font-mono font-bold tracking-widest" style={{ color: C.navy }}>{fmtCode(code)}</span>
      {copied ? <Check className="w-4 h-4" style={{ color: C.blueDeep }} /> : <Copy className="w-4 h-4" style={{ color: C.muted }} />}
    </button>
  );
}

function IconBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="p-1.5 rounded-lg hover:bg-[#EAF6FE] disabled:opacity-25 transition-colors">
      {children}
    </button>
  );
}
