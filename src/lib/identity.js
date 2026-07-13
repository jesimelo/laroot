/* ------------------------------------------------------------------ */
/*  Identidad local (sin login)                                        */
/*  Cada navegador tiene un owner_id estable y un nombre editable.     */
/*  Sirve para que cada persona vea y reutilice sus propios quizzes.   */
/* ------------------------------------------------------------------ */
const KEY_ID = "laroot_owner_id";
const KEY_NAME = "laroot_owner_name";

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function getOwnerId() {
  try {
    let v = localStorage.getItem(KEY_ID);
    if (!v) { v = rid(); localStorage.setItem(KEY_ID, v); }
    return v;
  } catch {
    return "anon";
  }
}

export function getOwnerName() {
  try { return localStorage.getItem(KEY_NAME) || ""; } catch { return ""; }
}

export function setOwnerName(n) {
  try { localStorage.setItem(KEY_NAME, n || ""); } catch { /* noop */ }
}
