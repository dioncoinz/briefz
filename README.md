# Briefz MVP

Briefz is a Next.js + Supabase app for project-based supervisor handovers and prestart meetings.

## Current MVP flow

- Email/password auth with Supabase
- `/projects` as post-login home
- Create project (`name`, `start_date`, `end_date`)
- Project detail with:
  - Supervisor Handover
  - Prestart Meeting
  - Archive action
- Supervisor handover form:
  - notes
  - photo uploads to Supabase Storage bucket `briefz-photos`
- Prestart page:
  - latest handovers from last 24h
  - handover summary + extra fields
- Archive:
  - archived list
  - per-project archive detail at `/archive/[projectId]`
  - JSON export endpoint for archived projects

## Route map

- `/login`
- `/projects`
- `/projects/new`
- `/projects/[projectId]`
- `/projects/[projectId]/handover`
- `/projects/[projectId]/prestart`
- `/archive`
- `/archive/[projectId]`
- `/admin/users`
- `/api/projects/[projectId]/archive`
- `/api/archive/[projectId]/export?format=json`

## Supabase setup

1. Set env vars in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

`SUPABASE_SERVICE_ROLE_KEY` is required for the admin users page (`/admin/users`) to create tenant users securely on the server.

2. Run SQL in Supabase SQL editor:

- `supabase/mvp_schema.sql`

This creates:

- `tenants`, `profiles`, `projects`, `handovers`, `handover_photos`, `prestarts`
- template tables for phase 2 (`templates`, `template_entries`)
- RLS tenant-scoped policies
- storage bucket and policies for `briefz-photos`

## GMRS deployment

Use a separate Supabase project for GMRS rather than reusing the existing Briefz project. That keeps auth users, storage, and tenant data isolated per client deployment.

1. Create a new Supabase project for GMRS.
2. In the new project, run `supabase/mvp_schema.sql`.
3. Copy the new project's values into your deployment env vars:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<gmrs-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<gmrs-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<gmrs-service-role-key>
```

4. Create a separate Vercel project for the GMRS deployment and add the same three env vars there.
5. Deploy from the `client-gmrs` branch if you want a dedicated branch-to-project mapping, or from `main` if GMRS is now your primary deploy target.

The tracked app branding is already `Briefz`, so the remaining rename work is mainly repository/folder naming and the names you choose for the Supabase and Vercel projects.

## Dev

```bash
npm run dev
npm run lint
npm run build
```
