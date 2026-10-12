BEGIN;

-- Results survive worker restarts and explicit retries. A new Generate request has a new generation_id.
CREATE TABLE IF NOT EXISTS public.worksheet_checkpoints (
  worksheet_id uuid NOT NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,
  generation_id text NOT NULL,
  step_key text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (worksheet_id, generation_id, step_key)
);
ALTER TABLE public.worksheet_checkpoints ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.worksheet_checkpoints FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.worksheet_checkpoints TO service_role;

CREATE OR REPLACE FUNCTION public.save_worksheet_checkpoint(
  p_id uuid, p_attempt uuid, p_generation text, p_key text, p_result jsonb
) RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE w public.worksheets;
BEGIN
  SELECT * INTO w FROM worksheets WHERE id = p_id FOR UPDATE;
  IF w.id IS NULL OR p_attempt IS NULL OR w.attempt_id IS DISTINCT FROM p_attempt
    OR w.status <> 'processing' OR w.deadline_at <= now() OR w.attempt_kind <> 'generate'
    OR COALESCE(w.attempt_request->>'generationId', w.id::text) IS DISTINCT FROM p_generation
    THEN RETURN false; END IF;
  INSERT INTO worksheet_checkpoints(worksheet_id, generation_id, step_key, result)
    VALUES(p_id, p_generation, p_key, p_result) ON CONFLICT DO NOTHING;
  RETURN true;
END $$;

-- Single chapter and PDF edits retain 15 minutes. Multi gets a bounded workload budget.
CREATE OR REPLACE FUNCTION public.update_worksheet_attempt(p_id uuid, p_attempt uuid, p_action text, p_data jsonb DEFAULT '{}')
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE w public.worksheets; minutes integer := 15;
BEGIN
  SELECT * INTO w FROM worksheets WHERE id = p_id FOR UPDATE;
  IF w.id IS NULL OR w.attempt_id IS DISTINCT FROM p_attempt OR p_attempt IS NULL
    OR w.status NOT IN ('pending', 'processing') OR w.deadline_at <= now() THEN RETURN false; END IF;
  IF p_action = 'start' THEN
    IF w.run_id IS NOT NULL AND w.run_id <> p_data->>'run_id' THEN RETURN false; END IF;
    IF w.attempt_kind = 'generate' AND cardinality(w.chapter_ids) > 1 THEN
      minutes := LEAST(120, GREATEST(20, COALESCE((p_data->>'execution_minutes')::integer, 120)));
    END IF;
    UPDATE worksheets SET status = 'processing', started_at = COALESCE(started_at, now()),
      deadline_at = CASE WHEN started_at IS NULL THEN now() + make_interval(mins => minutes) ELSE deadline_at END,
      run_id = p_data->>'run_id', last_activity_at = now(), progress = 'Loading source material' WHERE id = p_id;
  ELSIF p_action = 'progress' THEN
    UPDATE worksheets SET last_activity_at = now(), progress = p_data->>'progress' WHERE id = p_id;
  ELSIF p_action = 'complete' THEN
    UPDATE worksheets SET status = 'completed', progress = 'Completed', last_activity_at = now(), error_message = NULL,
      pdf_url = p_data->>'pdf_url', page_count = (p_data->>'page_count')::integer,
      questions_json = COALESCE(p_data->'questions_json', questions_json) WHERE id = p_id;
  ELSIF p_action = 'fail' THEN
    UPDATE worksheets SET status = 'failed', progress = 'Failed', last_activity_at = now(),
      error_message = left(CASE WHEN cardinality(w.chapter_ids) > 1 AND w.attempt_kind = 'generate'
        THEN COALESCE(w.progress, '') || '. Saved work is kept; Retry resumes it. ' ELSE '' END
        || COALESCE(p_data->>'error_message', 'Generation failed'), 1000) WHERE id = p_id;
  ELSE RAISE EXCEPTION 'Invalid attempt action'; END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.expire_worksheet_attempts()
RETURNS TABLE(id uuid, attempt_id uuid) LANGUAGE sql SET search_path = public AS $$
  UPDATE worksheets SET status = 'failed', progress = 'Timed out',
    error_message = CASE WHEN started_at IS NULL THEN 'Worker did not start within 15 minutes. Check the queue connection, then retry.'
      WHEN cardinality(chapter_ids) > 1 AND attempt_kind = 'generate'
        THEN COALESCE(progress, '') || '. Execution deadline reached. Saved work is kept; Retry resumes it.'
      ELSE 'This generation attempt exceeded its 15-minute execution deadline. You can retry.' END
  WHERE status IN ('pending', 'processing') AND deadline_at <= now()
  RETURNING worksheets.id, worksheets.attempt_id;
$$;

REVOKE ALL ON FUNCTION public.save_worksheet_checkpoint(uuid,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_worksheet_checkpoint(uuid,uuid,text,text,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
