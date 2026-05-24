// ============================================================
// Database Types
// ============================================================

export interface School {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  location: string;
  academic_year: string;
  created_at: string;
  updated_at: string;
}

export interface Grade {
  id: string;
  number: number; // 1-12
  name: string; // "Grade 1", "Grade 2", etc.
  band: GradeBand;
  created_at: string;
}

export type GradeBand = "primary" | "middle" | "senior";

export interface Subject {
  id: string;
  name: string;
  slug: string; // "science", "mathematics", etc.
  grade_id: string;
  created_at: string;
}

export interface Chapter {
  id: string;
  number: number;
  name: string;
  subject_id: string;
  created_at: string;
}

export interface SourceMaterial {
  id: string;
  chapter_id: string;
  type: "textbook" | "past_paper";
  file_url: string;
  page_number: number;
  file_name: string;
  created_at: string;
}

export type WorksheetStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Worksheet {
  id: string;
  chapter_id: string;
  school_id: string;
  pdf_url: string | null;
  questions_json: WorksheetQuestions;
  page_count: number;
  status: WorksheetStatus;
  error_message: string | null;
  set_number: number; // 1, 2, or 3
  is_finalized: boolean;
  finalized_at: string | null;
  created_at: string;
}

// ============================================================
// AI Pipeline Types
// ============================================================

export interface WorksheetQuestions {
  metadata: {
    grade: string;
    subject: string;
    chapter: string;
    totalQuestions: number;
  };
  sections: QuestionSection[];
}

export interface QuestionSection {
  id: string; // "A", "B", "C"
  title: string; // "Short Answer Questions"
  type: SectionType;
  instructions?: string; // Printed once at top of section (e.g. assertion-reason direction key)
  questions?: Question[]; // For non-case-study sections
  caseStudies?: CaseStudy[]; // Only when type === "case_study"
}

export type QuestionType =
  | "mcq"
  | "fill_in_the_blanks"
  | "match_the_following"
  | "very_short"
  | "short_answer"
  | "long_answer"
  | "assertion_reason";

export type SectionType = QuestionType | "case_study";

export interface CaseStudy {
  number: number;
  stimulus: string;
  questions: Question[];
  imagePrompt?: string; // AI image generation prompt
  imageSvg?: SvgDiagram; // Math-exact SVG diagram, rendered directly via react-pdf primitives
  imageUrl?: string; // Populated after image gen + upload. Consumed by PDF renderer.
}

// ============================================================
// SVG diagram primitives (Track D — math-exact diagrams)
// LLM emits a JSON description of shapes; renderer maps to react-pdf
// Svg components. Coordinates are in viewBox-space (not points).
// ============================================================

export type SvgShape =
  | {
      type: "circle";
      cx: number;
      cy: number;
      r: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
    }
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
    }
  | {
      type: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      stroke?: string;
      strokeWidth?: number;
      strokeDasharray?: string;
    }
  | {
      type: "path";
      d: string; // SVG path data (M, L, A, Q, C, Z commands)
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
    }
  | {
      type: "polygon";
      points: string; // "x1,y1 x2,y2 x3,y3 ..."
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
    }
  | {
      type: "text";
      x: number;
      y: number;
      text: string;
      fontSize?: number;
      textAnchor?: "start" | "middle" | "end";
      fill?: string;
    };

export interface SvgDiagram {
  viewBox: string; // e.g. "0 0 200 200" — square recommended for case studies
  shapes: SvgShape[];
}

export interface Question {
  number: number;
  text: string;
  marks?: number;
  options?: MCQOption[]; // Only for MCQ type
  matchPairs?: MatchPair[]; // Only for match_the_following type
  subparts?: string[]; // For multi-part questions (a, b, c)
  orQuestion?: Question; // Alternative OR question
  hasFormula?: boolean; // Contains LaTeX/math
  assertion?: string; // Only for assertion_reason type
  reason?: string; // Only for assertion_reason type
}

export interface MatchPair {
  left: string;
  right: string;
}

export interface MCQOption {
  label: string; // "a", "b", "c", "d"
  text: string;
}

// ============================================================
// PDF Template Types
// ============================================================

export interface DecorationLayout {
  cornerCount: 1 | 2 | 4;
  cornerSize: number;
  marginSide: "both" | "left" | "right";
  marginIconCount: number;
  marginIconSize: number;
  patternGridSpacing: number;
  patternTileSize: number;
  patternOpacity: number;
  cornerOpacity: number;
  marginOpacity: number;
  strokeWidth: number;
  colorMode: "tricolor" | "duotone" | "mono";
}

export interface TemplateTheme {
  gradeBand: GradeBand;
  subject: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  headerColor: string;
  sectionHeaderColor: string;
  fontFamily: string;
  decorativeOpacity: number; // ~0.06 for light backgrounds
  decorationLayout: DecorationLayout;
}

export interface WorksheetPDFData {
  school: School;
  grade: Grade;
  subject: Subject;
  chapter: Chapter;
  questions: WorksheetQuestions;
  worksheetNumber: number;
  theme: TemplateTheme;
}

// ============================================================
// Worksheet Configuration (per grade + subject)
// ============================================================

export interface WorksheetControl {
  id: string; // key in config values map
  label: string;
  default: number;
  min: number;
  max: number;
  hint?: string; // optional secondary label (e.g. "1 mark each")
}

export interface WorksheetConfigSpec {
  controls: WorksheetControl[];
  helperText?: string;
}

// Values keyed by control id (e.g. { sectionA: 30, assertionReason: 6, caseStudy: 2 })
export type WorksheetConfigValues = Record<string, number>;

// ============================================================
// API Types
// ============================================================

export interface GenerateRequest {
  chapterId: string;
  schoolId: string;
  config?: WorksheetConfigValues;
  sectionOrder?: string[]; // Control ids in the order the user wants the sections to appear
}

export interface GenerateResponse {
  success: boolean;
  worksheetId?: string;
  error?: string;
}

export interface WorksheetStatusResponse {
  id: string;
  status: WorksheetStatus;
  pdfUrl: string | null;
  errorMessage: string | null;
  questionCount: number | null;
  pageCount: number | null;
  setNumber: number;
  isFinalized: boolean;
  questionsJson?: WorksheetQuestions; // Included when ?include=questions
}

export interface FinalizeRequest {
  worksheetId: string;
}

export interface FinalizeResponse {
  success: boolean;
  nextSetNumber: number | null; // null if all 3 finalized
  error?: string;
}

export interface ChapterStatusResponse {
  worksheets: Array<{
    id: string;
    setNumber: number;
    status: WorksheetStatus;
    isFinalized: boolean;
    pdfUrl: string | null;
    createdAt: string;
  }>;
  nextSetNumber: number | null; // next available slot (null if all 3 finalized)
}

export interface QuestionEditRequest {
  worksheetId: string;
  updates: QuestionUpdate[];
}

export interface QuestionUpdate {
  sectionIndex: number;
  questionIndex: number;
  caseStudyIndex?: number; // if editing a case study sub-question
  changes: Partial<Question>;
}

export interface UploadRequest {
  chapterId: string;
  type: "textbook" | "past_paper";
  pageNumber: number;
}

// ============================================================
// Helpers
// ============================================================

/** Flatten all question texts from a WorksheetQuestions object for deduplication. */
export function flattenQuestionsForDedup(wq: WorksheetQuestions): string[] {
  const texts: string[] = [];
  for (const section of wq.sections) {
    if (section.questions) {
      for (const q of section.questions) {
        texts.push(q.text);
        if (q.assertion) texts.push(`Assertion: ${q.assertion}`);
        if (q.reason) texts.push(`Reason: ${q.reason}`);
      }
    }
    if (section.caseStudies) {
      for (const cs of section.caseStudies) {
        texts.push(cs.stimulus);
        for (const q of cs.questions) {
          texts.push(q.text);
        }
      }
    }
  }
  return texts;
}
