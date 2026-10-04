# Supabase setup

The app keeps guest data in browser local storage. Cloud accounts use Supabase Auth and the `student_workspaces` table.

## Create the cloud backend

1. Create a Supabase project.
2. In the Supabase SQL Editor, run `migrations/20261004000100_roles_workspaces.sql`.
3. In Supabase Authentication settings, configure email confirmation and the allowed redirect URLs for local and production deployments.
4. Copy `.env.example` to `.env.local` in the repository root. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project's API settings. The publishable/anon key is intended for the browser; never put a service-role key in a `VITE_` variable.
5. Restart Vite after changing `.env.local`.

## Provision an advisor

Self-registration creates student accounts only. To authorize an advisor, first register their email as a student account, then run this statement in the Supabase SQL Editor using the exact email:

```sql
update public.profiles
set role = 'advisor'
where id = (select id from auth.users where email = 'advisor@example.com');
```

The SQL migration protects role changes from normal client sessions. Advisor invitations expire after seven days and can be claimed once. A student can have at most one active advisor.

## Access rules

- Guest mode does not call Supabase and remains local to the device.
- Students can edit their workspace when independent.
- A linked student can update study sessions and task completion, but the database trigger blocks edits to the advisor-owned plan and subject list.
- Advisors can read linked students' workspaces and change only `plan` and `subjects` in them.
- Relationship creation is only available through the `claim_advisor_invite` RPC.

For production, configure email verification, password recovery, redirect URLs, backups, and an admin-controlled advisor provisioning process before inviting real users.
