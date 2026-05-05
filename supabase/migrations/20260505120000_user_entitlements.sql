-- Inkwell licensing: per-user tier (free / ebook_suite / pro) + cloud library sync for Ebook Suite and Pro.
-- Apply via Supabase SQL editor or `supabase db push`.

-- ---------------------------------------------------------------------------
-- Entitlements (updated by Paddle webhook Edge Function using service role)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'ebook_suite', 'pro')),
  source text NOT NULL DEFAULT 'default',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  paddle_customer_id text,
  paddle_subscription_id text,
  paddle_transaction_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_entitlements_tier_status_idx
  ON public.user_entitlements (tier, status);

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read only their own row (never write — webhook uses service role).
CREATE POLICY "user_entitlements_select_own"
  ON public.user_entitlements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Expose via Data API when project uses default settings; explicit grant for older projects.
GRANT SELECT ON public.user_entitlements TO authenticated;

-- ---------------------------------------------------------------------------
-- New signups: default Free tier
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inkwell_on_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_entitlements (user_id, tier, source, status)
  VALUES (NEW.id, 'free', 'signup', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_entitlements ON auth.users;
CREATE TRIGGER on_auth_user_created_entitlements
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.inkwell_on_auth_user_created();

REVOKE ALL ON FUNCTION public.inkwell_on_auth_user_created() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Backfill existing users + grandfather anyone who already has cloud library head
-- ---------------------------------------------------------------------------
INSERT INTO public.user_entitlements (user_id, tier, source, status)
SELECT u.id, 'free', 'migration', 'active'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_entitlements e WHERE e.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.user_entitlements ue
SET
  tier = 'pro',
  source = 'grandfather_cloud_user',
  updated_at = now()
FROM public.library_heads lh
WHERE ue.user_id = lh.user_id
  AND ue.tier = 'free';

-- ---------------------------------------------------------------------------
-- Cloud sync (library_heads + Storage): Ebook Suite or Pro
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "library_heads_select_own" ON public.library_heads;
DROP POLICY IF EXISTS "library_heads_insert_own" ON public.library_heads;
DROP POLICY IF EXISTS "library_heads_update_own" ON public.library_heads;

CREATE POLICY "library_heads_select_own"
  ON public.library_heads FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.user_entitlements e
      WHERE e.user_id = auth.uid()
        AND e.tier IN ('ebook_suite', 'pro')
        AND e.status = 'active'
    )
  );

CREATE POLICY "library_heads_insert_own"
  ON public.library_heads FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.user_entitlements e
      WHERE e.user_id = auth.uid()
        AND e.tier IN ('ebook_suite', 'pro')
        AND e.status = 'active'
    )
  );

CREATE POLICY "library_heads_update_own"
  ON public.library_heads FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.user_entitlements e
      WHERE e.user_id = auth.uid()
        AND e.tier IN ('ebook_suite', 'pro')
        AND e.status = 'active'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.user_entitlements e
      WHERE e.user_id = auth.uid()
        AND e.tier IN ('ebook_suite', 'pro')
        AND e.status = 'active'
    )
  );

DROP POLICY IF EXISTS "libraries_select_own" ON storage.objects;
DROP POLICY IF EXISTS "libraries_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "libraries_update_own" ON storage.objects;
DROP POLICY IF EXISTS "libraries_delete_own" ON storage.objects;

CREATE POLICY "libraries_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'libraries'
    AND name LIKE (auth.uid()::text || '/%')
    AND EXISTS (
      SELECT 1
      FROM public.user_entitlements e
      WHERE e.user_id = auth.uid()
        AND e.tier IN ('ebook_suite', 'pro')
        AND e.status = 'active'
    )
  );

CREATE POLICY "libraries_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'libraries'
    AND name LIKE (auth.uid()::text || '/%')
    AND EXISTS (
      SELECT 1
      FROM public.user_entitlements e
      WHERE e.user_id = auth.uid()
        AND e.tier IN ('ebook_suite', 'pro')
        AND e.status = 'active'
    )
  );

CREATE POLICY "libraries_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'libraries'
    AND name LIKE (auth.uid()::text || '/%')
    AND EXISTS (
      SELECT 1
      FROM public.user_entitlements e
      WHERE e.user_id = auth.uid()
        AND e.tier IN ('ebook_suite', 'pro')
        AND e.status = 'active'
    )
  )
  WITH CHECK (
    bucket_id = 'libraries'
    AND name LIKE (auth.uid()::text || '/%')
    AND EXISTS (
      SELECT 1
      FROM public.user_entitlements e
      WHERE e.user_id = auth.uid()
        AND e.tier IN ('ebook_suite', 'pro')
        AND e.status = 'active'
    )
  );

CREATE POLICY "libraries_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'libraries'
    AND name LIKE (auth.uid()::text || '/%')
    AND EXISTS (
      SELECT 1
      FROM public.user_entitlements e
      WHERE e.user_id = auth.uid()
        AND e.tier IN ('ebook_suite', 'pro')
        AND e.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- RPC: require Ebook Suite or Pro inside commit functions (defense in depth)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inkwell_commit_library_push(p_base_rev bigint, p_storage_path text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current bigint;
  v_new bigint;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_entitlements e
    WHERE e.user_id = v_uid
      AND e.tier IN ('ebook_suite', 'pro')
      AND e.status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sync_not_entitled');
  END IF;

  IF p_storage_path IS NULL OR length(trim(p_storage_path)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_path');
  END IF;

  IF strpos(p_storage_path, v_uid::text || '/') <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_path');
  END IF;

  SELECT lh.remote_rev INTO v_current
  FROM public.library_heads lh
  WHERE lh.user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_base_rev IS NOT NULL AND p_base_rev <> 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'conflict', 'server_rev', to_jsonb(0::bigint));
    END IF;

    INSERT INTO public.library_heads (user_id, remote_rev, storage_object_path, updated_at)
    VALUES (v_uid, 1, p_storage_path, now());

    RETURN jsonb_build_object('ok', true, 'remote_rev', to_jsonb(1::bigint));
  END IF;

  IF v_current <> coalesce(p_base_rev, 0) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'conflict',
      'server_rev', to_jsonb(v_current)
    );
  END IF;

  v_new := v_current + 1;

  UPDATE public.library_heads
  SET remote_rev = v_new,
      storage_object_path = p_storage_path,
      updated_at = now()
  WHERE user_id = v_uid;

  RETURN jsonb_build_object('ok', true, 'remote_rev', to_jsonb(v_new));
END;
$$;

CREATE OR REPLACE FUNCTION public.inkwell_force_commit_library_push(p_storage_path text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_new bigint;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_entitlements e
    WHERE e.user_id = v_uid
      AND e.tier IN ('ebook_suite', 'pro')
      AND e.status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sync_not_entitled');
  END IF;

  IF p_storage_path IS NULL OR length(trim(p_storage_path)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_path');
  END IF;

  IF strpos(p_storage_path, v_uid::text || '/') <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_path');
  END IF;

  INSERT INTO public.library_heads (user_id, remote_rev, storage_object_path, updated_at)
  VALUES (v_uid, 1, p_storage_path, now())
  ON CONFLICT (user_id) DO UPDATE
  SET remote_rev = public.library_heads.remote_rev + 1,
      storage_object_path = EXCLUDED.storage_object_path,
      updated_at = now()
  RETURNING remote_rev INTO v_new;

  RETURN jsonb_build_object('ok', true, 'remote_rev', to_jsonb(v_new));
END;
$$;
