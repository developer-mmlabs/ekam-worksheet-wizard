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
// Question Count Configuration
// ============================================================

export interface QuestionCounts {
  mcq: number;
  fillInTheBlanks: number;
  matchTheFollowing: number;
  veryShort: number;
  shortAnswer: number;
  longAnswer: number;
}

export const QUESTION_COUNT_DEFAULTS: QuestionCounts = {
  mcq: 12,
  fillInTheBlanks: 0,
  matchTheFollowing: 0,
  veryShort: 8,
  shortAnswer: 6,
  longAnswer: 4,
};

export const QUESTION_COUNT_MINS: QuestionCounts = {
  mcq: 8,
  fillInTheBlanks: 0,
  matchTheFollowing: 0,
  veryShort: 5,
  shortAnswer: 3,
  longAnswer: 2,
};

// ============================================================
// API Types
// ============================================================

export interface GenerateRequest {
  chapterId: string;
  schoolId: string;
  questionCounts?: QuestionCounts;
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
}

export interface UploadRequest {
  chapterId: string;
  type: "textbook" | "past_paper";
  pageNumber: number;
}
