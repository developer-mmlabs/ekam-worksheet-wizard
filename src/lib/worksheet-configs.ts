import type { WorksheetConfigSpec, WorksheetConfigValues } from "@/types";

// ============================================================
// Per-(grade, subject) worksheet UI controls.
// Keys are "<gradeNumber>:<subjectSlug>", e.g. "10:mathematics".
// If a combo has no entry, the UI falls back to LEGACY_CONFIG.
// Control ids must match what the corresponding prompt builder reads.
// ============================================================

export const WORKSHEET_CONFIGS: Record<string, WorksheetConfigSpec> = {
  "10:mathematics": {
    controls: [
      { id: "sectionA",        label: "Section A — Short Answer Questions", default: 30, min: 15, max: 40 },
      { id: "assertionReason", label: "Section B — Assertion-Reason items", default: 6,  min: 4,  max: 8 },
      { id: "caseStudy",       label: "Section C — Case Studies",           default: 2,  min: 1,  max: 3 },
    ],
    helperText: "CBSE Class 10 chapter-wise practice format: short-answer pool + Assertion-Reason + Case Study.",
  },
  "10:science": {
    controls: [
      { id: "sectionA",        label: "Section A — Short Answer Questions", default: 30, min: 15, max: 40 },
      { id: "assertionReason", label: "Section B — Assertion-Reason items", default: 6,  min: 4,  max: 8 },
      { id: "caseStudy",       label: "Section C — Case Studies",           default: 2,  min: 1,  max: 3 },
    ],
    helperText: "CBSE Class 10 chapter-wise practice format: short-answer pool + Assertion-Reason + Case Study.",
  },
  "10:social_studies": {
    controls: [
      { id: "sectionA",        label: "Section A — Short Answer Questions",        default: 30, min: 15, max: 40 },
      { id: "assertionReason", label: "Section B — Assertion-Reason items",        default: 6,  min: 4,  max: 8 },
      { id: "caseStudy",       label: "Section C — Source-Based Extracts",         default: 2,  min: 1,  max: 3 },
    ],
    helperText: "CBSE Class 10 chapter-wise practice format: short-answer pool + Assertion-Reason + Source-Based.",
  },
  "10:english": {
    controls: [
      { id: "sectionA",        label: "Section A — Short Answer / Reading", default: 30, min: 15, max: 40 },
      { id: "assertionReason", label: "Section B — Grammar items",          default: 6,  min: 4,  max: 8 },
      { id: "caseStudy",       label: "Section C — Literature Extracts",    default: 1,  min: 1,  max: 2 },
    ],
    helperText: "CBSE Class 10 chapter-wise practice format: reading + grammar + literature extract.",
  },
  "10:hindi": {
    controls: [
      { id: "sectionA",        label: "खंड A — लघु उत्तरीय प्रश्न",   default: 30, min: 15, max: 40 },
      { id: "assertionReason", label: "खंड B — व्याकरण प्रश्न",       default: 6,  min: 4,  max: 8 },
      { id: "caseStudy",       label: "खंड C — पाठ्यांश आधारित प्रश्न", default: 1,  min: 1,  max: 2 },
    ],
    helperText: "CBSE कक्षा 10 अध्यायवार अभ्यास प्रारूप: लघु उत्तरीय + व्याकरण + पाठ्यांश।",
  },
};

// Default UI for any (grade, subject) not yet in WORKSHEET_CONFIGS.
// Mirrors the historical six-count breakdown so unsupported grades still work.
export const LEGACY_CONFIG: WorksheetConfigSpec = {
  controls: [
    { id: "mcq",                label: "MCQ",                  hint: "1 mark each",  default: 12, min: 8,  max: 25 },
    { id: "fillInTheBlanks",    label: "Fill in the Blanks",   hint: "1 mark each",  default: 0,  min: 0,  max: 15 },
    { id: "matchTheFollowing",  label: "Match the Following",  hint: "4 marks each", default: 0,  min: 0,  max: 5 },
    { id: "veryShort",          label: "Very Short Answer",    hint: "1 mark each",  default: 8,  min: 5,  max: 15 },
    { id: "shortAnswer",        label: "Short Answer",         hint: "3 marks each", default: 6,  min: 3,  max: 15 },
    { id: "longAnswer",         label: "Long Answer",          hint: "5 marks each", default: 4,  min: 2,  max: 10 },
  ],
};

export function getWorksheetConfigSpec(
  gradeNumber: number,
  subjectSlug: string,
): WorksheetConfigSpec {
  return WORKSHEET_CONFIGS[`${gradeNumber}:${subjectSlug}`] ?? LEGACY_CONFIG;
}

export function defaultConfigValues(spec: WorksheetConfigSpec): WorksheetConfigValues {
  return Object.fromEntries(spec.controls.map((c) => [c.id, c.default]));
}
