# laroot!

Encuestas y **quizzes en vivo** con identidad Lara AI. Estilo Mentimeter + Kahoot: cada persona del equipo arma sus propios quizzes, los presenta en pantalla y la gente responde desde el celular con un código de 6 dígitos. Backend en **Supabase** (realtime, sin polling) y deploy en **Netlify**.

## Qué hace

- **Biblioteca de quizzes** — cada persona ve y reutiliza los suyos (identidad local por navegador, sin login).
- **Editor** con varios tipos de pregunta: opción múltiple, nube de palabras, escala y texto abierto. Autoguardado.
- **Modo encuesta o modo quiz** por pregunta de opción múltiple:
  - Marcás la(s) respuesta(s) correcta(s): una, varias, o ninguna.
  - Opción de **varias respuestas** (multi-select).
  - **Tiempo límite** opcional (10/20/30/60 s) con cuenta regresiva.
- **Presentador**: lobby con el código, avanzar pregunta por pregunta, revelar la correcta, ver resultados en vivo.
- **Puntaje estilo Kahoot**: 1000 puntos por acierto + bonus por velocidad. Tabla de posiciones acumulada y **podio** final.
- **Participante**: se suma con el código, elige **nombre y avatar** (personajes divertidos + color), responde, y en modo quiz ve al instante si acertó y cuántos puntos sumó.
- **Avatares** en todos lados: en el lobby aparecen los personajes que se van sumando, y en el ranking y el podio cada quien aparece con el suyo.
- **Fondos por pregunta**: elegí un gradiente de la paleta o pegá el link de una imagen para que la presentación quede espectacular en pantalla grande.

## Puesta en marcha (local)

1. **Instalá las dependencias**
   ```bash
   npm install
   ```

2. **Configurá Supabase**
   - En [supabase.com](https://supabase.com) creá un proyecto.
   - Abrí el **SQL Editor** y pegá/ejecutá todo `supabase/schema.sql`. Es idempotente: podés correrlo las veces que quieras sin romper nada.
   - En **Project Settings → API** copiá la *Project URL* y la *anon public key*.

3. **Creá tu archivo `.env`** (copiando el ejemplo)
   ```bash
   cp .env.example .env
   ```
   Y completá adentro:
   ```
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
   ```
   > La *anon key* es pública por diseño: va en el navegador. La seguridad la maneja Supabase con RLS.

4. **Levantá el server de desarrollo**
   ```bash
   npm run dev
   ```
   Abrí la URL que muestra la terminal (normalmente http://localhost:5173).

## Deploy en Netlify

1. Subí este proyecto a un repo (GitHub/GitLab).
2. En Netlify: **Add new site → Import from Git** y elegí el repo.
3. Netlify lee `netlify.toml` (build `npm run build`, publish `dist`). No hace falta tocar nada.
4. En **Site settings → Environment variables** cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Deploy. Listo: la URL de Netlify es la que compartís con el equipo.

Como cada quien tiene su propia biblioteca por navegador, cualquiera con el link puede crear y presentar sus propios quizzes.

## Estructura

```
laroot/
├─ index.html
├─ package.json
├─ vite.config.js
├─ tailwind.config.js
├─ postcss.config.js
├─ netlify.toml
├─ .env.example
├─ supabase/
│  └─ schema.sql          ← corré esto en el SQL Editor de Supabase
└─ src/
   ├─ main.jsx
   ├─ index.css
   ├─ App.jsx             ← toda la app (home, editor, presentador, participante)
   └─ lib/
      ├─ db.js            ← acceso a Supabase (quizzes, sesiones, participantes, realtime)
      ├─ identity.js      ← identidad local por navegador
      └─ scoring.js       ← puntaje estilo Kahoot (funciones puras)
```

## Stack

React 18 · Vite 5 · Tailwind 3 · Supabase (Postgres + Realtime) · Netlify.
