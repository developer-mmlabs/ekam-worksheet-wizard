-- ============================================================
-- Worksheet Wizard - Database Schema
-- ============================================================

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My School',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#0ea5e9',
  secondary_color TEXT NOT NULL DEFAULT '#0369a1',
  location TEXT NOT NULL DEFAULT '',
  academic_year TEXT NOT NULL DEFAULT '2026-27',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grades table
CREATE TABLE IF NOT EXISTS grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  band TEXT NOT NULL CHECK (band IN ('primary', 'middle', 'senior')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subjects table
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  grade_id UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slug, grade_id)
);

-- Chapters table
CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL,
  name TEXT NOT NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(number, subject_id)
);

-- Source materials table
CREATE TABLE IF NOT EXISTS source_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('textbook', 'past_paper')),
  file_url TEXT NOT NULL,
  page_number INTEGER NOT NULL DEFAULT 1,
  file_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Worksheets table
CREATE TABLE IF NOT EXISTS worksheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  pdf_url TEXT,
  questions_json JSONB NOT NULL DEFAULT '{}',
  page_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  set_number INTEGER NOT NULL DEFAULT 1 CHECK (set_number BETWEEN 1 AND 3),
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subjects_grade ON subjects(grade_id);
CREATE INDEX IF NOT EXISTS idx_chapters_subject ON chapters(subject_id);
CREATE INDEX IF NOT EXISTS idx_source_materials_chapter ON source_materials(chapter_id);
CREATE INDEX IF NOT EXISTS idx_worksheets_chapter ON worksheets(chapter_id);
CREATE INDEX IF NOT EXISTS idx_worksheets_status ON worksheets(status);
CREATE INDEX IF NOT EXISTS idx_worksheets_chapter_school ON worksheets(chapter_id, school_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_worksheets_unique_set ON worksheets(chapter_id, school_id, set_number) WHERE is_finalized = true;

-- Seed grades
INSERT INTO grades (number, name, band) VALUES
  (1, 'Grade 1', 'primary'),
  (2, 'Grade 2', 'primary'),
  (3, 'Grade 3', 'primary'),
  (4, 'Grade 4', 'primary'),
  (5, 'Grade 5', 'primary'),
  (6, 'Grade 6', 'middle'),
  (7, 'Grade 7', 'middle'),
  (8, 'Grade 8', 'middle'),
  (9, 'Grade 9', 'middle'),
  (10, 'Grade 10', 'senior'),
  (11, 'Grade 11', 'senior'),
  (12, 'Grade 12', 'senior')
ON CONFLICT (number) DO NOTHING;

-- Insert default school
INSERT INTO schools (name, primary_color, secondary_color, location, academic_year)
VALUES ('EKAM INSTITUTIONS', '#0ea5e9', '#0369a1', 'E-CITY, BENGALURU', '2026-27');

-- Enable RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE worksheets ENABLE ROW LEVEL SECURITY;

-- Permissive policies (all access for development)
DO $$
BEGIN
  -- schools
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'schools' AND policyname = 'allow_all_schools') THEN
    CREATE POLICY allow_all_schools ON schools FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- grades
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'grades' AND policyname = 'allow_all_grades') THEN
    CREATE POLICY allow_all_grades ON grades FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- subjects
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subjects' AND policyname = 'allow_all_subjects') THEN
    CREATE POLICY allow_all_subjects ON subjects FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- chapters
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'chapters' AND policyname = 'allow_all_chapters') THEN
    CREATE POLICY allow_all_chapters ON chapters FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- source_materials
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'source_materials' AND policyname = 'allow_all_source_materials') THEN
    CREATE POLICY allow_all_source_materials ON source_materials FOR ALL USING (true) WITH CHECK (true);
  END IF;
  -- worksheets
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'worksheets' AND policyname = 'allow_all_worksheets') THEN
    CREATE POLICY allow_all_worksheets ON worksheets FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
