-- Jalankan SQL ini sekali di Supabase > SQL Editor.
-- Untuk website publik tanpa login, policy di bawah membuat semua pengunjung
-- dapat membaca, menambah, dan menghapus history. Jika nanti perlu keamanan
-- per operator, gunakan Supabase Auth dan ubah policy-nya.

create table if not exists public.sounding_history (
  id text primary key,
  created_at timestamptz not null default now(),
  date date not null,
  time text not null,
  signature text not null unique,
  tank integer not null,
  ullage numeric,
  t1 numeric,
  t2 numeric,
  t3 numeric,
  "avgTemp" numeric,
  "tableTemp" numeric,
  density numeric,
  factor numeric,
  "baseUllage" numeric,
  difference numeric,
  "baseVolume" numeric,
  "litrePerCm" numeric,
  "volumeCorrection" numeric,
  "oilVolume" numeric,
  "massBeforeFactor" numeric,
  vmt numeric
);

alter table public.history enable row level security;

drop policy if exists "Public can read sounding history" on public.sounding_history;
drop policy if exists "Public can insert sounding history" on public.sounding_history;
drop policy if exists "Public can delete sounding history" on public.sounding_history;

create policy "Public can read sounding history"
on public.sounding_history for select
to anon, authenticated
using (true);

create policy "Public can insert sounding history"
on public.sounding_history for insert
to anon, authenticated
with check (true);

create policy "Public can delete sounding history"
on public.sounding_history for delete
to anon, authenticated
using (true);

create index if not exists sounding_history_date_idx on public.sounding_history(date desc);
create index if not exists sounding_history_tank_idx on public.sounding_history(tank);
