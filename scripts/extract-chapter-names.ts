import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ============================================================
// Extract actual chapter names from NCERT textbook first pages
// using OpenRouter AI vision, then update the Supabase database.
//
// Usage: npx tsx scripts/extract-chapter-names.ts [grade_numbers...]
// Example: npx tsx scripts/extract-chapter-names.ts 10
//          npx tsx scripts/extract-chapter-names.ts 2 4 7 10
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
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "qwen/qwen2.5-vl-72b-instruct";

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

const IMAGES_DIR = path.resolve(
  __dirname,
  "../../worksheet-wizard-assets/ncert-textbook-images"
);

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

const SKIP_CHAPTERS = new Set([
  "Prelims",
  "Annexure",
  "Appendix",
  "Glossary",
  "Bibliography",
  "Answer-Key",
  "Answers",
  "jemh1a1",
  "jemh1a2",
  "jess1a1",
]);

function getClassNumber(dirName: string): number {
  const match = dirName.match(/Class-(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function getChapterNumber(dirName: string): number {
  const match = dirName.match(/Chapter-(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

async function callOpenRouter(
  images: { base64: string; label: string }[],
  bookName: string,
  subjectName: string,
  gradeName: string
): Promise<Record<string, string>> {
  const content: any[] = [];

  content.push({
    type: "text",
    text: `You are looking at the first pages of chapters from an NCERT textbook.
Book: "${bookName}", Subject: ${subjectName}, ${gradeName}.

For each image, extract the EXACT chapter title as printed on the page.
- Include the chapter name only (not "Chapter 1" prefix, not subtitles)
- For Hindi chapters, transliterate the Hindi title to English/Roman script
- If the page is a poem or story, use the poem/story title
- Keep it concise — just the title as it appears

Respond with ONLY valid JSON (no markdown fences):
{
  "chapters": {
    "Chapter-01": "Chapter Title Here",
    "Chapter-02": "Another Title",
    ...
  }
}

Here are the first pages:`,
  });

  for (const img of images) {
    content.push({
      type: "text",
      text: `[${img.label}]:`,
    });
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${img.base64}` },
    });
  }

  let response: Response | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://worksheet-wizard.vercel.app",
            "X-Title": "Worksheet Wizard - Chapter Name Extraction",
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: [{ role: "user", content }],
            max_tokens: 4000,
            temperature: 0.1,
          }),
        }
      );
      break;
    } catch (e) {
      console.warn(
        `      Network error (attempt ${attempt}/3): ${e}`
      );
      if (attempt === 3) return {};
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }

  if (!response || !response.ok) {
    const error = response ? await response.text() : "no response";
    console.error(`      OpenRouter API error: ${error.slice(0, 200)}`);
    return {};
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0]?.message?.content) {
    console.error(`      API returned unexpected response:`, JSON.stringify(data).slice(0, 500));
    return {};
  }

  let jsonStr = data.choices[0].message.content.trim();

  // Strip markdown fences if present
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const raw = parsed.chapters || parsed;

    // Normalize keys: the AI might return "Chapter-01", "Chapter-1", "1", etc.
    // Map them all back to the labels we sent (e.g., "Chapter-01")
    const normalized: Record<string, string> = {};
    const sentLabels = images.map((img) => img.label);

    for (const [key, value] of Object.entries(raw)) {
      if (typeof value !== "string") continue;

      // Direct match
      if (sentLabels.includes(key)) {
        normalized[key] = value;
        continue;
      }

      // Try to extract a number from the key and match
      const numMatch = key.match(/(\d+)/);
      if (numMatch) {
        const num = parseInt(numMatch[1]);
        // Find matching label like "Chapter-01" or "Chapter-1"
        const match = sentLabels.find((l) => {
          const lNum = l.match(/(\d+)/);
          return lNum && parseInt(lNum[1]) === num;
        });
        if (match) {
          normalized[match] = value;
        }
      }
    }

    return normalized;
  } catch (e) {
    console.error(`      Failed to parse AI response:`, jsonStr.slice(0, 300));
    return {};
  }
}

async function processBook(
  gradeDir: string,
  subjectDir: string,
  bookDir: string,
  gradeNumber: number
): Promise<{ chapterDir: string; name: string }[]> {
  const bookPath = path.join(IMAGES_DIR, gradeDir, subjectDir, bookDir);

  // Get chapter directories
  const chapterDirs = fs
    .readdirSync(bookPath)
    .filter(
      (d) =>
        d.startsWith("Chapter-") &&
        fs.statSync(path.join(bookPath, d)).isDirectory()
    )
    .sort(
      (a, b) => getChapterNumber(a) - getChapterNumber(b)
    );

  if (chapterDirs.length === 0) return [];

  // Collect first page images
  const images: { base64: string; label: string }[] = [];
  for (const chDir of chapterDirs) {
    // Handle both page-01.jpg and page-1.jpg naming
    let firstPage = path.join(bookPath, chDir, "page-01.jpg");
    if (!fs.existsSync(firstPage)) {
      firstPage = path.join(bookPath, chDir, "page-1.jpg");
    }
    if (fs.existsSync(firstPage)) {
      const base64 = fs.readFileSync(firstPage).toString("base64");
      images.push({ base64, label: chDir });
    } else {
      console.warn(`      No first page found for ${chDir}`);
    }
  }

  if (images.length === 0) return [];

  const gradeName = `Grade ${gradeNumber}`;
  const subjectInfo = SUBJECT_MAP[subjectDir];
  const subjectName = subjectInfo?.name || subjectDir;
  const bookName = bookDir.replace(/-/g, " ");

  // Split into batches of max 8 to stay within API limits
  const MAX_BATCH = 8;
  let nameMap: Record<string, string> = {};

  for (let i = 0; i < images.length; i += MAX_BATCH) {
    const batch = images.slice(i, i + MAX_BATCH);
    console.log(
      `    Sending ${batch.length} first pages to AI for "${bookName}"${images.length > MAX_BATCH ? ` (batch ${Math.floor(i / MAX_BATCH) + 1})` : ""}...`
    );

    // Small delay between calls to avoid rate limits
    if (i > 0) await new Promise((r) => setTimeout(r, 3000));

    const batchResult = await callOpenRouter(
      batch,
      bookName,
      subjectName,
      gradeName
    );
    nameMap = { ...nameMap, ...batchResult };
  }

  // Map results back
  const results: { chapterDir: string; name: string }[] = [];
  for (const chDir of chapterDirs) {
    const extractedName = nameMap[chDir];
    if (extractedName) {
      results.push({ chapterDir: chDir, name: extractedName });
    } else {
      console.warn(`      Warning: No name extracted for ${chDir}`);
      results.push({
        chapterDir: chDir,
        name: `Chapter ${getChapterNumber(chDir)}`,
      });
    }
  }

  return results;
}

async function main() {
  console.log("=== NCERT Chapter Name Extraction ===\n");

  if (!fs.existsSync(IMAGES_DIR)) {
    console.error(`Images directory not found: ${IMAGES_DIR}`);
    process.exit(1);
  }

  const cliGrades = process.argv.slice(2).map(Number).filter(Boolean);
  if (cliGrades.length > 0) {
    console.log(`Filtering to grades: ${cliGrades.join(", ")}\n`);
  }

  // Collect all updates with the DB sequential number (seqNum)
  // computed the same way as the seed script
  const allUpdates: {
    gradeNumber: number;
    subjectSlug: string;
    seqNum: number;
    isMultiBook: boolean;
    bookDisplayName: string;
    newName: string;
  }[] = [];

  const classDirs = fs
    .readdirSync(IMAGES_DIR)
    .filter((d) => {
      if (
        !d.startsWith("Class-") ||
        !fs.statSync(path.join(IMAGES_DIR, d)).isDirectory()
      )
        return false;
      if (cliGrades.length > 0)
        return cliGrades.includes(getClassNumber(d));
      return true;
    })
    .sort((a, b) => getClassNumber(a) - getClassNumber(b));

  for (const classDir of classDirs) {
    const gradeNumber = getClassNumber(classDir);
    console.log(`\nGrade ${gradeNumber}:`);

    const subjectDirs = fs
      .readdirSync(path.join(IMAGES_DIR, classDir))
      .filter(
        (d) =>
          fs
            .statSync(path.join(IMAGES_DIR, classDir, d))
            .isDirectory() && SUBJECT_MAP[d]
      )
      .sort(); // Must match seed script sort order

    for (const subjectDir of subjectDirs) {
      const subjectInfo = SUBJECT_MAP[subjectDir];
      console.log(`  ${subjectInfo.name}:`);

      const subjectPath = path.join(IMAGES_DIR, classDir, subjectDir);
      const bookDirs = fs
        .readdirSync(subjectPath)
        .filter(
          (d) =>
            fs.statSync(path.join(subjectPath, d)).isDirectory()
        )
        .sort(); // Must match seed script sort order

      const isMultiBook = bookDirs.length > 1;

      // Track sequential numbering across all books in this subject
      // (same as seed script)
      let seqNum = 0;

      for (const bookDir of bookDirs) {
        const bookPath = path.join(subjectPath, bookDir);

        // Get chapter dirs (same filter as seed script)
        const chapterDirs = fs
          .readdirSync(bookPath)
          .filter(
            (d) =>
              d.startsWith("Chapter-") &&
              fs.statSync(path.join(bookPath, d)).isDirectory()
          )
          .sort(
            (a, b) => getChapterNumber(a) - getChapterNumber(b)
          );

        if (chapterDirs.length === 0) continue;

        // Extract names via AI
        const results = await processBook(
          classDir,
          subjectDir,
          bookDir,
          gradeNumber
        );

        // Build a map from chapterDir to extracted name
        const nameByDir = new Map(
          results.map((r) => [r.chapterDir, r.name])
        );

        const bookDisplayName = bookDir
          .replace(/-(English)$/i, "")
          .replace(/[-_]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        // Assign seqNums in the same order as the seed script
        for (const chDir of chapterDirs) {
          seqNum++;
          const extractedName =
            nameByDir.get(chDir) ||
            `Chapter ${getChapterNumber(chDir)}`;

          allUpdates.push({
            gradeNumber,
            subjectSlug: subjectInfo.slug,
            seqNum,
            isMultiBook,
            bookDisplayName,
            newName: extractedName,
          });
          console.log(
            `      #${seqNum} ${chDir}: ${extractedName}`
          );
        }
      }
    }
  }

  // --- Phase 2: Update Supabase ---
  console.log(
    `\n\n=== Updating Supabase (${allUpdates.length} chapters) ===\n`
  );

  // Get all grades
  const { data: grades } = await supabase
    .from("grades")
    .select("id, number");

  if (!grades) {
    console.error("Failed to fetch grades");
    process.exit(1);
  }

  const gradeMap = new Map(grades.map((g) => [g.number, g.id]));

  // Pre-fetch all subjects
  const subjectCache = new Map<string, string>(); // "gradeId:slug" -> subjectId
  for (const grade of grades) {
    const { data: subjects } = await supabase
      .from("subjects")
      .select("id, slug")
      .eq("grade_id", grade.id);
    if (subjects) {
      for (const s of subjects) {
        subjectCache.set(`${grade.id}:${s.slug}`, s.id);
      }
    }
  }

  let updated = 0;
  let failed = 0;

  for (const update of allUpdates) {
    const gradeId = gradeMap.get(update.gradeNumber);
    if (!gradeId) {
      console.warn(`  No grade found for number ${update.gradeNumber}`);
      failed++;
      continue;
    }

    const subjectId = subjectCache.get(
      `${gradeId}:${update.subjectSlug}`
    );
    if (!subjectId) {
      console.warn(
        `  No subject ${update.subjectSlug} for grade ${update.gradeNumber}`
      );
      failed++;
      continue;
    }

    // Build the chapter name
    const newFullName = update.isMultiBook
      ? `${update.bookDisplayName} — ${update.newName}`
      : update.newName;

    // Update by (subject_id, number) — the unique key
    const { error } = await supabase
      .from("chapters")
      .update({ name: newFullName })
      .eq("subject_id", subjectId)
      .eq("number", update.seqNum);

    if (error) {
      console.warn(
        `  Failed to update seqNum ${update.seqNum} in ${update.subjectSlug}: ${error.message}`
      );
      failed++;
    } else {
      updated++;
    }
  }

  console.log(`\nDone! Updated: ${updated}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
