import { test } from "node:test";
import assert from "node:assert/strict";
import { chapterArrayFilter, nextWorksheetSet, parseChapterSelection, sampleChapterPages, worksheetChapterTitle } from "../src/lib/worksheet-scope";
import type { WorksheetQuestions } from "../src/types";

const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";

test("a chapter combination has the same identity regardless of order or duplicate IDs", () => {
  assert.deepEqual(parseChapterSelection(undefined, [b, a, b]), [a, b]);
  assert.equal(chapterArrayFilter([b, a]), chapterArrayFilter([a, b]));
  assert.deepEqual(parseChapterSelection(a), [a]);
});

test("invalid, ambiguous, and undersized multi selections are rejected", () => {
  for (const ids of [[], [a], [a, a], [a, "bad"], "bad", null]) {
    assert.throws(() => parseChapterSelection(undefined, ids));
  }
  assert.throws(() => parseChapterSelection(a, [a, b]));
  assert.throws(() => parseChapterSelection(undefined));
});

test("only finalized slots advance the three-set workflow", () => {
  assert.equal(nextWorksheetSet([]), 1);
  assert.equal(nextWorksheetSet([{ set_number: 1, is_finalized: false }]), 1);
  assert.equal(nextWorksheetSet([{ set_number: 1, is_finalized: true }]), 2);
  assert.equal(nextWorksheetSet([1, 2, 3].map((set_number) => ({ set_number, is_finalized: true }))), null);
});

test("page sampling represents every chapter, including later pages, within the image budget", () => {
  const groups = [100, 2, 80].map((n, group) => Array.from({ length: n }, (_, page) => `${group}:${page}`));
  const sampled = sampleChapterPages(groups);
  assert.equal(sampled.flat().length, 50);
  assert.equal(sampled[0].length, 24);
  assert.equal(sampled[2].length, 24);
  sampled.forEach((pages, i) => {
    assert.equal(pages[0], groups[i][0]);
    assert.equal(pages.at(-1), groups[i].at(-1));
    assert.equal(new Set(pages).size, pages.length);
  });
  assert.throws(() => sampleChapterPages([[1], []]));
  assert.throws(() => sampleChapterPages([[1], [2]], 1));
});

test("PDF labels retain all chapters after question edits and preserve single labels", () => {
  const chapter = { id: a, number: 1, name: "Plants" };
  const questions: WorksheetQuestions = { metadata: { grade: "Grade 4", subject: "Science", chapter: "Plants", totalQuestions: 1 }, sections: [] };
  assert.equal(worksheetChapterTitle(questions, chapter), "C-1, Plants");
  questions.metadata.chapters = [chapter, { id: b, number: 2, name: "Animals" }];
  assert.equal(worksheetChapterTitle(questions, chapter), "Ch 1: Plants; Ch 2: Animals");
});
