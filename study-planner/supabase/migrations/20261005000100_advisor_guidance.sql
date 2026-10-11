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
         or new.data -> 'advisorNotes' is distinct from old.data -> 'advisorNotes'
         or new.data -> 'advisorPlanStatus' is distinct from old.data -> 'advisorPlanStatus'
         or new.data -> 'advisorPlanApprovedAt' is distinct from old.data -> 'advisorPlanApprovedAt'
       ) then
      raise exception 'A student with an advisor cannot edit the assigned plan, subjects, or advisor guidance';
    end if;
    return new;
  end if;

  if actor_role = 'advisor' and public.is_active_advisor_for(old.owner_id) then
    if (new.data - 'plan' - 'subjects' - 'weeklyGoalMinutes' - 'advisorNotes' - 'advisorPlanStatus' - 'advisorPlanApprovedAt')
       is distinct from
       (old.data - 'plan' - 'subjects' - 'weeklyGoalMinutes' - 'advisorNotes' - 'advisorPlanStatus' - 'advisorPlanApprovedAt') then
      raise exception 'Advisors may only edit the assigned plan, subjects, and guidance';
    end if;
    return new;
  end if;

  raise exception 'Not authorized to update this workspace';
end;
$$;

create or replace function public.save_advisor_guidance(
  student_id uuid,
  notes_data jsonb,
  plan_status text,
  approved_at text
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

  if coalesce(jsonb_typeof(notes_data), '') <> 'array'
     or plan_status not in ('draft', 'approved', 'needs_changes') then
    raise exception 'Advisor guidance payload is invalid';
  end if;

  update public.student_workspaces
  set data = data || jsonb_strip_nulls(jsonb_build_object(
        'advisorNotes', notes_data,
        'advisorPlanStatus', plan_status,
        'advisorPlanApprovedAt', approved_at
      )),
      updated_at = now()
  where owner_id = student_id;

  if not found then raise exception 'Student workspace was not found'; end if;
end;
$$;

grant execute on function public.save_advisor_guidance(uuid, jsonb, text, text) to authenticated;
revoke all on function public.save_advisor_guidance(uuid, jsonb, text, text) from public, anon;
