-- Inkwell library sync: metadata row + Storage bucket + RPC for optimistic concurrency.
-- Apply in Supabase SQL editor or via `supabase db push` after linking the project.
--
-- Policies use DROP IF EXISTS so this script is safe to re-run once. If you already applied
-- `20260505120000_user_entitlements.sql` / `20260506120000_ebook_suite_cloud_sync.sql`, those
-- migrations replaced library/storage policies with tier-aware rules — re-run those files after
-- this one if you ever need to replay this migration alone.

-- ---------------------------------------------------------------------------
-- Library head (one row per authenticated user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.library_heads (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  remote_rev bigint NOT NULL DEFAULT 0,
  storage_object_path text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS library_heads_updated_at_idx ON public.library_heads (updated_at DESC);

ALTER TABLE public.library_heads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "library_heads_select_own" ON public.library_heads;
DROP POLICY IF EXISTS "library_heads_insert_own" ON public.library_heads;
DROP POLICY IF EXISTS "library_heads_update_own" ON public.library_heads;

CREATE POLICY "library_heads_select_own"
  ON public.library_heads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "library_heads_insert_own"
  ON public.library_heads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "library_heads_update_own"
  ON public.library_heads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Private Storage bucket for per-user library zips (object key: {user_id}/...)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'libraries',
  'libraries',
  false,
  52428800,
  ARRAY['application/zip', 'application/octet-stream', 'application/x-zip-compressed']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: first path segment must equal auth.uid()
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
  );

CREATE POLICY "libraries_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'libraries'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "libraries_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'libraries'
    AND name LIKE (auth.uid()::text || '/%')
  )
  WITH CHECK (
    bucket_id = 'libraries'
    AND name LIKE (auth.uid()::text || '/%')
  );

CREATE POLICY "libraries_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'libraries'
    AND name LIKE (auth.uid()::text || '/%')
  );

-- ---------------------------------------------------------------------------
-- RPC: commit pointer after client uploads a new zip to Storage
-- p_base_rev must match current remote_rev (0 / null treated as 0 for empty server).
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

REVOKE ALL ON FUNCTION public.inkwell_commit_library_push(bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inkwell_commit_library_push(bigint, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: force new revision after user resolves conflict ("keep this device")
-- ---------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.inkwell_force_commit_library_push(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.inkwell_force_commit_library_push(text) TO authenticated;
