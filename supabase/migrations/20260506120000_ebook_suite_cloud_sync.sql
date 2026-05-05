-- Allow cloud library sync for Basic (ebook_suite tier, not only Pro).
-- Safe if 20260505120000_user_entitlements.sql already applied with Pro-only policies.

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
