import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { classifyPageReading, generateMultiChapter, readSourcePage } from "../src/lib/ai/multi-chapter-generator";
import { generateQuestions } from "../src/lib/ai/question-generator";
import { combineBatches, controlOrder, MAX_TEXT_BYTES, planBatches, sectionType, validateBatch } from "../src/lib/ai/multi-chapter-plan";
import { callLLM } from "../src/lib/openrouter";
import { generateWorksheetPDF } from "../src/lib/pdf/generator";
import { getTheme } from "../src/lib/pdf/templates/themes";
import type { GenerationContext } from "../src/lib/ai/question-generator";
import type { QuestionSection } from "../src/types";

const chapters = [1, 2, 3].map((number) => ({ id: `chapter-${number}`, number, name: `पाठ ${number}` }));
const context: GenerationContext = { gradeNumber: 6, gradeName: "Grade 6", subjectSlug: "hindi", subjectName: "Hindi", chapterName: "Three chapters", chapters };
const options = { worksheetId: "worksheet", attemptId: "attempt-1", generationId: "request-1", context,
  config: { mcq: 6, veryShort: 0, longAnswer: 0 },
  pages: chapters.map((c) => ({ id: `page-${c.number}`, chapter_id: c.id, file_url: `https://source/${c.id}`, page_number: 1, type: "textbook" })) };

test("two completed chapters survive a third-chapter failure and explicit retry; no partial worksheet is returned", async () => {
  const saved = new Map<string, unknown>();
  const reads: string[] = [], writes: string[] = [], progress: string[] = [];
  let fail = true;
  let namespace = "request-1";
  const dependencies = {
    step: async <T>(_id: string, work: () => Promise<T>) => work(),
    checkpoint: async <T>(key: string, work: () => Promise<T>): Promise<T> => {
      key = namespace + key;
      if (saved.has(key)) return structuredClone(saved.get(key)) as T;
      const value = await work(); saved.set(key, structuredClone(value)); return value;
    },
    progress: async (message: string) => { progress.push(message); },
    read: async (page: { id: string }) => { reads.push(page.id); return "मातृभूमि और प्रकृति के बारे में पाठ।"; },
    write: async (system: string, user: string) => {
      assert.match(system, /Devanagari/);
      assert.ok(Buffer.byteLength(system + user) <= MAX_TEXT_BYTES);
      const chapter = Number(user.match(/Chapter: Ch (\d+)/)![1]);
      writes.push(`chapter-${chapter}`);
      if (chapter === 3 && fail) throw new Error("Provider timed out");
      const count = Number(user.match(/Generate only (\d+)/)![1]);
      return JSON.stringify({ sourcePageIds: [`page-${chapter}`], sections: [{ id: "A", type: "mcq", title: "बहुविकल्पीय प्रश्न",
        questions: Array.from({ length: count }, (_, i) => ({ number: i + 1, text: `पाठ ${chapter} प्रश्न ${i + 1}?`,
          options: ["a", "b", "c", "d"].map((label) => ({ label, text: `विकल्प ${label}` })) })) }] });
    },
  };
  await assert.rejects(generateMultiChapter(options, dependencies), /Provider timed out/);
  assert.equal(saved.size, 5); // Three page summaries, two successful chapter question batches.
  assert.match(progress.at(-1)!, /2\/3 chapters complete; Ch 3/);
  fail = false;
  progress.length = 0;
  const worksheet = await generateMultiChapter({ ...options, attemptId: "attempt-2" }, dependencies);
  assert.deepEqual(progress, ["2/3 chapters complete; Ch 3: questions 1/1"]);
  assert.deepEqual(reads, ["page-1", "page-2", "page-3"]);
  assert.deepEqual(writes, ["chapter-1", "chapter-2", "chapter-3", "chapter-3"]);
  assert.equal(worksheet.metadata.totalQuestions, 6);
  assert.equal(worksheet.metadata.chapters?.length, 3);
  assert.deepEqual(worksheet.sections[0].questions?.map((q) => q.number), [1, 2, 3, 4, 5, 6]);
  assert.equal((worksheet.sections[0] as any).sources.length, 3);
  const pdf = await generateWorksheetPDF({
    school: { id: "school", name: "Test School", logo_url: null, primary_color: "#2563eb", secondary_color: "#1d4ed8", location: "Bengaluru", academic_year: "2026-27", created_at: "", updated_at: "" },
    grade: { id: "grade", number: 6, name: "Grade 6", band: "middle", created_at: "" },
    subject: { id: "subject", name: "Hindi", slug: "hindi", grade_id: "grade", created_at: "" },
    chapter: { ...chapters[0], subject_id: "subject", created_at: "" },
    questions: worksheet, worksheetNumber: 1, theme: getTheme("middle", "hindi"),
  });
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.match(pdf.toString("latin1"), /NotoSansDevanagari/);

  // A changed source invalidates its page checkpoint and all potentially dependent questions.
  const changed = { ...options, pages: options.pages.map((p, i) => i === 2 ? { ...p, file_url: "https://source/new-page" } : p) };
  await generateMultiChapter(changed, dependencies);
  assert.equal(reads.length, 4);
  assert.equal(writes.length, 7);
  // Fresh Generate starts a separate request; Retry above retained its generation ID.
  namespace = "request-2";
  await generateMultiChapter({ ...options, generationId: namespace }, dependencies);
  assert.equal(reads.length, 7);
  assert.equal(writes.length, 10);
});

test("missing, empty, or invented AI page IDs do not block valid questions or become reference metadata", async () => {
  for (const sourcePageIds of [undefined, [], ["invented-page"], "page-1"]) {
    let writes = 0;
    const worksheet = await generateMultiChapter(options, {
      step: async (_key, work) => work(), checkpoint: async (_key, work) => work(), progress: async () => {},
      read: async () => "Source notes",
      write: async (_system, user) => {
        writes++;
        assert.doesNotMatch(user, /sourcePageIds/);
        return JSON.stringify({ sourcePageIds, sections: [{ id: "A", type: "mcq", title: "MCQ",
          sourcePageIds: ["invented-page"], referencePageIds: ["invented-page"], sourceChapterId: "invented-chapter",
          questions: [1, 2].map((number) => ({ number, text: `Question ${writes}-${number}`,
            options: ["a", "b", "c", "d"].map((label) => ({ label, text: label })) })) }] });
      },
    });
    assert.equal(writes, 3);
    assert.equal(worksheet.metadata.totalQuestions, 6);
    assert.deepEqual((worksheet.sections[0] as any).sources, chapters.map((chapter) => ({
      chapterId: chapter.id, referencePageIds: [`page-${chapter.number}`],
    })));
    assert.doesNotMatch(JSON.stringify(worksheet), /invented/);
  }
});

test("chapter coverage, configured totals, ordering and language grammar sections are preserved", () => {
  const ctx = { ...context, gradeNumber: 10 };
  const order = controlOrder(ctx, ["assertionReason", "sectionA", "assertionReason"]);
  assert.equal(new Set(order).size, order.length);
  const plan = planBatches(3, { sectionA: 5, assertionReason: 4, caseStudy: 2 }, order);
  assert.equal(plan.reduce((sum, b) => sum + b.count, 0), 11);
  assert.equal(new Set(plan.map((b) => b.chapterIndex)).size, 3);
  assert.ok(plan.every((b) => b.count <= (b.control === "caseStudy" ? 1 : 4)));
  assert.throws(() => planBatches(3, { mcq: 2 }, ["mcq"]), /per selected chapter/);
  assert.equal(sectionType("assertionReason", ctx), "short_answer");
  assert.equal(sectionType("assertionReason", { ...ctx, subjectSlug: "science" }), "assertion_reason");
  const smallPlan = planBatches(2, { sectionA: 2, assertionReason: 2 }, order);
  const parts = smallPlan.map((batch) => ({ batch, section: { id: "A", title: batch.control, type: "short_answer" as const,
    questions: [{ number: 1, text: `प्रश्न ${batch.index}` }] } }));
  const result = combineBatches(parts, smallPlan, order, ctx);
  assert.deepEqual(result.sections.map((s) => s.title), ["assertionReason", "sectionA"]);
  assert.deepEqual(result.sections.map((s) => s.questions?.length), [2, 2]);
  assert.throws(() => combineBatches(parts.slice(1), smallPlan, order, ctx), /missing/);
});

test("invalid counts, repeated questions and missing MCQ options cannot reach PDF assembly", () => {
  const batch = { chapterIndex: 0, control: "mcq", count: 1, index: 0 };
  const section: QuestionSection = { id: "A", title: "MCQ", type: "mcq", questions: [{ number: 1, text: "Same question?" }] };
  assert.throws(() => validateBatch({ sections: [section] }, batch, context, []), /options/);
  section.questions![0].options = ["a", "b", "c", "d"].map((label) => ({ label, text: label }));
  assert.throws(() => validateBatch({ sections: [section] }, batch, context, ["same question!"]), /repeated/);
  assert.throws(() => validateBatch({ sections: [section] }, { ...batch, count: 2 }, context, []), /count/);
  const assertion: QuestionSection = { id: "A", title: "Assertion and Reason", type: "assertion_reason",
    questions: [{ number: 1, text: "", assertion: "An assertion", reason: "A reason" }] };
  assert.doesNotThrow(() => validateBatch({ sections: [assertion] }, { ...batch, control: "assertionReason" },
    { ...context, subjectSlug: "science" }, []));
});

test("a large source image becomes one bounded image request, preserving Hindi reader instructions", async (t) => {
  const source = await sharp({ create: { width: 4000, height: 6000, channels: 3, background: "white" } }).png().toBuffer();
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).startsWith("https://source/")) return new Response(new Uint8Array(source));
    const body = JSON.parse(String(init?.body));
    assert.equal(body.max_tokens, 3000);
    assert.match(body.messages[0].content, /Hindi Devanagari/);
    const images = body.messages[1].content.filter((part: any) => part.type === "image_url");
    assert.equal(images.length, 1);
    const resized = await sharp(Buffer.from(images[0].image_url.url.split(",")[1], "base64")).metadata();
    assert.ok(resized.width! <= 1536 && resized.height! <= 1536);
    return Response.json({ choices: [{ message: { content: "मातृभूमि के बारे में पाठ।" }, finish_reason: "stop" }] });
  });
  const reading = await readSourcePage(options.pages[0]);
  assert.equal(typeof reading, "string");
  assert.match(reading as string, /मातृभूमि/);
});

test("blank pages are skipped, while unreadable, empty and oversized responses remain distinct failures", () => {
  assert.deepEqual(classifyPageReading(" NO_EDUCATIONAL_CONTENT\n", 26), { status: "skipped", reason: "no_educational_content" });
  assert.throws(() => classifyPageReading("UNREADABLE", 26), { name: "NonRetriableError", message: /clearer image/ });
  assert.throws(() => classifyPageReading("  ", 26), /empty response/);
  assert.throws(() => classifyPageReading("अ".repeat(4001), 26), /12,000-byte budget/);
  assert.equal(classifyPageReading("Exercise: fill in the blanks. Diagram of a leaf.", 26), "Exercise: fill in the blanks. Diagram of a leaf.");
});

test("skipped pages are checkpointed, excluded from questions, and reused after a later failure", async () => {
  const saved = new Map<string, unknown>();
  const readIds: string[] = [], progress: string[] = [];
  let fail = true;
  const blank = { ...options.pages[1], id: "blank-notes-page", page_number: 26 };
  const request = { ...options, pages: [...options.pages, blank] };
  const dependencies = {
    step: async <T>(_id: string, work: () => Promise<T>) => work(),
    checkpoint: async <T>(key: string, work: () => Promise<T>): Promise<T> => {
      if (saved.has(key)) return structuredClone(saved.get(key)) as T;
      const result = await work(); saved.set(key, result); return result;
    },
    progress: async (message: string) => { progress.push(message); },
    read: async (page: { id: string }) => {
      readIds.push(page.id);
      return classifyPageReading(page.id === blank.id ? "NO_EDUCATIONAL_CONTENT" : "Readable lesson content", 26);
    },
    write: async (_system: string, user: string) => {
      assert.doesNotMatch(user, /blank-notes-page|NO_EDUCATIONAL_CONTENT/);
      const chapter = Number(user.match(/Chapter: Ch (\d+)/)![1]);
      if (chapter === 3 && fail) throw new Error("Temporary provider error");
      return JSON.stringify({ sections: [{ id: "A", type: "mcq", title: "Questions", questions: [1, 2].map((number) => ({
        number, text: `Question ${chapter}-${number}`, options: ["a", "b", "c", "d"].map((label) => ({ label, text: label })),
      })) }] });
    },
  };
  await assert.rejects(generateMultiChapter(request, dependencies), /Temporary provider error/);
  assert.ok(progress.some((message) => message.includes("skipped non-content page")));
  fail = false;
  const result = await generateMultiChapter({ ...request, attemptId: "retry" }, dependencies);
  assert.equal(readIds.filter((id) => id === blank.id).length, 1);
  assert.equal(readIds.length, 4);
  assert.equal(result.metadata.totalQuestions, 6);
  assert.deepEqual((result.metadata as any).skippedSourcePages, [{
    chapterId: blank.chapter_id, pageId: blank.id, pageNumber: 26, reason: "no_educational_content",
  }]);
  assert.ok(!(result.sections[0] as any).sources.some((s: any) => s.referencePageIds.includes(blank.id)));
});

test("a chapter with only non-content pages cannot generate unsupported questions", async () => {
  let writes = 0;
  await assert.rejects(generateMultiChapter(options, {
    step: async (_id, work) => work(), checkpoint: async (_key, work) => work(), progress: async () => {},
    read: async () => ({ status: "skipped", reason: "no_educational_content" }),
    write: async () => { writes++; return "{}"; },
  }), /no usable educational content/);
  assert.equal(writes, 0);
});

test("Single Chapter still sends its source pages through the original generation request", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.max_tokens, 16000);
    assert.doesNotMatch(body.messages[0].content, /NO_EDUCATIONAL_CONTENT/);
    assert.equal(body.messages[1].content.filter((part: any) => part.type === "image_url").length, 2);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ metadata: {}, sections: [{
      id: "A", title: "Questions", type: "very_short", questions: [{ number: 8, text: "What makes a balanced diet?" }],
    }] }) } }] });
  });
  const worksheet = await generateQuestions(["https://source/lesson.jpg", "https://source/blank-notes.jpg"],
    { ...context, chapters: undefined }, { mcq: 0, veryShort: 1, longAnswer: 0 });
  assert.equal(calls, 1);
  assert.equal(worksheet.metadata.totalQuestions, 1);
  assert.equal(worksheet.sections[0].questions![0].number, 1);
});

test("multi rejects truncated AI output; single request defaults stay unchanged", async (t) => {
  const requests: any[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)));
    return Response.json({ choices: [{ message: { content: "partial" }, finish_reason: "length" }] });
  });
  await assert.rejects(callLLM([{ role: "user", content: "test" }], { timeoutMs: 90_000, maxTokens: 6000 }), /incomplete/);
  assert.equal(await callLLM([{ role: "user", content: "test" }]), "partial");
  assert.deepEqual(requests.map((r) => r.max_tokens), [6000, 16000]);
});

test("five chapters with large Hindi notes and previous sets never produce an oversized writer request", async () => {
  const manyChapters = Array.from({ length: 5 }, (_, i) => ({ id: `ch-${i}`, number: i + 1, name: `पाठ ${i + 1}` }));
  const pages = manyChapters.flatMap((chapter) => Array.from({ length: 10 }, (_, i) => ({
    id: `${chapter.id}-page-${i}`, chapter_id: chapter.id, file_url: "https://source/page", page_number: i + 1, type: "textbook",
  })));
  let readCount = 0, writeCount = 0;
  const result = await generateMultiChapter({ ...options, context: { ...context, gradeNumber: 10, chapters: manyChapters }, pages,
    config: { sectionA: 10 }, previousQuestions: Array.from({ length: 1000 }, (_, i) => `पुराना प्रश्न ${i} ${"वाक्य ".repeat(100)}`),
  }, {
    step: async (_key, work) => work(), checkpoint: async (_key, work) => work(), progress: async () => {},
    read: async () => { readCount++; return "मातृभूमि के बारे में स्रोत पाठ। ".repeat(100); },
    write: async (system, user) => {
      writeCount++;
      assert.ok(Buffer.byteLength(system + user) <= MAX_TEXT_BYTES);
      const selected = JSON.parse(user.slice(user.lastIndexOf("\n") + 1));
      assert.ok(selected.length > 0 && selected.length < 10);
      return JSON.stringify({ sourcePageIds: [selected[0].id], sections: [{ id: "A", title: "लघु उत्तरीय प्रश्न", type: "short_answer",
        questions: [1, 2].map((number) => ({ number, text: `नया प्रश्न ${writeCount} ${number}` })) }] });
    },
  });
  assert.equal(readCount, 50);
  assert.equal(writeCount, 5);
  assert.equal(result.metadata.totalQuestions, 10);
});
