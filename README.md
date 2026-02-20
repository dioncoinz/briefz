# Breifz MVP

Breifz is a Next.js + Supabase app for project-based supervisor handovers and prestart meetings.

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
  - photo uploads to Supabase Storage bucket `breifz-photos`
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
- `/api/projects/[projectId]/archive`
- `/api/archive/[projectId]/export?format=json`

## Supabase setup

1. Set env vars in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

2. Run SQL in Supabase SQL editor:

- `supabase/mvp_schema.sql`

This creates:

- `tenants`, `profiles`, `projects`, `handovers`, `handover_photos`, `prestarts`
- template tables for phase 2 (`templates`, `template_entries`)
- RLS tenant-scoped policies
- storage bucket and policies for `breifz-photos`

## Dev

```bash
npm run dev
npm run lint
npm run build
```