import type { WorksheetConfigSpec, WorksheetConfigValues, WorksheetControl } from "@/types";

// ============================================================
// Per-(grade, subject) worksheet UI controls.
// Keys are "<gradeNumber>:<subjectSlug>", e.g. "10:mathematics".
// If a combo has no entry, the UI falls back to LEGACY_CONFIG.
// Control ids must match what the corresponding prompt builder reads.
// ============================================================

// Optional add-on question types — available across all Class 10 subjects.
// Defaults to 0 so the standard CBSE A/B/C pattern is unchanged unless
// the teacher explicitly enables one of these.
const CLASS10_ADDON_CONTROLS: WorksheetControl[] = [
  { id: "mcq",               label: "MCQ",                       default: 0, min: 0, max: 25 },
  { id: "fillInTheBlanks",   label: "Fill in the Blanks",        default: 0, min: 0, max: 15 },
  { id: "matchTheFollowing", label: "Match the Following",       default: 0, min: 0, max: 5 },
  { id: "veryShort",         label: "Very Short Answer",         default: 0, min: 0, max: 15 },
  { id: "longAnswer",        label: "Long Answer / Numerical",   default: 0, min: 0, max: 10 },
];

export const WORKSHEET_CONFIGS: Record<string, WorksheetConfigSpec> = {
  "10:mathematics": {
    controls: [
      { id: "sectionA",        label: "Short Answer Questions", default: 20, min: 0, max: 35 },
      { id: "assertionReason", label: "Assertion-Reason items", default: 10, min: 0, max: 15 },
      { id: "caseStudy",       label: "Case Studies",           default: 4,  min: 0, max: 6 },
      ...CLASS10_ADDON_CONTROLS,
    ],
    helperText: "CBSE Class 10 chapter-wise practice format. Set any question type to 0 to omit it; sections appear in the order they are listed.",
  },
  "10:science": {
    controls: [
      { id: "sectionA",        label: "Short Answer Questions", default: 20, min: 0, max: 35 },
      { id: "assertionReason", label: "Assertion-Reason items", default: 10, min: 0, max: 15 },
      { id: "caseStudy",       label: "Case Studies",           default: 4,  min: 0, max: 6 },
      ...CLASS10_ADDON_CONTROLS,
    ],
    helperText: "CBSE Class 10 chapter-wise practice format. Set any question type to 0 to omit it; sections appear in the order they are listed.",
  },
  "10:social_studies": {
    controls: [
      { id: "sectionA",        label: "Short Answer Questions",  default: 20, min: 0, max: 35 },
      { id: "assertionReason", label: "Assertion-Reason items",  default: 10, min: 0, max: 15 },
      { id: "caseStudy",       label: "Source-Based Extracts",   default: 4,  min: 0, max: 6 },
      ...CLASS10_ADDON_CONTROLS,
    ],
    helperText: "CBSE Class 10 chapter-wise practice format. Set any question type to 0 to omit it; sections appear in the order they are listed.",
  },
  "10:english": {
    controls: [
      { id: "sectionA",        label: "Short Answer / Reading", default: 20, min: 0, max: 35 },
      { id: "assertionReason", label: "Grammar items",          default: 10, min: 0, max: 15 },
      { id: "caseStudy",       label: "Literature Extracts",    default: 2,  min: 0, max: 4 },
      ...CLASS10_ADDON_CONTROLS,
    ],
    helperText: "CBSE Class 10 chapter-wise practice format. Set any question type to 0 to omit it; sections appear in the order they are listed.",
  },
  "10:hindi": {
    controls: [
      { id: "sectionA",        label: "लघु उत्तरीय प्रश्न",     default: 20, min: 0, max: 35 },
      { id: "assertionReason", label: "व्याकरण प्रश्न",         default: 10, min: 0, max: 15 },
      { id: "caseStudy",       label: "पाठ्यांश आधारित प्रश्न",  default: 2,  min: 0, max: 4 },
      ...CLASS10_ADDON_CONTROLS,
    ],
    helperText: "CBSE कक्षा 10 अध्यायवार अभ्यास प्रारूप। किसी भी प्रकार को 0 करके हटाएं; अनुभाग सूची के क्रम में दिखेंगे।",
  },
};

// Default UI for any (grade, subject) not yet in WORKSHEET_CONFIGS.
export const LEGACY_CONFIG: WorksheetConfigSpec = {
  controls: [
    { id: "mcq",                label: "MCQ",                  default: 12, min: 0, max: 25 },
    { id: "fillInTheBlanks",    label: "Fill in the Blanks",   default: 0,  min: 0, max: 15 },
    { id: "matchTheFollowing",  label: "Match the Following",  default: 0,  min: 0, max: 5 },
    { id: "veryShort",          label: "Very Short Answer",    default: 8,  min: 0, max: 15 },
    { id: "longAnswer",         label: "Long Answer",          default: 4,  min: 0, max: 10 },
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
