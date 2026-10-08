import type { Chapter, WorksheetQuestions } from "@/types";

export const MAX_CHAPTERS = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A sorted selection is the identity of a set, regardless of click order. */
export function parseChapterSelection(chapterId: unknown, chapterIds?: unknown): string[] {
  if (chapterIds !== undefined && chapterId !== undefined && chapterId !== null) {
    throw new Error("Choose either a single chapter or multiple chapters.");
  }
  const multi = chapterIds !== undefined;
  const values = multi ? chapterIds : [chapterId];
  if (!Array.isArray(values) || values.some((id) => typeof id !== "string" || !UUID.test(id))) {
    throw new Error("Select valid chapters.");
  }
  const ids = [...new Set((values as string[]).map((id) => id.toLowerCase()))].sort();
  if (ids.length < (multi ? 2 : 1) || ids.length > MAX_CHAPTERS) {
    throw new Error(multi ? `Select between 2 and ${MAX_CHAPTERS} chapters.` : "Select a chapter.");
  }
  return ids;
}

export function chapterArrayFilter(ids: string[]): string {
  return `{${[...ids].sort().join(",")}}`;
}

export function nextWorksheetSet(rows: { set_number: number; is_finalized: boolean }[]): number | null {
  const finalized = new Set(rows.filter((row) => row.is_finalized).map((row) => row.set_number));
  return [1, 2, 3].find((n) => !finalized.has(n)) ?? null;
}

export type ChapterSummary = Pick<Chapter, "id" | "number" | "name">;

export function chapterTitle(chapters: ChapterSummary[]): string {
  return chapters.map((chapter) => `Ch ${chapter.number}: ${chapter.name}`).join("; ");
}

export function worksheetChapterTitle(questions: WorksheetQuestions, chapter: ChapterSummary): string {
  return questions.metadata?.chapters?.length
    ? chapterTitle(questions.metadata.chapters)
    : `C-${chapter.number}, ${chapter.name}`;
}

/** Allocate pages fairly, then sample across each chapter, including its final pages. */
export function sampleChapterPages<T>(groups: T[][], budget = 50): T[][] {
  if (groups.some((pages) => pages.length === 0) || groups.length > budget) {
    throw new Error("Every selected chapter must have source pages within the page limit.");
  }
  const counts = groups.map(() => 0);
  let remaining = budget;
  while (remaining > 0) {
    let allocated = false;
    for (let i = 0; i < groups.length && remaining > 0; i++) {
      if (counts[i] < groups[i].length) { counts[i]++; remaining--; allocated = true; }
    }
    if (!allocated) break;
  }
  return groups.map((pages, i) => Array.from({ length: counts[i] }, (_, j) =>
    pages[counts[i] === 1 ? 0 : Math.round(j * (pages.length - 1) / (counts[i] - 1))]
  ));
}
