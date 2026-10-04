create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'دانش‌آموز',
  role text not null default 'student' check (role in ('student', 'advisor')),
  created_at timestamptz not null default now()
);

create table if not exists public.student_workspaces (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.advisor_students (
  advisor_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now(),
  primary key (advisor_id, student_id),
  check (advisor_id <> student_id)
);

create unique index if not exists advisor_students_one_active_advisor_per_student
  on public.advisor_students(student_id)
  where status = 'active';

create index if not exists advisor_students_advisor_active_idx
  on public.advisor_students(advisor_id, student_id)
  where status = 'active';

create table if not exists public.advisor_invites (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  redeemed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists advisor_invites_advisor_idx
  on public.advisor_invites(advisor_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_name text;
begin
  safe_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'دانش‌آموز');

  insert into public.profiles (id, display_name, role)
  values (new.id, safe_name, 'student')
  on conflict (id) do nothing;

  insert into public.student_workspaces (owner_id, data)
  values (
    new.id,
    jsonb_build_object(
      'version', 1,
      'name', safe_name,
      'weeklyGoalMinutes', 480,
      'focusMinutes', 25,
      'breakMinutes', 5,
      'subjects', '[]'::jsonb,
      'sessions', '[]'::jsonb,
      'tasks', '[]'::jsonb,
      'plan', '[]'::jsonb
    )
  )
  on conflict (owner_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_study_planner on auth.users;
create trigger on_auth_user_created_study_planner
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.app_role(user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = user_id
$$;

create or replace function public.is_active_advisor_for(student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.advisor_students relation
    where relation.advisor_id = auth.uid()
      and relation.student_id = student
      and relation.status = 'active'
  )
$$;

create or replace function public.guard_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.role() <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Only an administrator may change account roles';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role_change on public.profiles;
create trigger guard_profile_role_change
before update on public.profiles
for each row execute procedure public.guard_profile_role();

create or replace function public.has_active_student_advisor(student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.advisor_students relation
    where relation.student_id = student and relation.status = 'active'
  )
$$;

create or replace function public.guard_student_workspace_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Workspace ownership cannot be changed';
  end if;

  actor_role := public.app_role(auth.uid());

  if auth.uid() = old.owner_id then
    if public.has_active_student_advisor(old.owner_id)
       and (
         new.data -> 'plan' is distinct from old.data -> 'plan'
         or new.data -> 'subjects' is distinct from old.data -> 'subjects'
       ) then
      raise exception 'A student with an advisor cannot edit the assigned plan or subjects';
    end if;
    return new;
  end if;

  if actor_role = 'advisor' and public.is_active_advisor_for(old.owner_id) then
    if (new.data - 'plan' - 'subjects' - 'weeklyGoalMinutes') is distinct from (old.data - 'plan' - 'subjects' - 'weeklyGoalMinutes') then
      raise exception 'Advisors may only edit the assigned plan and subjects';
    end if;
    return new;
  end if;

  raise exception 'Not authorized to update this workspace';
end;
$$;

drop trigger if exists guard_student_workspace_update on public.student_workspaces;
create trigger guard_student_workspace_update
before update on public.student_workspaces
for each row execute procedure public.guard_student_workspace_update();

create or replace function public.claim_advisor_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.advisor_invites%rowtype;
begin
  if auth.uid() is null or public.app_role(auth.uid()) <> 'student' then
    raise exception 'Only a signed-in student can accept an advisor invitation';
  end if;

  if public.has_active_student_advisor(auth.uid()) then
    raise exception 'This student already has an active advisor';
  end if;

  select * into invite
  from public.advisor_invites
  where token = upper(trim(invite_code))
    and redeemed_by is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invitation is invalid, expired, or already used';
  end if;

  if public.app_role(invite.advisor_id) <> 'advisor' then
    raise exception 'Invitation owner is not an advisor';
  end if;

  insert into public.advisor_students (advisor_id, student_id, status)
  values (invite.advisor_id, auth.uid(), 'active');

  update public.advisor_invites set redeemed_by = auth.uid() where id = invite.id;
  return invite.advisor_id;
end;
$$;

create or replace function public.save_linked_student_progress(workspace_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or public.app_role(auth.uid()) <> 'student'
     or not public.has_active_student_advisor(auth.uid()) then
    raise exception 'Only a student with an active advisor can use this operation';
  end if;

  if coalesce(jsonb_typeof(workspace_data), '') <> 'object' then
    raise exception 'Student workspace data must be an object';
  end if;

  update public.student_workspaces
  set data = data || jsonb_build_object(
    'name', coalesce(workspace_data -> 'name', data -> 'name'),
    'focusMinutes', coalesce(workspace_data -> 'focusMinutes', data -> 'focusMinutes'),
    'breakMinutes', coalesce(workspace_data -> 'breakMinutes', data -> 'breakMinutes'),
    'sessions', coalesce(workspace_data -> 'sessions', data -> 'sessions'),
    'tasks', coalesce((
      select jsonb_agg(
        existing.task || jsonb_build_object(
          'done', coalesce(
            (
              select case
                when jsonb_typeof(submitted.task -> 'done') = 'boolean' then submitted.task -> 'done'
                else null
              end
              from jsonb_array_elements(coalesce(workspace_data -> 'tasks', '[]'::jsonb)) as submitted(task)
              where submitted.task ->> 'id' = existing.task ->> 'id'
              limit 1
            ),
            existing.task -> 'done',
            'false'::jsonb
          )
        )
      )
      from jsonb_array_elements(coalesce(data -> 'tasks', '[]'::jsonb)) as existing(task)
    ), data -> 'tasks')
  ), updated_at = now()
  where owner_id = auth.uid();

  if not found then raise exception 'Student workspace was not found'; end if;

  update public.profiles
  set display_name = coalesce(nullif(trim(workspace_data ->> 'name'), ''), display_name)
  where id = auth.uid();
end;
$$;

create or replace function public.save_advisor_plan(
  student_id uuid,
  plan_data jsonb,
  subjects_data jsonb,
  weekly_goal_minutes integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or public.app_role(auth.uid()) <> 'advisor'
     or not public.is_active_advisor_for(student_id) then
    raise exception 'Advisor is not linked to this student';
  end if;

  if coalesce(jsonb_typeof(plan_data), '') <> 'array'
     or coalesce(jsonb_typeof(subjects_data), '') <> 'array'
    or weekly_goal_minutes is null
    or weekly_goal_minutes < 0 then
    raise exception 'Plan and subjects must be arrays';
  end if;

  update public.student_workspaces
  set data = data || jsonb_build_object(
        'plan', plan_data,
        'subjects', subjects_data,
        'weeklyGoalMinutes', weekly_goal_minutes
      ),
      updated_at = now()
  where owner_id = student_id;

  if not found then raise exception 'Student workspace was not found'; end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.student_workspaces enable row level security;
alter table public.advisor_students enable row level security;
alter table public.advisor_invites enable row level security;

create policy "profiles_read_self_or_advisor"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or public.is_active_advisor_for(id)
    or exists (
      select 1 from public.advisor_students relation
      where relation.student_id = auth.uid()
        and relation.advisor_id = id
        and relation.status = 'active'
    )
  );

create policy "profiles_update_self_display_name"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "workspace_read_owner_or_advisor"
  on public.student_workspaces for select to authenticated
  using (owner_id = auth.uid() or public.is_active_advisor_for(owner_id));

create policy "workspace_update_owner_or_linked_advisor"
  on public.student_workspaces for update to authenticated
  using (
    owner_id = auth.uid()
    or (public.app_role(auth.uid()) = 'advisor' and public.is_active_advisor_for(owner_id))
  )
  with check (
    owner_id = auth.uid()
    or (public.app_role(auth.uid()) = 'advisor' and public.is_active_advisor_for(owner_id))
  );

create policy "advisor_students_read_participants"
  on public.advisor_students for select to authenticated
  using (advisor_id = auth.uid() or student_id = auth.uid());

create policy "advisor_invites_read_own"
  on public.advisor_invites for select to authenticated
  using (advisor_id = auth.uid() and public.app_role(auth.uid()) = 'advisor');

create policy "advisor_invites_create_own"
  on public.advisor_invites for insert to authenticated
  with check (advisor_id = auth.uid() and public.app_role(auth.uid()) = 'advisor');

grant select, update on public.profiles to authenticated;
grant select, update on public.student_workspaces to authenticated;
grant select on public.advisor_students to authenticated;
grant select, insert on public.advisor_invites to authenticated;
grant execute on function public.claim_advisor_invite(text) to authenticated;
grant execute on function public.save_linked_student_progress(jsonb) to authenticated;
grant execute on function public.save_advisor_plan(uuid, jsonb, jsonb, integer) to authenticated;
grant execute on function public.app_role(uuid) to authenticated;
grant execute on function public.is_active_advisor_for(uuid) to authenticated;
grant execute on function public.has_active_student_advisor(uuid) to authenticated;

revoke all on function public.claim_advisor_invite(text) from public, anon;
revoke all on function public.save_linked_student_progress(jsonb) from public, anon;
revoke all on function public.save_advisor_plan(uuid, jsonb, jsonb, integer) from public, anon;
revoke all on function public.app_role(uuid) from public, anon;
revoke all on function public.is_active_advisor_for(uuid) from public, anon;
revoke all on function public.has_active_student_advisor(uuid) from public, anon;
grant execute on function public.claim_advisor_invite(text) to authenticated;
grant execute on function public.save_linked_student_progress(jsonb) to authenticated;
grant execute on function public.save_advisor_plan(uuid, jsonb, jsonb, integer) to authenticated;
grant execute on function public.app_role(uuid) to authenticated;
grant execute on function public.is_active_advisor_for(uuid) to authenticated;
grant execute on function public.has_active_student_advisor(uuid) to authenticated;
