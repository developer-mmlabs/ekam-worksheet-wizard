import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as generate } from "../src/app/api/generate/route";
import { GET as chapterStatus } from "../src/app/api/generate/chapter-status/route";
import { POST as finalize } from "../src/app/api/generate/finalize/route";
import { inngest } from "../src/inngest/client";
import { getWorksheetConfigSpec } from "../src/lib/worksheet-configs";

const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const schoolId = "00000000-0000-4000-8000-000000000010";
const makeChapters = () => [a, b].map((id, i) => ({ id, number: i + 1, name: `Chapter ${i + 1}`, subject_id: "science", subject: { slug: "science", grade: { number: 4 } } }));
const post = (body: unknown) => new NextRequest("http://localhost/api/generate", { method: "POST", body: JSON.stringify(body) });

test("generation, status and finalization preserve chapter-combination boundaries", async (t) => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-only-key";
  let chapters = makeChapters();
  let rows: Record<string, unknown>[] = [];
  let materials = true;
  let record: Record<string, unknown> = {};
  const requests: { url: URL; method: string; body: Record<string, unknown> }[] = [];
  const events: unknown[] = [];
  t.mock.method(inngest, "send", async (event: unknown) => { events.push(event); return { ids: ["event"] }; });
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    requests.push({ url, method, body });
    const headers = { "content-type": "application/json" };
    const table = url.pathname.split("/").at(-1);
    if (table === "chapters") return new Response(JSON.stringify(chapters), { headers });
    if (table === "schools") return new Response(JSON.stringify({ id: schoolId }), { headers });
    if (table === "source_materials") return new Response(null, { headers: { ...headers, "content-range": materials ? "0-0/1" : "*/0" } });
    if (table === "worksheets") {
      if (method === "POST") return new Response(JSON.stringify({ id: "worksheet" }), { headers });
      if (method === "DELETE" || method === "PATCH") return new Response(null, { status: 204 });
      return new Response(JSON.stringify(url.searchParams.has("id") ? record : rows), { headers });
    }
    throw new Error(`Unexpected external request: ${url.pathname}`);
  });

  await t.test("multi generation stores canonical IDs and queues the whole selection", async () => {
    const result = await generate(post({ chapterIds: [b, a], schoolId }));
    assert.equal(result.status, 200);
    const inserted = requests.find((r) => r.method === "POST")!.body;
    assert.deepEqual(inserted.chapter_ids, [a, b]);
    assert.equal(inserted.chapter_id, a);
    assert.deepEqual((events[0] as { data: { chapterIds: string[] } }).data.chapterIds, [a, b]);
    assert.ok(requests.some((r) => r.url.searchParams.get("chapter_ids") === `eq.{${a},${b}}`));
  });

  await t.test("a single chapter uses its separate scope", async () => {
    requests.length = 0;
    chapters = makeChapters().slice(0, 1);
    assert.equal((await generate(post({ chapterId: a, schoolId }))).status, 200);
    assert.ok(requests.some((r) => r.url.searchParams.get("chapter_ids") === "is.null"));
    assert.equal(requests.find((r) => r.method === "POST")!.body.chapter_ids, null);
    chapters = makeChapters();
  });

  await t.test("reject mixed subjects, missing pages, invalid selection and zero question counts", async () => {
    chapters[1].subject_id = "maths";
    assert.equal((await generate(post({ chapterIds: [a, b], schoolId }))).status, 400);
    chapters = makeChapters();
    materials = false;
    assert.equal((await generate(post({ chapterIds: [a, b], schoolId }))).status, 400);
    materials = true;
    assert.equal((await generate(post({ chapterIds: [a], schoolId }))).status, 400);
    assert.equal((await generate(post({ chapterIds: [a, "bad"], schoolId }))).status, 400);
    const config = Object.fromEntries(getWorksheetConfigSpec(4, "science").controls.map((control) => [control.id, 0]));
    assert.equal((await generate(post({ chapterIds: [a, b], schoolId, config }))).status, 400);
  });

  await t.test("in-flight work is resumed instead of replaced", async () => {
    requests.length = 0;
    rows = [{ id: "pending", set_number: 1, is_finalized: false, status: "processing" }];
    const response = await generate(post({ chapterIds: [a, b], schoolId }));
    assert.equal((await response.json()).worksheetId, "pending");
    assert.equal(requests.some((r) => r.method === "POST" || r.method === "DELETE"), false);
  });

  await t.test("the fourth finalized set is rejected", async () => {
    rows = [1, 2, 3].map((set_number) => ({ set_number, is_finalized: true }));
    assert.equal((await generate(post({ chapterIds: [a, b], schoolId }))).status, 400);
  });

  await t.test("status uses the complete sorted combination", async () => {
    requests.length = 0;
    rows = [{ id: "first", set_number: 1, is_finalized: true }];
    const response = await chapterStatus(new NextRequest(`http://localhost/api/generate/chapter-status?schoolId=${schoolId}&chapterIds=${b},${a}`));
    assert.equal((await response.json()).nextSetNumber, 2);
    assert.equal(requests[0].url.searchParams.get("chapter_ids"), `eq.{${a},${b}}`);
  });

  await t.test("finalize advances only the selected combination", async () => {
    requests.length = 0;
    record = { id: "worksheet", chapter_id: a, chapter_ids: [a, b], school_id: schoolId, set_number: 1, status: "completed", is_finalized: false, pdf_url: "https://example.com/worksheet.pdf" };
    rows = [{ set_number: 1, is_finalized: true }];
    const response = await finalize(post({ worksheetId: "worksheet" }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).nextSetNumber, 2);
    assert.ok(requests.some((r) => r.url.searchParams.get("chapter_ids") === `eq.{${a},${b}}`));
  });
});
