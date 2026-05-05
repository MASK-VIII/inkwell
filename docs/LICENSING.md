# Inkwell licensing (Supabase + Paddle)

## Tiers

| Tier        | EPUB | Full exports / DOCX / archives | Cloud library sync |
|------------|------|--------------------------------|--------------------|
| Free       | No   | No                             | No                 |
| Ebook Suite| Yes  | No                             | Yes                |
| Pro        | Yes  | Yes                            | Yes                |

Entitlements live in `public.user_entitlements` (see migrations `20260505120000_user_entitlements.sql` and `20260506120000_ebook_suite_cloud_sync.sql`).

## Database

- Apply migrations in `supabase/migrations/` (SQL editor or `supabase db push`).
- New auth users get `tier = free` via trigger on `auth.users`.
- Existing users with a `library_heads` row are grandfathered to **Pro** once (migration).

## Paddle webhook (Edge Function)

Deploy `supabase/functions/paddle-webhook`:

1. Set secrets: `PADDLE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`.
2. Set optional price ID lists (comma-separated): `PADDLE_PRICE_IDS_EBOOK`, `PADDLE_PRICE_IDS_PRO`, `PADDLE_PRICE_IDS_UPGRADE`.
3. Point Paddle’s notification destination at `https://<project-ref>.supabase.co/functions/v1/paddle-webhook`.

Checkout **must** include custom data so the webhook can set the correct user:

```json
{ "custom_data": { "inkwell_user_id": "<uuid from supabase auth>" } }
```

Use [Paddle signature verification](https://developer.paddle.com/webhooks/signature-verification) (implemented in the Edge Function).

## Frontend env (Vite)

Optional hosted checkout URLs (opened in a new tab):

- `VITE_PADDLE_CHECKOUT_EBOOK_SUITE`
- `VITE_PADDLE_CHECKOUT_PRO`
- `VITE_PADDLE_CHECKOUT_UPGRADE` ($99.99 Ebook → Pro)

The app appends `inkwell_user_id` when the user is signed in to cloud sync.

## Supabase walkthrough (what to do in the dashboard)

1. **Create / open your project** at [supabase.com](https://supabase.com) and note **Project URL** and **anon** / **publishable** key (Settings → API). Put them in your app as `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_ANON_KEY`) plus `VITE_INKWELL_CLOUD_SYNC=1` (see `docs/CLOUD_SYNC.md` if you use that flow).

2. **Run SQL migrations** so the database matches the repo:
   - **Option A — SQL Editor:** Open **SQL** → **New query**, paste the contents of `supabase/migrations/20260503120000_inkwell_library_sync.sql`, run it, then paste and run `20260505120000_user_entitlements.sql`, then `20260506120000_ebook_suite_cloud_sync.sql` (skip any file you already applied; the third file is safe to re-run and fixes Ebook Suite + cloud sync if you only ran the first entitlement migration).
   - **Option B — CLI:** `supabase link` to the project, then `supabase db push` from the repo root so all migrations apply in order.

3. **Data API / grants:** If `user_entitlements` queries fail with “permission denied” or the table is not exposed, in **Project Settings → Data API** ensure the `public` schema (or `user_entitlements`) is exposed, and keep **RLS enabled** on `user_entitlements` (migration already adds `GRANT SELECT` for `authenticated`).

4. **Auth:** Enable **Email** (or your chosen providers) under **Authentication → Providers**. Users must exist in **Auth → Users** for entitlements rows to match `user_id`.

5. **Edge Function (Paddle webhook):** In **Edge Functions**, deploy `paddle-webhook` from `supabase/functions/paddle-webhook/`. Under the function **Secrets**, set at least `PADDLE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the optional `PADDLE_PRICE_IDS_EBOOK`, `PADDLE_PRICE_IDS_PRO`, `PADDLE_PRICE_IDS_UPGRADE`. In Paddle, set the webhook URL to `https://<project-ref>.supabase.co/functions/v1/paddle-webhook`.

6. **Test entitlements:** In **Table Editor → `user_entitlements`**, confirm a row appears for a test user (`tier` = `free` after sign-up). Manually set `tier` to `ebook_suite` or `pro` to verify cloud sync and exports without waiting for Paddle.

## Verification checklist

1. Run migration on a staging project.
2. Confirm `user_entitlements` row exists after sign-up (`free`).
3. Sign in as Pro (or manually set `tier = pro`) and confirm cloud sync push/pull works.
4. Sign in as `ebook_suite` and confirm EPUB + cloud sync work; PDF and other Pro-only exports stay locked.
5. Send a sandbox webhook with a valid signature and confirm tier updates.
