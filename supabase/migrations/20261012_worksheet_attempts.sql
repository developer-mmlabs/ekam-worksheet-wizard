BEGIN;

ALTER TABLE public.worksheets
  ADD COLUMN IF NOT EXISTS attempt_id uuid,
  ADD COLUMN IF NOT EXISTS attempt_kind text,
  ADD COLUMN IF NOT EXISTS queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS run_id text,
  ADD COLUMN IF NOT EXISTS progress text,
  ADD COLUMN IF NOT EXISTS attempt_request jsonb;

-- Claim a slot transactionally. Repeated/concurrent requests share its active attempt.
CREATE OR REPLACE FUNCTION public.queue_worksheet_attempt(p_data jsonb, p_kind text, p_expected uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE w public.worksheets;
BEGIN
  IF p_kind NOT IN ('generate', 'pdf') THEN RAISE EXCEPTION 'Invalid attempt kind'; END IF;
  IF p_data->>'id' IS NOT NULL THEN
    SELECT * INTO STRICT w FROM worksheets WHERE id = (p_data->>'id')::uuid FOR UPDATE;
  ELSE
    -- A stable selection/slot lock also protects single-chapter first-time requests.
    PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws(':', p_data->>'school_id', p_data->>'chapter_id',
      p_data->>'chapter_ids', p_data->>'set_number'), 0));
    SELECT * INTO w FROM worksheets WHERE school_id = (p_data->>'school_id')::uuid
      AND chapter_id = (p_data->>'chapter_id')::uuid
      AND chapter_ids IS NOT DISTINCT FROM CASE WHEN jsonb_typeof(p_data->'chapter_ids') = 'array'
        THEN ARRAY(SELECT jsonb_array_elements_text(p_data->'chapter_ids'))::uuid[] ELSE NULL END
      AND set_number = (p_data->>'set_number')::integer
      ORDER BY is_finalized DESC, created_at DESC LIMIT 1 FOR UPDATE;
    IF w.id IS NULL THEN
      INSERT INTO worksheets (school_id, chapter_id, chapter_ids, set_number, status, questions_json)
      VALUES ((p_data->>'school_id')::uuid, (p_data->>'chapter_id')::uuid,
        CASE WHEN jsonb_typeof(p_data->'chapter_ids') = 'array' THEN
          ARRAY(SELECT jsonb_array_elements_text(p_data->'chapter_ids'))::uuid[] ELSE NULL END,
        (p_data->>'set_number')::integer, 'failed', COALESCE(p_data->'questions_json', '{}'::jsonb))
      RETURNING * INTO w;
    END IF;
  END IF;
  IF w.is_finalized THEN RAISE EXCEPTION 'Cannot replace a finalized worksheet'; END IF;
  IF w.status IN ('pending', 'processing') THEN
    RETURN jsonb_build_object('worksheet', to_jsonb(w), 'claimed', false);
  END IF;
  IF p_data->>'id' IS NOT NULL AND w.attempt_id IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'Worksheet changed. Refresh before retrying.';
  END IF;
  IF p_kind = 'pdf' AND (w.attempt_id IS DISTINCT FROM p_expected OR w.questions_json->'sections' IS NULL) THEN
    RAISE EXCEPTION 'Worksheet changed. Refresh before editing or retrying.';
  END IF;
  UPDATE worksheets SET attempt_id = gen_random_uuid(), attempt_kind = p_kind, status = 'pending',
    queued_at = now(), started_at = NULL, deadline_at = now() + interval '15 minutes',
    last_activity_at = now(), run_id = NULL, progress = 'Waiting for worker', error_message = NULL,
    questions_json = CASE WHEN p_kind = 'pdf' THEN COALESCE(p_data->'questions_json', w.questions_json) ELSE w.questions_json END,
    attempt_request = COALESCE(p_data->'attempt_request', w.attempt_request)
    WHERE id = w.id RETURNING * INTO w;
  RETURN jsonb_build_object('worksheet', to_jsonb(w), 'claimed', true);
END $$;

-- All worker updates are fenced by attempt ID, active status and server-side deadline.
CREATE OR REPLACE FUNCTION public.update_worksheet_attempt(p_id uuid, p_attempt uuid, p_action text, p_data jsonb DEFAULT '{}')
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE w public.worksheets;
BEGIN
  SELECT * INTO w FROM worksheets WHERE id = p_id FOR UPDATE;
  IF w.id IS NULL OR w.attempt_id IS DISTINCT FROM p_attempt OR p_attempt IS NULL
    OR w.status NOT IN ('pending', 'processing') OR w.deadline_at <= now() THEN RETURN false; END IF;
  IF p_action = 'start' THEN
    IF w.run_id IS NOT NULL AND w.run_id <> p_data->>'run_id' THEN RETURN false; END IF;
    UPDATE worksheets SET status = 'processing', started_at = COALESCE(started_at, now()),
      deadline_at = CASE WHEN started_at IS NULL THEN now() + interval '15 minutes' ELSE deadline_at END,
      run_id = p_data->>'run_id', last_activity_at = now(), progress = 'Loading source material' WHERE id = p_id;
  ELSIF p_action = 'progress' THEN
    UPDATE worksheets SET last_activity_at = now(), progress = p_data->>'progress' WHERE id = p_id;
  ELSIF p_action = 'complete' THEN
    UPDATE worksheets SET status = 'completed', progress = 'Completed', last_activity_at = now(), error_message = NULL,
      pdf_url = p_data->>'pdf_url', page_count = (p_data->>'page_count')::integer,
      questions_json = COALESCE(p_data->'questions_json', questions_json) WHERE id = p_id;
  ELSIF p_action = 'fail' THEN
    UPDATE worksheets SET status = 'failed', progress = 'Failed', last_activity_at = now(),
      error_message = left(p_data->>'error_message', 1000) WHERE id = p_id;
  ELSE RAISE EXCEPTION 'Invalid attempt action'; END IF;
  RETURN true;
END $$;

-- Used by status/history/retry checks. This is a hard deadline, not an inactivity guess.
CREATE OR REPLACE FUNCTION public.expire_worksheet_attempts()
RETURNS TABLE(id uuid, attempt_id uuid) LANGUAGE sql SET search_path = public AS $$
  UPDATE worksheets SET status = 'failed', progress = 'Timed out',
    error_message = CASE WHEN started_at IS NULL THEN 'Worker did not start within 15 minutes. Check the queue connection, then retry.'
      ELSE 'This generation attempt exceeded its 15-minute execution deadline. You can retry.' END
  WHERE status IN ('pending', 'processing') AND deadline_at <= now()
  RETURNING worksheets.id, worksheets.attempt_id;
$$;

-- Old workers have no attempt identity. Fence them out rather than trusting an old Processing label.
UPDATE worksheets SET status = 'failed', error_message = 'This legacy attempt cannot be tracked. Please retry.', progress = 'Retry required'
WHERE status IN ('pending', 'processing') AND attempt_id IS NULL;

REVOKE ALL ON FUNCTION public.queue_worksheet_attempt(jsonb,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_worksheet_attempt(uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_worksheet_attempts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_worksheet_attempt(jsonb,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_worksheet_attempt(uuid,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_worksheet_attempts() TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
