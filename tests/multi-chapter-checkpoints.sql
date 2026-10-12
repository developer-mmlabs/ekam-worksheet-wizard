-- Run in a rollback-only transaction using migrate-worksheet-attempts.ts --multi --test.
DO $$
DECLARE school uuid; chapter uuid; request jsonb; result jsonb;
  wid uuid; first_attempt uuid; second_attempt uuid; deadline timestamptz;
BEGIN
  INSERT INTO schools(name) VALUES ('Checkpoint test - rolled back') RETURNING id INTO school;
  SELECT id INTO STRICT chapter FROM chapters LIMIT 1;
  request := jsonb_build_object('school_id', school, 'chapter_id', chapter,
    'chapter_ids', jsonb_build_array(chapter, chapter), 'set_number', 1,
    'attempt_request', '{"generationId":"generation-1"}'::jsonb);
  result := queue_worksheet_attempt(request, 'generate');
  wid := (result->'worksheet'->>'id')::uuid;
  first_attempt := (result->'worksheet'->>'attempt_id')::uuid;
  PERFORM update_worksheet_attempt(wid, first_attempt, 'start', '{"run_id":"run-1","execution_minutes":45}');
  SELECT deadline_at INTO deadline FROM worksheets WHERE id = wid;
  IF deadline <> now() + interval '45 minutes' THEN RAISE EXCEPTION 'Multi deadline incorrect'; END IF;
  PERFORM update_worksheet_attempt(wid, first_attempt, 'start', '{"run_id":"run-1","execution_minutes":120}');
  IF (SELECT deadline_at FROM worksheets WHERE id = wid) <> deadline THEN RAISE EXCEPTION 'Step retry reset deadline'; END IF;
  IF NOT save_worksheet_checkpoint(wid, first_attempt, 'generation-1', 'chapter-1', '{"saved":true}') THEN RAISE EXCEPTION 'Checkpoint rejected'; END IF;
  IF save_worksheet_checkpoint(wid, first_attempt, 'wrong-generation', 'chapter-2', '{}') THEN RAISE EXCEPTION 'Wrong generation accepted'; END IF;
  PERFORM update_worksheet_attempt(wid, first_attempt, 'progress', '{"progress":"2/3 chapters complete; Ch 3"}');
  PERFORM update_worksheet_attempt(wid, first_attempt, 'fail', '{"error_message":"Provider timed out"}');
  IF (SELECT error_message FROM worksheets WHERE id = wid) NOT LIKE '2/3 chapters complete%' THEN RAISE EXCEPTION 'Chapter progress lost'; END IF;
  result := queue_worksheet_attempt(jsonb_build_object('id', wid), 'generate', first_attempt);
  second_attempt := (result->'worksheet'->>'attempt_id')::uuid;
  PERFORM update_worksheet_attempt(wid, second_attempt, 'start', '{"run_id":"run-2","execution_minutes":999}');
  IF (SELECT deadline_at FROM worksheets WHERE id = wid) <> now() + interval '120 minutes' THEN RAISE EXCEPTION 'Multi deadline unbounded'; END IF;
  IF save_worksheet_checkpoint(wid, first_attempt, 'generation-1', 'chapter-1', '{"saved":false}') THEN RAISE EXCEPTION 'Old worker accepted'; END IF;
  IF NOT (SELECT (c.result->>'saved')::boolean FROM worksheet_checkpoints c WHERE worksheet_id = wid) THEN RAISE EXCEPTION 'Completed work lost'; END IF;
  PERFORM save_worksheet_checkpoint(wid, second_attempt, 'generation-1', 'chapter-1', '{"saved":false}');
  IF NOT (SELECT (c.result->>'saved')::boolean FROM worksheet_checkpoints c WHERE worksheet_id = wid) THEN RAISE EXCEPTION 'Immutable work replaced'; END IF;
  UPDATE worksheets SET deadline_at = now() - interval '1 second' WHERE id = wid;
  IF save_worksheet_checkpoint(wid, second_attempt, 'generation-1', 'chapter-3', '{}') THEN RAISE EXCEPTION 'Expired checkpoint accepted'; END IF;
  PERFORM expire_worksheet_attempts();
  IF (SELECT error_message FROM worksheets WHERE id = wid) NOT LIKE '%Saved work is kept%' THEN RAISE EXCEPTION 'Misleading timeout'; END IF;
  DELETE FROM worksheets WHERE id = wid;
  IF EXISTS(SELECT 1 FROM worksheet_checkpoints WHERE worksheet_id = wid) THEN RAISE EXCEPTION 'Checkpoints not deleted with worksheet'; END IF;

  request := request || '{"chapter_ids":null,"attempt_request":{}}'::jsonb;
  result := queue_worksheet_attempt(request, 'generate');
  wid := (result->'worksheet'->>'id')::uuid;
  first_attempt := (result->'worksheet'->>'attempt_id')::uuid;
  PERFORM update_worksheet_attempt(wid, first_attempt, 'start', '{"run_id":"single","execution_minutes":120}');
  IF (SELECT deadline_at FROM worksheets WHERE id = wid) <> now() + interval '15 minutes' THEN RAISE EXCEPTION 'Single chapter deadline changed'; END IF;
  RAISE EXCEPTION 'ATTEMPT_TESTS_PASSED_ROLLBACK';
END $$;
