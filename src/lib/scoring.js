/* ------------------------------------------------------------------ */
/*  Scoring estilo Kahoot — funciones puras (fáciles de testear)       */
/* ------------------------------------------------------------------ */

export const BASE_POINTS = 1000;

// Normaliza una respuesta a array de ids seleccionados.
export function normalizeSelection(ans) {
  if (Array.isArray(ans)) return ans.filter((x) => x != null && x !== "");
  if (ans === undefined || ans === null || ans === "") return [];
  return [ans];
}

// ¿La pregunta es un quiz con respuesta(s) correcta(s) definida(s)?
export function isQuiz(q) {
  return q && q.type === "mc" && q.mode === "quiz" && (q.options || []).some((o) => o.correct);
}

export function correctIds(q) {
  return (q.options || []).filter((o) => o.correct).map((o) => o.id);
}

// ¿La respuesta es exactamente correcta? (todas las correctas, ninguna de más)
export function isCorrect(q, ans) {
  const correct = correctIds(q);
  if (correct.length === 0) return false;
  const sel = normalizeSelection(ans);
  return sel.length === correct.length && correct.every((id) => sel.includes(id));
}

// Puntos de una respuesta: 0 si es incorrecta; base con bonus por velocidad si acierta.
// Sin tiempo límite → puntaje fijo (base). Con tiempo → entre base y base/2.
export function pointsFor(q, ans, answeredAt, startedAt) {
  if (!isQuiz(q)) return 0;
  if (!isCorrect(q, ans)) return 0;
  if (!q.timeLimit || !startedAt || !answeredAt) return BASE_POINTS;
  const elapsed = Math.max(0, (answeredAt - startedAt) / 1000);
  const frac = Math.min(1, elapsed / q.timeLimit);
  return Math.round(BASE_POINTS * (1 - frac / 2));
}

// Tabla de posiciones acumulada sobre todas las preguntas de quiz.
// participants: [{ pid, name, answers, answerTimes }]
// starts: { [questionId]: epoch_ms }
export function leaderboard(questions, participants, starts = {}) {
  const quizQs = (questions || []).filter(isQuiz);
  return (participants || [])
    .map((p) => {
      let score = 0;
      let correct = 0;
      quizQs.forEach((q) => {
        const pts = pointsFor(q, p.answers?.[q.id], p.answerTimes?.[q.id], starts?.[q.id]);
        if (pts > 0) correct += 1;
        score += pts;
      });
      return { pid: p.pid, name: p.name || "Anónimo", avatar: p.avatar || "", color: p.color || "", score, correct, total: quizQs.length };
    })
    .sort((a, b) => b.score - a.score);
}
