import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

// SQL to create all tables
const SCHEMA_SQL = `
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subjects_grade ON subjects(grade_id);
CREATE INDEX IF NOT EXISTS idx_chapters_subject ON chapters(subject_id);
CREATE INDEX IF NOT EXISTS idx_source_materials_chapter ON source_materials(chapter_id);
CREATE INDEX IF NOT EXISTS idx_worksheets_chapter ON worksheets(chapter_id);
CREATE INDEX IF NOT EXISTS idx_worksheets_status ON worksheets(status);
`;

// Seed grades data
const SEED_GRADES_SQL = `
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
`;

export async function POST() {
  const results: string[] = [];

  try {
    // Step 1: Create storage buckets
    const buckets = ["source-materials", "worksheets", "school-assets"];
    for (const bucket of buckets) {
      const { error } = await supabaseAdmin.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024, // 10MB
      });
      if (error && !error.message.includes("already exists")) {
        results.push(`Bucket '${bucket}': ERROR - ${error.message}`);
      } else {
        results.push(`Bucket '${bucket}': OK`);
      }
    }

    // Step 2: Create tables via RPC
    // We use the supabase client to execute raw SQL via a helper function
    // First, try to create a helper RPC function
    const { error: rpcError } = await supabaseAdmin.rpc("exec_sql", {
      query: SCHEMA_SQL,
    });

    if (rpcError) {
      // If exec_sql doesn't exist, we'll need to create tables via individual inserts
      // Try creating tables one-by-one using the REST API
      results.push(`SQL exec via RPC: ${rpcError.message}`);
      results.push("NOTE: Please run the SQL schema manually via the Supabase dashboard SQL editor.");
      results.push("The SQL is available at GET /api/setup");
    } else {
      results.push("Schema tables: Created successfully");

      // Step 3: Seed grades
      const { error: seedError } = await supabaseAdmin.rpc("exec_sql", {
        query: SEED_GRADES_SQL,
      });
      if (seedError) {
        results.push(`Seed grades: ${seedError.message}`);
      } else {
        results.push("Seed grades: OK");
      }
    }

    // Step 3: Insert default school (only if none exists)
    const { data: existingSchools } = await supabaseAdmin
      .from("schools")
      .select("id")
      .limit(1);

    if (!existingSchools || existingSchools.length === 0) {
      const { error: schoolError } = await supabaseAdmin
        .from("schools")
        .insert({
          name: "EKAM INSTITUTIONS",
          primary_color: "#0ea5e9",
          secondary_color: "#0369a1",
          location: "E-CITY, BENGALURU",
          academic_year: "2026-27",
        })
        .select()
        .single();

      if (schoolError) {
        results.push(`Default school: ${schoolError.message} (run schema SQL first)`);
      } else {
        results.push("Default school: Created");
      }
    } else {
      results.push("Default school: Already exists, skipped");
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error), results },
      { status: 500 }
    );
  }
}

// GET returns the raw SQL for manual execution in Supabase dashboard
export async function GET() {
  const fullSQL = `
-- ============================================================
-- Worksheet Wizard - Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/bouquocyaneesufpxqqq/sql
-- ============================================================

-- First, create the exec_sql helper function for programmatic access
CREATE OR REPLACE FUNCTION exec_sql(query text) RETURNS void AS $$
BEGIN
  EXECUTE query;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

${SCHEMA_SQL}

${SEED_GRADES_SQL}

-- Insert default school
INSERT INTO schools (name, primary_color, secondary_color, location, academic_year)
VALUES ('EKAM INSTITUTIONS', '#0ea5e9', '#0369a1', 'E-CITY, BENGALURU', '2026-27')
ON CONFLICT DO NOTHING;

-- Enable RLS (but allow all access for now - add proper policies in production)
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE worksheets ENABLE ROW LEVEL SECURITY;

-- Permissive policies for development
CREATE POLICY IF NOT EXISTS "Allow all on schools" ON schools FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all on grades" ON grades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all on subjects" ON subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all on chapters" ON chapters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all on source_materials" ON source_materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Allow all on worksheets" ON worksheets FOR ALL USING (true) WITH CHECK (true);
  `;

  return new Response(fullSQL, {
    headers: { "Content-Type": "text/plain" },
  });
}
