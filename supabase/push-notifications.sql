-- Next-item push notifications (already applied to the Move project).
-- Secret values (VAPID keys, cron secret) live in public.app_secrets and are not kept in the repo.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  tz text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_subs_select on public.push_subscriptions for select using (user_id = auth.uid());
create policy push_subs_delete on public.push_subscriptions for delete using (user_id = auth.uid());

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_tz text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into push_subscriptions(endpoint, user_id, p256dh, auth, tz)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, coalesce(nullif(p_tz,''),'Asia/Kolkata'))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, tz = excluded.tz;
end $$;
revoke all on function public.save_push_subscription(text,text,text,text) from public, anon;
grant execute on function public.save_push_subscription(text,text,text,text) to authenticated;

create table if not exists public.push_sent (
  item_id text not null,
  user_id uuid not null,
  fire_at timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (item_id, user_id, fire_at)
);
alter table public.push_sent enable row level security;

create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
revoke all on public.push_sent from anon, authenticated;
-- insert into public.app_secrets(name, value) values ('vapid_public', '...'), ('vapid_private', '...'), ('cron_secret', '...');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('move-notify-next', '* * * * *', $cron$
  select net.http_post(
    url := 'https://bjjmqevraxdjzbgtuugu.supabase.co/functions/v1/notify-next',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select value from public.app_secrets where name='cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$cron$);
