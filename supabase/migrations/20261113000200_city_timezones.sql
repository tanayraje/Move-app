-- NOT YET APPLIED. Review, then run once in the Supabase SQL editor.
--
-- Remembers the time zone of each place name used on a timeline, so the
-- notify-next function looks each place up once instead of every minute.
-- Only the function (service role) reads or writes it.

create table if not exists public.city_timezones (
  name text primary key,          -- lower-cased place name, e.g. "singapore"
  tz text,                        -- IANA zone, e.g. "Asia/Singapore"; null = looked up, not found
  checked_at timestamptz not null default now()
);
alter table public.city_timezones enable row level security;
revoke all on public.city_timezones from anon, authenticated;
