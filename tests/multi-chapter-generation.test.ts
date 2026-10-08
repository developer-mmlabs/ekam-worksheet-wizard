import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { generateQuestions } from "../src/lib/ai/question-generator";
import { generateWorksheetPDF } from "../src/lib/pdf/generator";
import { getTheme } from "../src/lib/pdf/templates/themes";

test("combined AI input keeps chapter labels and produces a renderable PDF", async (t) => {
  const chapters = [{ id: "a", number: 1, name: "Plants Around Us" }, { id: "b", number: 2, name: "Animals and Habitats" }];
  let request: { messages: { role: string; content: unknown }[] } | undefined;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    request = JSON.parse(String(init?.body));
    return Response.json({ choices: [{ message: { content: JSON.stringify({
      metadata: { grade: "Grade 4", subject: "Science", chapter: "Incorrect AI title", totalQuestions: 0 },
      sections: [{ id: "A", title: "Short Answer Questions", type: "short_answer", questions: [{ number: 9, text: "Why do plants need sunlight?" }, { number: 9, text: "How does a camel survive in the desert?" }] }],
    }) } }] });
  });
  const questions = await generateQuestions(["https://example.test/plants.jpg", "https://example.test/animals.jpg"], {
    gradeNumber: 4, gradeName: "Grade 4", subjectSlug: "science", subjectName: "Science",
    chapterName: "Plants Around Us; Animals and Habitats", chapters,
    sourcePageLabels: ["Plants Around Us - Page 1", "Animals and Habitats - Page 1"],
  }, { shortAnswer: 2 }, undefined, ["Name a root vegetable."]);
  const systemPrompt = String(request!.messages[0].content);
  assert.match(systemPrompt, /TOTALS for the combined worksheet/);
  assert.match(systemPrompt, /Plants Around Us/);
  assert.match(systemPrompt, /Animals and Habitats/);
  assert.match(systemPrompt, /Name a root vegetable/);
  const userPrompt = JSON.stringify(request!.messages[1].content);
  assert.match(userPrompt, /Plants Around Us - Page 1/);
  assert.match(userPrompt, /Animals and Habitats - Page 1/);
  assert.deepEqual(questions.metadata.chapters, chapters);
  assert.equal(questions.metadata.totalQuestions, 2);
  assert.equal(questions.metadata.chapter, "Ch 1: Plants Around Us; Ch 2: Animals and Habitats");
  assert.deepEqual(questions.sections[0].questions?.map((q) => q.number), [1, 2]);
  t.mock.restoreAll();
  const pdf = await generateWorksheetPDF({
    school: { id: "school", name: "Sample School", logo_url: null, primary_color: "#2563eb", secondary_color: "#1d4ed8", location: "Bengaluru", academic_year: "2026-27", created_at: "", updated_at: "" },
    grade: { id: "grade", number: 4, name: "Grade 4", band: "primary", created_at: "" },
    subject: { id: "subject", name: "Science", slug: "science", grade_id: "grade", created_at: "" },
    chapter: { ...chapters[0], subject_id: "subject", created_at: "" },
    questions, worksheetNumber: 1, theme: getTheme("primary", "science"),
  });
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length > 1000);
  await mkdir(".playwright-mcp", { recursive: true });
  await writeFile(".playwright-mcp/multi-chapter-sample.pdf", pdf);
});
