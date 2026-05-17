import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// Cleanup script — deletes content for grades NOT in KEEP set.
// Removes: storage files (source-materials + worksheets buckets),
// then subject rows (DB cascade handles chapters/materials/worksheets).
// Grade rows themselves are preserved (reference data).
// ============================================================

const KEEP_GRADES = new Set([9, 10]);

// Load .env.local
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function listAllFiles(bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [prefix];
  while (stack.length) {
    const dir = stack.pop()!;
    const { data, error } = await supabase.storage.from(bucket).list(dir, { limit: 1000 });
    if (error) {
      console.warn(`    list error at ${bucket}/${dir}: ${error.message}`);
      continue;
    }
    for (const entry of data || []) {
      const full = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.id === null) {
        // folder
        stack.push(full);
      } else {
        out.push(full);
      }
    }
  }
  return out;
}

async function removeAll(bucket: string, paths: string[]): Promise<number> {
  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { data, error } = await supabase.storage.from(bucket).remove(batch);
    if (error) {
      console.warn(`    remove error: ${error.message}`);
    } else {
      removed += data?.length || 0;
    }
  }
  return removed;
}

async function main() {
  console.log(`Cleanup: keeping grades ${[...KEEP_GRADES].join(", ")}, deleting all others.\n`);

  const { data: grades, error: gErr } = await supabase.from("grades").select("id, number, name").order("number");
  if (gErr || !grades) throw new Error(`Failed to load grades: ${gErr?.message}`);

  const targets = grades.filter((g) => !KEEP_GRADES.has(g.number));
  console.log(`Target grades: ${targets.map((g) => g.number).join(", ")}\n`);

  let totalSubjectsDeleted = 0;
  let totalChaptersDeleted = 0;
  let totalSourceFiles = 0;
  let totalWorksheetFiles = 0;

  // Get all schools (for worksheets bucket prefixes)
  const { data: schools } = await supabase.from("schools").select("id");
  const schoolIds = (schools || []).map((s) => s.id);

  for (const grade of targets) {
    const { data: subjects } = await supabase.from("subjects").select("id, name").eq("grade_id", grade.id);
    if (!subjects || subjects.length === 0) {
      console.log(`Grade ${grade.number}: no subjects, skipping.`);
      continue;
    }

    const subjectIds = subjects.map((s) => s.id);
    const { data: chapters } = await supabase.from("chapters").select("id").in("subject_id", subjectIds);
    const chapterIds = (chapters || []).map((c) => c.id);

    console.log(`Grade ${grade.number}: ${subjects.length} subjects, ${chapterIds.length} chapters`);

    // Delete source-materials bucket files (keyed by chapter_id)
    let srcFiles = 0;
    for (const chapterId of chapterIds) {
      const files = await listAllFiles("source-materials", chapterId);
      if (files.length > 0) {
        srcFiles += await removeAll("source-materials", files);
      }
    }
    totalSourceFiles += srcFiles;

    // Delete worksheets bucket files (keyed by <schoolId>/<gradeName>)
    const gradeFolder = grade.name.replace(/\s+/g, "-");
    let wsFiles = 0;
    for (const schoolId of schoolIds) {
      const files = await listAllFiles("worksheets", `${schoolId}/${gradeFolder}`);
      if (files.length > 0) {
        wsFiles += await removeAll("worksheets", files);
      }
    }
    totalWorksheetFiles += wsFiles;

    // Delete subjects (cascades to chapters → source_materials → worksheets rows)
    const { error: delErr, count } = await supabase
      .from("subjects")
      .delete({ count: "exact" })
      .in("id", subjectIds);

    if (delErr) {
      console.error(`  ✗ delete subjects failed: ${delErr.message}`);
      continue;
    }
    totalSubjectsDeleted += count || 0;
    totalChaptersDeleted += chapterIds.length;

    console.log(`  ✓ removed ${srcFiles} source files, ${wsFiles} worksheet PDFs, ${count} subjects (cascaded ${chapterIds.length} chapters)`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("Cleanup summary:");
  console.log(`  Subjects deleted:        ${totalSubjectsDeleted}`);
  console.log(`  Chapters cascaded:       ${totalChaptersDeleted}`);
  console.log(`  Source-material files:   ${totalSourceFiles}`);
  console.log(`  Worksheet PDFs:          ${totalWorksheetFiles}`);
  console.log(`${"=".repeat(60)}`);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
