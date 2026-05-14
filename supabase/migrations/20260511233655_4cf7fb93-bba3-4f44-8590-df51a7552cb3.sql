
-- ============ ENUMS ============
create type public.app_role as enum ('admin', 'operator');

-- ============ ROLES TABLE (separate, secure) ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'operator',
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = 'admin')
$$;

create policy "users see own roles" on public.user_roles for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "admins manage roles" on public.user_roles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ============ USERS PROFILE ============
create table public.users_profile (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.users_profile enable row level security;

create policy "users read own profile, admin all" on public.users_profile for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "users update own profile" on public.users_profile for update using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "admin insert profile" on public.users_profile for insert with check (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "admin delete profile" on public.users_profile for delete using (public.is_admin(auth.uid()));

-- ============ TELEGRAM CONFIG ============
create table public.telegram_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bot_token text not null,
  channel_id text not null,
  channel_name text default '',
  bot_username text default '',
  is_connected boolean not null default false,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.telegram_configs enable row level security;

create policy "tg own or admin select" on public.telegram_configs for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "tg own insert" on public.telegram_configs for insert with check (auth.uid() = user_id);
create policy "tg own update" on public.telegram_configs for update using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "tg own delete" on public.telegram_configs for delete using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- ============ POSTS ============
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  image_url text,
  caption text not null default '',
  status text not null default 'draft',
  telegram_message_id bigint,
  telegram_chat_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.posts enable row level security;

create policy "posts own or admin select" on public.posts for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "posts own insert" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts own update" on public.posts for update using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "posts own delete" on public.posts for delete using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- ============ POST BUTTONS ============
create table public.post_buttons (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  button_text text not null,
  button_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.post_buttons enable row level security;

create policy "buttons read by post owner or admin" on public.post_buttons for select using (
  exists (select 1 from public.posts p where p.id = post_id and (p.user_id = auth.uid() or public.is_admin(auth.uid())))
);
create policy "buttons write by post owner or admin" on public.post_buttons for all using (
  exists (select 1 from public.posts p where p.id = post_id and (p.user_id = auth.uid() or public.is_admin(auth.uid())))
) with check (
  exists (select 1 from public.posts p where p.id = post_id and (p.user_id = auth.uid() or public.is_admin(auth.uid())))
);

-- ============ SCHEDULES ============
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz not null,
  repeat_type text not null default 'none',
  status text not null default 'pending',
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.schedules enable row level security;

create policy "sched own or admin select" on public.schedules for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "sched own insert" on public.schedules for insert with check (auth.uid() = user_id);
create policy "sched own update" on public.schedules for update using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "sched own delete" on public.schedules for delete using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- ============ POSTING LOGS ============
create table public.posting_logs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  status text not null,
  message text,
  created_at timestamptz not null default now()
);
alter table public.posting_logs enable row level security;

create policy "plogs own or admin select" on public.posting_logs for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "plogs insert any auth" on public.posting_logs for insert with check (auth.uid() = user_id);

-- ============ DELETED POSTS HISTORY ============
create table public.deleted_posts_history (
  id uuid primary key default gen_random_uuid(),
  original_post_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  image_url text,
  caption text,
  buttons jsonb default '[]'::jsonb,
  deleted_reason text,
  deleted_at timestamptz not null default now(),
  restored boolean not null default false
);
alter table public.deleted_posts_history enable row level security;

create policy "trash own or admin select" on public.deleted_posts_history for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "trash own insert" on public.deleted_posts_history for insert with check (auth.uid() = user_id);
create policy "trash own update" on public.deleted_posts_history for update using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "trash own delete" on public.deleted_posts_history for delete using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- ============ ACTIVITY LOGS ============
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity text,
  entity_id text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.activity_logs enable row level security;

create policy "alogs own or admin select" on public.activity_logs for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "alogs own insert" on public.activity_logs for insert with check (auth.uid() = user_id);

-- ============ APP SETTINGS ============
create table public.app_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  app_name text not null default 'Telegram Auto Poster',
  posting_delay_ms integer not null default 0,
  auto_reconnect boolean not null default true,
  dark_mode boolean not null default true,
  default_channel text default '',
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

create policy "settings own select" on public.app_settings for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "settings own insert" on public.app_settings for insert with check (auth.uid() = user_id);
create policy "settings own update" on public.app_settings for update using (auth.uid() = user_id or public.is_admin(auth.uid()));

-- ============ HANDLE NEW USER ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_first boolean;
begin
  select not exists(select 1 from public.users_profile) into is_first;

  insert into public.users_profile (user_id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));

  insert into public.user_roles (user_id, role)
  values (new.id, case when is_first then 'admin'::app_role else 'operator'::app_role end);

  insert into public.app_settings (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ updated_at triggers ============
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_users_profile_updated before update on public.users_profile for each row execute function public.set_updated_at();
create trigger trg_telegram_configs_updated before update on public.telegram_configs for each row execute function public.set_updated_at();
create trigger trg_posts_updated before update on public.posts for each row execute function public.set_updated_at();
create trigger trg_app_settings_updated before update on public.app_settings for each row execute function public.set_updated_at();

-- ============ SOFT DELETE TRIGGER ON POSTS ============
create or replace function public.handle_post_soft_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  btns jsonb;
begin
  if new.status = 'deleted' and (old.status is distinct from 'deleted') then
    select coalesce(jsonb_agg(jsonb_build_object('text', button_text, 'url', button_url, 'sort_order', sort_order) order by sort_order), '[]'::jsonb)
      into btns from public.post_buttons where post_id = new.id;

    insert into public.deleted_posts_history (original_post_id, user_id, title, image_url, caption, buttons, deleted_reason)
    values (new.id, new.user_id, new.title, new.image_url, new.caption, btns, 'user_action');
  end if;
  return new;
end;
$$;

create trigger trg_posts_soft_delete after update on public.posts for each row execute function public.handle_post_soft_delete();

-- ============ STORAGE BUCKET ============
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true)
on conflict (id) do nothing;

create policy "post-images public read" on storage.objects for select using (bucket_id = 'post-images');
create policy "post-images auth upload" on storage.objects for insert with check (bucket_id = 'post-images' and auth.uid() is not null);
create policy "post-images owner update" on storage.objects for update using (bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "post-images owner delete" on storage.objects for delete using (bucket_id = 'post-images' and auth.uid()::text = (storage.foldername(name))[1]);
