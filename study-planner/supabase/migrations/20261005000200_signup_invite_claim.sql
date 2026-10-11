create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_name text;
  invite_code text;
  invite public.advisor_invites%rowtype;
begin
  safe_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'دانش‌آموز');
  invite_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'advisor_invite', '')));

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
      'plan', '[]'::jsonb,
      'advisorNotes', '[]'::jsonb,
      'advisorPlanStatus', 'draft'
    )
  )
  on conflict (owner_id) do nothing;

  if invite_code <> '' then
    select * into invite
    from public.advisor_invites
    where token = invite_code
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
    values (invite.advisor_id, new.id, 'active')
    on conflict (advisor_id, student_id) do update set status = 'active';

    update public.advisor_invites
    set redeemed_by = new.id
    where id = invite.id;
  end if;

  return new;
end;
$$;
