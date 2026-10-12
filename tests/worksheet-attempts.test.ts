import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { inngest } from "../src/inngest/client";
import { errorMessage, queueAttempt, requireAttempt } from "../src/lib/worksheet-attempts";
import { GET as status } from "../src/app/api/generate/status/route";

test("attempt delivery, error reporting and status reconciliation", async (t) => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-key";
  const calls: { name: string; body: Record<string, unknown> }[] = [];
  const events: any[] = [];
  let claimed = true, accepted = true, unavailable = false, sendFails = false;
  const worksheet = { id: "worksheet", attempt_id: "attempt-2", attempt_kind: "pdf", status: "completed",
    pdf_url: "previous.pdf", created_at: "2020-01-01T00:00:00Z", started_at: new Date().toISOString(),
    questions_json: {}, set_number: 1, is_finalized: false, page_count: 2, error_message: null };
  t.mock.method(inngest, "send", async (event: any) => {
    if (sendFails) throw new Error("Queue offline");
    events.push(event); return { ids: ["event"] };
  });
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const name = new URL(String(input)).pathname.split("/").at(-1)!;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    calls.push({ name, body });
    if (name === "expire_worksheet_attempts") return unavailable
      ? Response.json({ message: "Unavailable" }, { status: 503 }) : Response.json([]);
    if (name === "queue_worksheet_attempt") return Response.json({ worksheet, claimed });
    if (name === "update_worksheet_attempt") return Response.json(accepted);
    if (name === "worksheets") return Response.json(worksheet);
    throw new Error("Unexpected request");
  });

  await t.test("a re-render queues its new attempt identity, not the worksheet creation time", async () => {
    await queueAttempt({ id: worksheet.id, questions_json: { sections: [] } }, "pdf", "attempt-1");
    assert.equal(events[0].id, "attempt-2");
    assert.equal(events[0].data.attemptId, "attempt-2");
    assert.equal(events[0].name, "worksheet/pdf.regenerate");
  });
  await t.test("an active attempt is reused without another event or timer reset", async () => {
    claimed = false;
    await queueAttempt({ id: worksheet.id }, "generate");
    assert.equal(events.length, 1);
    await assert.rejects(queueAttempt({ id: worksheet.id, questions_json: {} }, "pdf"), /Another attempt/);
    claimed = true;
  });
  await t.test("queue failures mark only the claimed attempt failed", async () => {
    sendFails = true;
    await assert.rejects(queueAttempt({ id: worksheet.id }, "pdf", "attempt-1"), /Unable to queue/);
    const saved = calls.filter((c) => c.name === "update_worksheet_attempt").at(-1)!;
    assert.equal(saved.body.p_attempt, "attempt-2");
    assert.match((saved.body.p_data as any).error_message, /Queue offline/);
    sendFails = false;
  });
  await t.test("expired/superseded workers stop without retrying stale writes", async () => {
    accepted = false;
    await assert.rejects(requireAttempt("worksheet", "attempt-1", "complete"), { name: "NonRetriableError" });
    accepted = true;
  });
  await t.test("old creation dates do not expire a completed/re-rendered worksheet", async () => {
    const response = await status(new NextRequest("http://localhost/api/generate/status?id=worksheet"));
    const data = await response.json();
    assert.equal(data.status, "completed");
    assert.equal(data.pdfUrl, "previous.pdf");
    assert.equal(data.attemptId, "attempt-2");
    assert.equal(calls.some((c) => c.name === "worksheets" && Object.keys(c.body).length), false);
  });
  await t.test("a failed status check reports uncertainty, not a failed job", async () => {
    unavailable = true;
    const response = await status(new NextRequest("http://localhost/api/generate/status?id=worksheet"));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).status, undefined);
  });
  assert.equal(errorMessage({ message: "Provider context limit exceeded" }), "Provider context limit exceeded");
});
