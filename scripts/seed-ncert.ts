import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// NCERT Textbook Seed Script
// Reads from ncert-textbook-images/ and populates the database
// with subjects, chapters, and uploads page images to storage.
// Idempotent — safe to re-run.
// ============================================================

// Load .env.local since we're outside Next.js
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

const IMAGES_DIR = path.resolve(__dirname, "../ncert-textbook-images");

// Map folder names to display names and slugs (must match theme system)
const SUBJECT_MAP: Record<string, { name: string; slug: string }> = {
  English: { name: "English", slug: "english" },
  Hindi: { name: "Hindi", slug: "hindi" },
  Mathematics: { name: "Mathematics", slug: "mathematics" },
  Science: { name: "Science", slug: "science" },
  "Social-Science": { name: "Social Science", slug: "social_studies" },
  "The-World-Around-Us": { name: "Environmental Studies", slug: "evs" },
  Physics: { name: "Physics", slug: "physics" },
  Chemistry: { name: "Chemistry", slug: "chemistry" },
  Biology: { name: "Biology", slug: "biology" },
  "Computer-Science": { name: "Computer Science", slug: "computer_science" },
};

// Chapters to skip (non-teaching content)
const SKIP_CHAPTERS = new Set([
  "Prelims",
  "Annexure",
  "Appendix",
  "Glossary",
  "Bibliography",
  "Answer-Key",
]);

// ============================================================
// Helpers
// ============================================================

function getClassNumber(className: string): number {
  return parseInt(className.replace("Class-", ""));
}

function getChapterNumber(chapterName: string): number {
  const match = chapterName.match(/Chapter-(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function getBookDisplayName(bookFolder: string): string {
  // Clean up book folder names for display
  return bookFolder
    .replace(/-(English)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface BookChapter {
  bookName: string;
  chapterFolder: string;
  chapterNum: number;
  pagesPath: string;
}

// ============================================================
// Main seed function
// ============================================================

async function seed() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   NCERT Textbook Content Seeder          ║");
  console.log("╚══════════════════════════════════════════╝\n");

  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variables");
    process.exit(1);
  }

  // Verify images directory exists
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`Images directory not found: ${IMAGES_DIR}`);
    console.error("Run convert-ncert-to-images.sh first.");
    process.exit(1);
  }

  // Load all grades from database
  const { data: grades, error: gradeError } = await supabase
    .from("grades")
    .select("*")
    .order("number");

  if (gradeError || !grades?.length) {
    console.error("No grades found. Run database setup first: POST /api/setup");
    process.exit(1);
  }

  const gradeMap = new Map(grades.map((g) => [g.number, g]));
  console.log(`Found ${grades.length} grades in database.\n`);

  // Filter to specific grades if passed via CLI args (e.g., `npm run seed:ncert -- 2 4 7 10`)
  const cliGrades = process.argv.slice(2).map(Number).filter(Boolean);
  if (cliGrades.length > 0) {
    console.log(`Filtering to grades: ${cliGrades.join(", ")}\n`);
  }

  // Scan the images directory
  const classDirs = fs
    .readdirSync(IMAGES_DIR)
    .filter((d) => {
      if (!d.startsWith("Class-") || !fs.statSync(path.join(IMAGES_DIR, d)).isDirectory()) return false;
      if (cliGrades.length > 0) return cliGrades.includes(getClassNumber(d));
      return true;
    })
    .sort((a, b) => getClassNumber(a) - getClassNumber(b));

  let totalSubjects = 0;
  let totalChapters = 0;
  let totalPages = 0;
  let skippedSubjects = 0;
  let skippedChapters = 0;

  for (const classDir of classDirs) {
    const classNum = getClassNumber(classDir);
    const grade = gradeMap.get(classNum);

    if (!grade) {
      console.warn(`⚠ Grade ${classNum} not found in database, skipping ${classDir}`);
      continue;
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📚 ${grade.name} (${grade.band})`);
    console.log(`${"=".repeat(60)}`);

    const classPath = path.join(IMAGES_DIR, classDir);
    const subjectDirs = fs
      .readdirSync(classPath)
      .filter((d) => fs.statSync(path.join(classPath, d)).isDirectory())
      .sort();

    for (const subjectDir of subjectDirs) {
      const subjectInfo = SUBJECT_MAP[subjectDir];
      if (!subjectInfo) {
        console.warn(`  ⚠ Unknown subject folder: ${subjectDir}, skipping`);
        skippedSubjects++;
        continue;
      }

      console.log(`\n  📖 ${subjectInfo.name} (${subjectInfo.slug})`);

      // Upsert subject
      const { data: subject, error: subjectError } = await supabase
        .from("subjects")
        .upsert(
          { name: subjectInfo.name, slug: subjectInfo.slug, grade_id: grade.id },
          { onConflict: "slug,grade_id" }
        )
        .select()
        .single();

      if (subjectError || !subject) {
        console.error(`  ✗ Failed to create subject: ${subjectError?.message}`);
        continue;
      }
      totalSubjects++;

      // Collect all chapters across all books for this subject
      const subjectPath = path.join(classPath, subjectDir);
      const bookDirs = fs
        .readdirSync(subjectPath)
        .filter((d) => fs.statSync(path.join(subjectPath, d)).isDirectory())
        .sort();

      const allChapters: BookChapter[] = [];

      for (const bookDir of bookDirs) {
        const bookPath = path.join(subjectPath, bookDir);
        const chapterDirs = fs
          .readdirSync(bookPath)
          .filter(
            (d) =>
              d.startsWith("Chapter-") &&
              fs.statSync(path.join(bookPath, d)).isDirectory()
          )
          .sort((a, b) => getChapterNumber(a) - getChapterNumber(b));

        for (const chapterDir of chapterDirs) {
          if (SKIP_CHAPTERS.has(chapterDir)) continue;

          allChapters.push({
            bookName: getBookDisplayName(bookDir),
            chapterFolder: chapterDir,
            chapterNum: getChapterNumber(chapterDir),
            pagesPath: path.join(bookPath, chapterDir),
          });
        }
      }

      if (allChapters.length === 0) {
        console.log("    No chapters found");
        continue;
      }

      // If multiple books, prefix chapter names with book name
      const hasMultipleBooks = bookDirs.length > 1;

      // Number chapters sequentially across books
      let seqNum = 0;
      for (const ch of allChapters) {
        seqNum++;
        const chapterName = hasMultipleBooks
          ? `${ch.bookName} — Ch ${ch.chapterNum}`
          : `Chapter ${ch.chapterNum}`;

        // Upsert chapter
        const { data: chapter, error: chapterError } = await supabase
          .from("chapters")
          .upsert(
            { number: seqNum, name: chapterName, subject_id: subject.id },
            { onConflict: "number,subject_id" }
          )
          .select()
          .single();

        if (chapterError || !chapter) {
          console.error(`    ✗ Chapter ${seqNum}: ${chapterError?.message}`);
          continue;
        }

        // Check if materials already exist
        const { count: existingCount } = await supabase
          .from("source_materials")
          .select("id", { count: "exact", head: true })
          .eq("chapter_id", chapter.id);

        if (existingCount && existingCount > 0) {
          process.stdout.write("    ⏭ ");
          console.log(`${chapterName} (${existingCount} pages already uploaded)`);
          skippedChapters++;
          totalChapters++;
          continue;
        }

        // Find all page images
        const pageFiles = fs
          .readdirSync(ch.pagesPath)
          .filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
          .sort((a, b) => {
            const numA = parseInt(a.match(/\d+/)?.[0] || "0");
            const numB = parseInt(b.match(/\d+/)?.[0] || "0");
            return numA - numB;
          });

        if (pageFiles.length === 0) {
          console.log(`    ⚠ ${chapterName}: no images found`);
          continue;
        }

        process.stdout.write(`    📄 ${chapterName} (${pageFiles.length} pages) `);

        // Upload pages
        let uploadedCount = 0;
        for (let i = 0; i < pageFiles.length; i++) {
          const file = pageFiles[i];
          const filePath = path.join(ch.pagesPath, file);
          const fileBuffer = fs.readFileSync(filePath);
          const storagePath = `${chapter.id}/textbook/${file}`;

          const { error: uploadError } = await supabase.storage
            .from("source-materials")
            .upload(storagePath, fileBuffer, {
              contentType: file.endsWith(".png") ? "image/png" : "image/jpeg",
              upsert: true,
            });

          if (uploadError) {
            process.stdout.write("✗");
            continue;
          }

          const {
            data: { publicUrl },
          } = supabase.storage.from("source-materials").getPublicUrl(storagePath);

          await supabase.from("source_materials").insert({
            chapter_id: chapter.id,
            type: "textbook",
            file_url: publicUrl,
            page_number: i + 1,
            file_name: file,
          });

          uploadedCount++;
          process.stdout.write(".");
        }

        console.log(` ✓ (${uploadedCount}/${pageFiles.length})`);
        totalChapters++;
        totalPages += uploadedCount;
      }
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ Seed complete!");
  console.log(`   Subjects: ${totalSubjects} created/updated`);
  console.log(`   Chapters: ${totalChapters} processed (${skippedChapters} already had materials)`);
  console.log(`   Pages uploaded: ${totalPages}`);
  if (skippedSubjects > 0) {
    console.log(`   ⚠ Skipped ${skippedSubjects} unknown subject folders`);
  }
  console.log(`${"=".repeat(60)}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
