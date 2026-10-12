import { createHash } from "node:crypto";
import { getWorksheetConfigSpec } from "@/lib/worksheet-configs";
import type { GenerationContext } from "./question-generator";
import type { Question, QuestionSection, SectionType, WorksheetConfigValues, WorksheetQuestions } from "@/types";

// Bump when page extraction or checkpoint validation semantics change.
export const MULTI_VERSION = "1";
export const MAX_MULTI_PAGES = 400;
export const MAX_TEXT_BYTES = 48_000; // Conservative even for Devanagari/tokenizers with poor text compression.
export type Batch = { chapterIndex: number; control: string; count: number; index: number };
const types: Record<string, SectionType> = {
  sectionA: "short_answer", assertionReason: "assertion_reason", caseStudy: "case_study",
  mcq: "mcq", fillInTheBlanks: "fill_in_the_blanks", matchTheFollowing: "match_the_following",
  veryShort: "very_short", longAnswer: "long_answer",
};
export function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function planBatches(chapterCount: number, config: WorksheetConfigValues, order: string[]): Batch[] {
  const allocation = Array.from({ length: chapterCount }, () => ({} as WorksheetConfigValues));
  let cursor = 0;
  for (const control of order) {
    const count = config[control] ?? 0;
    if (!types[control] || !Number.isInteger(count) || count < 0) throw new Error("Invalid question configuration.");
    for (let i = 0; i < count; i++, cursor++) {
      const chapter = allocation[cursor % chapterCount];
      chapter[control] = (chapter[control] ?? 0) + 1;
    }
  }
  if (chapterCount < 2 || allocation.some((chapter) => !Object.keys(chapter).length)) {
    throw new Error("Choose at least one question or case study per selected chapter.");
  }
  const batches: Batch[] = [];
  allocation.forEach((chapter, chapterIndex) => {
    for (const control of order) {
      const size = control === "caseStudy" ? 1 : 4;
      for (let remaining = chapter[control] ?? 0; remaining > 0; remaining -= size) {
        batches.push({ chapterIndex, control, count: Math.min(size, remaining), index: batches.length });
      }
    }
  });
  return batches;
}

export function controlOrder(context: GenerationContext, requested?: string[]): string[] {
  const defaults = getWorksheetConfigSpec(context.gradeNumber, context.subjectSlug).controls.map((c) => c.id);
  return [...new Set([...(requested ?? []).filter((id) => defaults.includes(id)), ...defaults])];
}

export function sectionType(control: string, context: GenerationContext): SectionType {
  return control === "assertionReason" && ["hindi", "english"].includes(context.subjectSlug)
    ? "short_answer" : types[control];
}

const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
export const normalizeQuestion = (text: string) => text.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{Z}\s]+/gu, " ").trim();

function validateQuestion(q: Question, type?: SectionType) {
  if (!q || (type !== "assertion_reason" && !nonempty(q.text))) throw new Error("AI returned an empty question.");
  if (type === "mcq" || q.options) {
    if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => !nonempty(o.text) || !nonempty(o.label))
      || new Set(q.options.map((o) => o.label)).size !== 4) throw new Error("AI returned invalid multiple-choice options.");
  }
  if (type === "assertion_reason" && (!nonempty(q.assertion) || !nonempty(q.reason))) throw new Error("AI omitted assertion/reason text.");
  if (type === "match_the_following" && (!Array.isArray(q.matchPairs) || q.matchPairs.length < 2
    || q.matchPairs.some((p) => !nonempty(p.left) || !nonempty(p.right)))) throw new Error("AI returned invalid matching pairs.");
  if (q.orQuestion) validateQuestion(q.orQuestion);
}

export function questionTexts(section: QuestionSection): string[] {
  // Include the passage in case-study identity: generic subquestions may legitimately repeat across passages.
  return section.caseStudies?.map((cs) => `${cs.stimulus} ${cs.questions.map((q) => q.text).join(" ")}`)
    ?? (section.questions ?? []).map((q) => q.assertion ? `${q.assertion} ${q.reason}` : q.text);
}

export function validateBatch(value: Pick<WorksheetQuestions, "sections">, batch: Batch, context: GenerationContext, previous: string[]): QuestionSection {
  if (!Array.isArray(value?.sections) || value.sections.length !== 1) throw new Error("AI must return exactly the requested section.");
  const section = value.sections[0];
  if (section.type !== sectionType(batch.control, context) || !nonempty(section.title)) throw new Error("AI returned the wrong question type.");
  if (section.type === "case_study") {
    if (!Array.isArray(section.caseStudies) || section.caseStudies.length !== batch.count || section.questions?.length) throw new Error("AI returned the wrong case-study count.");
    for (const cs of section.caseStudies) {
      if (!nonempty(cs.stimulus) || !Array.isArray(cs.questions) || cs.questions.length < 3 || cs.questions.length > 5) throw new Error("AI returned an incomplete case study.");
      cs.questions.forEach((q) => validateQuestion(q));
    }
  } else {
    if (!Array.isArray(section.questions) || section.questions.length !== batch.count || section.caseStudies?.length) throw new Error("AI returned the wrong question count.");
    section.questions.forEach((q) => validateQuestion(q, section.type));
  }
  const seen = new Set(previous.map(normalizeQuestion));
  for (const text of questionTexts(section)) {
    const key = normalizeQuestion(text);
    if (seen.has(key)) throw new Error("AI repeated an existing question. Retry this batch.");
    seen.add(key);
  }
  return section;
}

export function combineBatches(results: { batch: Batch; section: QuestionSection }[], plan: Batch[], order: string[], context: GenerationContext): WorksheetQuestions {
  if (results.length !== plan.length || plan.some((b, i) => fingerprint(results[i].batch) !== fingerprint(b))) throw new Error("Some chapter questions are missing; PDF generation stopped.");
  const sections: QuestionSection[] = [];
  for (const control of order) {
    const parts = results.filter((r) => r.batch.control === control).map((r) => r.section);
    if (!parts.length) continue;
    const section = structuredClone(parts[0]);
    Reflect.deleteProperty(section, "sourceChapterId");
    Reflect.deleteProperty(section, "sourcePageIds");
    Reflect.deleteProperty(section, "referencePageIds");
    Object.assign(section, { sources: parts.map((part) => ({
      chapterId: Reflect.get(part, "sourceChapterId"), referencePageIds: Reflect.get(part, "referencePageIds"),
    })) });
    section.id = String.fromCharCode(65 + sections.length);
    if (section.type === "case_study") {
      section.caseStudies = parts.flatMap((p) => structuredClone(p.caseStudies ?? []));
      section.caseStudies.forEach((cs, i) => { cs.number = i + 1; cs.questions.forEach((q, j) => { q.number = j + 1; }); });
    } else {
      section.questions = parts.flatMap((p) => structuredClone(p.questions ?? []));
      section.questions.forEach((q, i) => { q.number = i + 1; });
    }
    sections.push(section);
  }
  return { metadata: { grade: context.gradeName, subject: context.subjectName, chapter: context.chapterName,
    chapters: context.chapters, totalQuestions: sections.reduce((sum, s) => sum + (s.caseStudies?.reduce((n, c) => n + c.questions.length, 0) ?? s.questions?.length ?? 0), 0) }, sections };
}
