-- Kod Quiz Fabrikası · Supabase şeması
-- Supabase → SQL Editor → bu dosyanın tamamını yapıştır → Run.
-- EN ALTTAKİ e-posta satırını kendi giriş e-postanla değiştirmeyi unutma!

create extension if not exists pgcrypto;

-- Panele girebilecek kişiler
create table if not exists admins (email text primary key);

create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- Soru havuzu
create table if not exists questions (
  id text primary key,
  lang text not null check (lang in ('python', 'web', 'rust', 'arduino')),
  data jsonb not null,
  source text not null default 'panel',          -- banka | panel
  verified boolean not null default false,       -- banka soruları çalıştırılarak doğrulanmıştır
  active boolean not null default true,
  used_count int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

-- Paylaşımlar (takvim)
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references questions(id) on delete restrict,
  scheduled_at timestamptz not null,
  status text not null default 'planned'
    check (status in ('planned', 'rendering', 'ready', 'publishing', 'published', 'failed', 'canceled')),
  source text not null default 'manual',          -- manual | autopilot
  approved boolean not null default true,
  seed int,
  no int,
  director jsonb,
  video_path text,
  video_url text,
  caption text,
  caption_locked boolean not null default false,  -- panelden elle düzenlendiyse işçi üzerine yazmaz
  attempts int not null default 0,
  ig_container_id text,
  ig_media_id text,
  ig_permalink text,
  error text,
  rendered_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_sched on posts (scheduled_at);
create index if not exists posts_status on posts (status);

create or replace function touch_updated() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists posts_touch on posts;
create trigger posts_touch before update on posts for each row execute function touch_updated();

-- Otopilot (tek satır)
create table if not exists autopilot (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,
  until date,
  times text[] not null default '{19:00}',
  days int[] not null default '{0,1,2,3,4,5,6}',   -- 0 = Pazar
  langs text[] not null default '{python,web,rust,arduino}',
  require_approval boolean not null default false,
  horizon_hours int not null default 48,
  tz text not null default 'Europe/Istanbul',
  updated_at timestamptz not null default now()
);
insert into autopilot (id) values (1) on conflict do nothing;

-- Genel ayarlar
create table if not exists settings (key text primary key, value jsonb not null);
insert into settings (key, value) values
  ('brand', '"CODECARAVAN"'),
  ('badge', '"GÜNÜN SORUSU"'),
  ('no_offset', '0'),
  ('hashtags', '{
    "ortak": ["#yazılım", "#kodlama", "#programlama", "#yazılımcı", "#coding", "#programming", "#developer", "#kodquiz", "#codecaravan", "#bilgisayarmühendisliği"],
    "python": ["#python", "#pythonprogramming", "#pythontr", "#pythonöğren"],
    "web": ["#javascript", "#webdeveloper", "#frontend", "#css", "#html", "#webtasarım"],
    "rust": ["#rust", "#rustlang", "#rustprogramming", "#systemsprogramming"],
    "arduino": ["#arduino", "#elektronik", "#robotik", "#arduinoproject", "#gömülüsistemler"]
  }')
on conflict do nothing;

-- İşçi kayıtları
create table if not exists logs (
  id bigserial primary key,
  at timestamptz not null default now(),
  level text not null default 'info',
  msg text not null,
  post_id uuid
);
create index if not exists logs_at on logs (at desc);

-- Gizli değerler (yalnızca işçi okur; panel göremez)
create table if not exists secrets (key text primary key, value text not null, updated_at timestamptz not null default now());

-- Güvenlik (RLS)
alter table admins enable row level security;
alter table questions enable row level security;
alter table posts enable row level security;
alter table autopilot enable row level security;
alter table settings enable row level security;
alter table logs enable row level security;
alter table secrets enable row level security;  -- politika yok = sadece service_role

drop policy if exists admin_all on questions; create policy admin_all on questions for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists admin_all on posts;     create policy admin_all on posts     for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists admin_all on autopilot; create policy admin_all on autopilot for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists admin_all on settings;  create policy admin_all on settings  for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists admin_read on logs;     create policy admin_read on logs     for select to authenticated using (is_admin());
drop policy if exists admin_self on admins;   create policy admin_self on admins   for select to authenticated using (is_admin());

-- Video deposu (herkese açık okuma: Instagram videoyu bu linkten çeker)
insert into storage.buckets (id, name, public) values ('videos', 'videos', true) on conflict (id) do nothing;

-- ⚠️ BURAYI DEĞİŞTİR: panele giriş yapacağın e-posta
insert into admins (email) values ('SENIN-EPOSTAN@ornek.com') on conflict do nothing;
