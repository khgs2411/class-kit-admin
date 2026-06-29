# ClassKit Admin

Vite app for developing, smoke-testing, and deploying the ClassKit admin control panel.

The demo must consume the backend only through Supabase Auth and Edge Functions. Do not import files from `supabase/` or call product tables/RPCs directly from this app.

This app is an admin surface for managing Class Kit products. It is not itself a Class Kit product, and it does not own Supabase schema, migration, seed, or multi-product platform deployment policy.

## Configuration

Create `.env.local` from `.env.example` when local values differ.

```bash
VITE_SUPABASE_TARGET=local

VITE_LOCAL_SUPABASE_URL=http://127.0.0.1:54321
VITE_LOCAL_SUPABASE_PUBLISHABLE_KEY=<local publishable key from backend Supabase status>

VITE_REMOTE_SUPABASE_URL=https://xhkymcpkvekuvoxiucoe.supabase.co
VITE_REMOTE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_jy5FhtJQh4mHLDrRMJ-JgQ_RxHSF1wm
VITE_AUTH_REDIRECT_URL=https://khgs2411.github.io/class-kit/
```

All values are browser-visible. Do not put service-role keys, access tokens, database passwords, or other secrets in this file.

`VITE_SUPABASE_TARGET` controls the backend used by the local Vite dev server:

- `local` connects to the local Supabase stack.
- `remote` connects to the shared remote Supabase project.

Production builds always use the remote values. This keeps the GitHub Pages deployment pointed at the remote Supabase project even if a developer's local env defaults to `local`.

## Commands

- `npm run dev` starts this app.
- `npm run build` builds this app.
- `npm run preview` previews the built app.

Backend commands are owned by `class-kit-api/` and run against `class-kit-api/supabase/`.

## GitHub Pages

Production deploys from the public `class-kit-admin` repository to:

```text
https://khgs2411.github.io/class-kit-admin/
```

The GitHub Actions workflow builds with:

```env
VITE_BASE_PATH=/class-kit-admin/
VITE_SUPABASE_TARGET=remote
VITE_AUTH_REDIRECT_URL=https://khgs2411.github.io/class-kit-admin/
```

Because the SDK repository is private, the public admin repository needs a GitHub Actions secret named `CLASS_KIT_SDK_DEPLOY_KEY`. The value should be a private SSH key whose public key is registered on the private `class-kit-sdk` repo with read access.

The remote Supabase Auth redirect allow list must include:

```text
https://khgs2411.github.io/class-kit-admin/
```

## Local Backend Targets

Use the local target when changing the admin UI against local migrations, seed data, and local Edge Functions.

```bash
VITE_SUPABASE_TARGET=local
```

Use the remote target when checking the admin app against the deployed preprod backend.

```bash
VITE_SUPABASE_TARGET=remote
```

Changing the target requires restarting the Vite dev server because Vite reads env values at startup.

## Remote Supabase Local Development

For local development against the remote Supabase project, use the local dev-server URL:

```bash
VITE_SUPABASE_TARGET=remote
VITE_AUTH_REDIRECT_URL=http://localhost:5173
```

The redirect URL must also be present in the remote Supabase Auth redirect allow list.

## Product Key

Product identity is backend-owned. For local development, set `CLASS_KIT_LOCAL_PRODUCT_KEY=eden` in `class-kit-api/supabase/.env`, then restart Supabase from `class-kit-api/` with `npm run supabase:start` so the value is exported into the Edge runtime container.

## Validation

Use `npm run build`, `npm run build:demo`, and `npm run dev:demo` from `apps/`. The current first-pass demo validation covers Classes, Templates, Schedules, Users, and Memberships.

The demo adapter styles the current Frontend layer UI surface for Button/Input/Textarea/Label/Select/Checkbox/Message while keeping reusable package components Styleless.

## Seeded Users

Use these local-only accounts after the backend seed has been applied:

- `admin@admin.local` / `password`
- `eden@manager.local` / `password`

## Smoke Flow

Run this flow against the local backend and classify each item as `pass`, `blocked`, `pre-existing backend/business-rule limitation`, or `fixed in this chunk`.

1. Start the local Supabase stack from `class-kit-api/` and copy the publishable key into `.env.local`.
2. Start the demo with `npm run dev:demo`.
3. Signed out: load the app and confirm public classes load, or a clear empty/error state is shown.
   - Expected contract: `class-kit-product-context` returns the `eden` product with `product_user: null` before login. Supabase may send the anon/publishable key as an `Authorization` bearer on this request; that bearer is public configuration and must be treated as anonymous, not as an invalid user session.
4. Sign in as `eden@manager.local`; confirm product context loads for product `eden`, role `manager`, status `active`.
5. Sign out; confirm the session clears without refresh-token errors.
6. Sign in as `admin@admin.local`; confirm auth succeeds and product context either reflects global access or returns a clear backend response.
7. User workflow: load classes, register for a valid class when seed/current data supports it, cancel a registration before the product cancellation cutoff, then verify a live registration inside the cutoff still shows its status but displays cancellation-closed messaging instead of a working cancel action.
8. Manager class/schedule workflow: create or update a template, create a schedule, preview generation, generate classes, edit one generated class, cancel one generated class, list pending registrations, reject a pending registration where data supports it, then verify the rejected recovery controls can either approve the rejected registration or allow the user to re-register.
9. Manager membership/attendance workflow: list/create membership types, grant/upgrade/revoke membership stock where data supports it, open attendance for a generated class, start attendance, mark a row, add trial/walk-in attendees where supported, then complete attendance.
10. Run final static checks:
    - `npm run build` from `class-kit-sdk/`
    - `npm run build` from `apps/`

## Current Validation Notes

- Static package/playground builds are the minimum verification for this chunk when the local Supabase CLI is unavailable.
- Backend and manual browser smoke checks require the Supabase CLI and a running local stack. If those tools are missing in a worker environment, record the gap as `verification_environment` rather than changing product behavior speculatively.
- Signed-out playground load is expected to pass the public ClassKit product-context and public class-listing path without login. Auth-required manager/user mutation paths should still reject anonymous requests.
- No accepted product behavior limitations are documented for this final handoff. Treat new smoke failures as either environment blockers or defects to triage, not as silently accepted behavior.
