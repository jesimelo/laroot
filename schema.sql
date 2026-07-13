-- ============================================================
--  laroot! — esquema de encuestas + quizzes en vivo (Supabase)
--  Idempotente: podés correrlo las veces que quieras sin romper.
--  Pegá todo en el SQL Editor y ejecutá.
-- ============================================================

-- ---------- Tablas ----------

-- Biblioteca de quizzes: cada persona guarda y reutiliza los suyos.
create table if not exists public.quizzes (
  id         uuid        primary key default gen_random_uuid(),
  owner_id   text        not null,                        -- id local de quien lo creó
  owner_name text        default '',
  title      text        not null default 'Quiz sin título',
  questions  jsonb       not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quizzes_owner_idx on public.quizzes (owner_id);

-- Una fila por sesión en vivo (lo que se está presentando).
create table if not exists public.sessions (
  code         text        primary key,                   -- código de 6 dígitos
  title        text        not null default 'Sesión sin título',
  questions    jsonb       not null default '[]'::jsonb,
  active_index int         not null default -1,
  status       text        not null default 'lobby',      -- lobby | live | ended
  starts       jsonb       not null default '{}'::jsonb,   -- { [questionId]: epoch_ms } arranque de cada pregunta
  updated_at   timestamptz not null default now()
);

-- Una fila por participante dentro de una sesión.
create table if not exists public.participants (
  id           uuid        primary key default gen_random_uuid(),
  session_code text        not null references public.sessions(code) on delete cascade,
  pid          text        not null,
  name         text        default '',
  avatar       text        default '',                     -- emoji del avatar elegido
  color        text        default '',                     -- color de fondo del avatar
  answers      jsonb       not null default '{}'::jsonb,   -- { [questionId]: respuesta }
  answer_times jsonb       not null default '{}'::jsonb,   -- { [questionId]: epoch_ms } cuándo respondió
  updated_at   timestamptz not null default now(),
  unique (session_code, pid)
);
create index if not exists participants_session_idx on public.participants (session_code);

-- ---------- Migración segura (si las tablas ya existían) ----------
alter table public.sessions     add column if not exists starts       jsonb not null default '{}'::jsonb;
alter table public.participants add column if not exists answer_times jsonb not null default '{}'::jsonb;
alter table public.participants add column if not exists avatar       text  default '';
alter table public.participants add column if not exists color        text  default '';

-- ---------- Realtime (idempotente) ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sessions'
  ) then
    alter publication supabase_realtime add table public.sessions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participants'
  ) then
    alter publication supabase_realtime add table public.participants;
  end if;
end $$;

-- ---------- Seguridad (RLS) ----------
-- App interna SIN login: se permite acceso anónimo a estas tablas.
-- Para uso interno del equipo es aceptable; acá se endurece si hace falta.
alter table public.quizzes      enable row level security;
alter table public.sessions     enable row level security;
alter table public.participants enable row level security;

drop policy if exists "laroot quizzes anon"      on public.quizzes;
drop policy if exists "laroot sessions anon"      on public.sessions;
drop policy if exists "laroot participants anon"  on public.participants;

create policy "laroot quizzes anon"      on public.quizzes      for all using (true) with check (true);
create policy "laroot sessions anon"      on public.sessions      for all using (true) with check (true);
create policy "laroot participants anon"  on public.participants  for all using (true) with check (true);
