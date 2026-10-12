-- Executed with the migration by scripts/migrate-worksheet-attempts.ts --test.
-- The final exception rolls back ALL schema and data changes in this RPC transaction.
DO $$
DECLARE school uuid; chapter uuid; request jsonb; result jsonb; again jsonb;
  wid uuid; first_attempt uuid; second_attempt uuid; old_deadline timestamptz;
BEGIN
  INSERT INTO schools(name) VALUES ('Attempt regression test - rolled back') RETURNING id INTO school;
  SELECT id INTO STRICT chapter FROM chapters LIMIT 1;
  request := jsonb_build_object('school_id', school, 'chapter_id', chapter, 'chapter_ids', NULL,
    'set_number', 1, 'attempt_request', jsonb_build_object('chapterId', chapter));
  result := queue_worksheet_attempt(request, 'generate');
  wid := (result->'worksheet'->>'id')::uuid;
  first_attempt := (result->'worksheet'->>'attempt_id')::uuid;
  IF NOT (result->>'claimed')::boolean OR first_attempt IS NULL THEN RAISE EXCEPTION 'Initial claim failed'; END IF;
  again := queue_worksheet_attempt(request, 'generate');
  IF (again->>'claimed')::boolean OR again->'worksheet'->>'attempt_id' <> first_attempt::text THEN
    RAISE EXCEPTION 'Duplicate request started another attempt'; END IF;

  -- Waiting 14 minutes must still leave a full execution budget at actual start.
  UPDATE worksheets SET queued_at = now() - interval '14 minutes', deadline_at = now() + interval '1 minute',
    created_at = now() - interval '1 year' WHERE id = wid;
  IF NOT update_worksheet_attempt(wid, first_attempt, 'start', '{"run_id":"run-1"}') THEN RAISE EXCEPTION 'Start failed'; END IF;
  SELECT deadline_at INTO old_deadline FROM worksheets WHERE id = wid;
  IF old_deadline < now() + interval '14 minutes' THEN RAISE EXCEPTION 'Timer inherited queued or creation age'; END IF;
  IF update_worksheet_attempt(wid, first_attempt, 'start', '{"run_id":"duplicate-run"}') THEN RAISE EXCEPTION 'Duplicate worker claimed run'; END IF;
  IF NOT update_worksheet_attempt(wid, first_attempt, 'start', '{"run_id":"run-1"}') THEN RAISE EXCEPTION 'Step retry rejected'; END IF;
  IF (SELECT deadline_at FROM worksheets WHERE id = wid) <> old_deadline THEN RAISE EXCEPTION 'Step retry reset timer'; END IF;

  PERFORM update_worksheet_attempt(wid, first_attempt, 'fail', '{"error_message":"Provider rejected input"}');
  result := queue_worksheet_attempt(jsonb_build_object('id', wid), 'generate', first_attempt);
  second_attempt := (result->'worksheet'->>'attempt_id')::uuid;
  IF second_attempt = first_attempt OR result->'worksheet'->>'started_at' IS NOT NULL THEN RAISE EXCEPTION 'Retry not fresh'; END IF;
  IF update_worksheet_attempt(wid, first_attempt, 'complete', '{"pdf_url":"stale","page_count":1}') THEN RAISE EXCEPTION 'Stale success accepted'; END IF;
  IF update_worksheet_attempt(wid, first_attempt, 'fail', '{"error_message":"stale"}') THEN RAISE EXCEPTION 'Stale failure accepted'; END IF;
  PERFORM update_worksheet_attempt(wid, second_attempt, 'start', '{"run_id":"run-2"}');
  PERFORM update_worksheet_attempt(wid, second_attempt, 'complete', '{"pdf_url":"previous.pdf","page_count":2,"questions_json":{"sections":[]}}');
  PERFORM expire_worksheet_attempts();
  IF (SELECT status FROM worksheets WHERE id = wid) <> 'completed' THEN RAISE EXCEPTION 'Completed row expired'; END IF;

  -- Re-rendering an old worksheet preserves the old PDF and receives a new budget.
  result := queue_worksheet_attempt(jsonb_build_object('id', wid), 'pdf', second_attempt);
  first_attempt := (result->'worksheet'->>'attempt_id')::uuid;
  IF result->'worksheet'->>'pdf_url' <> 'previous.pdf' OR first_attempt = second_attempt THEN RAISE EXCEPTION 'Re-render lost PDF or identity'; END IF;
  PERFORM update_worksheet_attempt(wid, first_attempt, 'start', '{"run_id":"pdf-run"}');
  UPDATE worksheets SET deadline_at = now() - interval '1 second' WHERE id = wid;
  IF update_worksheet_attempt(wid, first_attempt, 'complete', '{"pdf_url":"late.pdf","page_count":1}') THEN RAISE EXCEPTION 'Expired result accepted'; END IF;
  PERFORM expire_worksheet_attempts();
  IF (SELECT status FROM worksheets WHERE id = wid) <> 'failed' OR
    (SELECT pdf_url FROM worksheets WHERE id = wid) <> 'previous.pdf' THEN RAISE EXCEPTION 'Timeout lost previous PDF'; END IF;

  UPDATE worksheets SET is_finalized = true WHERE id = wid;
  BEGIN
    PERFORM queue_worksheet_attempt(jsonb_build_object('id', wid), 'pdf', first_attempt);
    RAISE EXCEPTION 'Finalized worksheet was replaced';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Cannot replace a finalized worksheet' THEN RAISE; END IF;
  END;
  RAISE EXCEPTION 'ATTEMPT_TESTS_PASSED_ROLLBACK';
END $$;
