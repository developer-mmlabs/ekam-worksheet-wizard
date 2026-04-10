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

export interface Worksheet {
  id: string;
  chapter_id: string;
  school_id: string;
  pdf_url: string | null;
  questions_json: WorksheetQuestions;
  page_count: number;
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
  id: string; // "A", "B", "C", "D"
  title: string; // "Multiple Choice Questions"
  type: QuestionType;
  questions: Question[];
}

export type QuestionType = "mcq" | "very_short" | "short_answer" | "long_answer";

export interface Question {
  number: number;
  text: string;
  marks?: number;
  options?: MCQOption[]; // Only for MCQ type
  subparts?: string[]; // For multi-part questions (a, b, c)
  orQuestion?: Question; // Alternative OR question
  hasFormula?: boolean; // Contains LaTeX/math
}

export interface MCQOption {
  label: string; // "a", "b", "c", "d"
  text: string;
}

// ============================================================
// PDF Template Types
// ============================================================

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
// API Types
// ============================================================

export interface GenerateRequest {
  chapterId: string;
  schoolId: string;
}

export interface GenerateResponse {
  success: boolean;
  pdfUrl?: string;
  pdfBase64?: string;
  error?: string;
  questionCount?: number;
  pageCount?: number;
}

export interface UploadRequest {
  chapterId: string;
  type: "textbook" | "past_paper";
  pageNumber: number;
}
