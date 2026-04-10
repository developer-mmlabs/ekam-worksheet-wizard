import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bouquocyaneesufpxqqq.supabase.co";
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || "sb_secret_OsB7gGcsC5ddKBzWOcSlvg__LUh9pWH";

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

// Chapter names for Grade 8 Science (Curiosity textbook)
const CHAPTER_NAMES: Record<number, string> = {
  1: "Exploring the Investigative World of Science",
  2: "Microorganisms",
  3: "Synthetic Fibres and Plastics",
  4: "Metals and Non-Metals",
  5: "Coal and Petroleum",
  6: "Combustion and Flame",
  7: "Conservation of Plants and Animals",
  8: "Cell: Structure and Functions",
  9: "Reproduction in Animals",
  10: "Force and Pressure",
  11: "Friction",
  12: "Sound",
  13: "Chemical Effects of Electric Current",
};

async function seed() {
  console.log("Starting seed process...\n");

  // 1. Get Grade 8
  console.log("1. Finding Grade 8...");
  const { data: grade, error: gradeError } = await supabase
    .from("grades")
    .select("*")
    .eq("number", 8)
    .single();

  if (gradeError || !grade) {
    console.error("Grade 8 not found. Run database setup first: POST /api/setup");
    console.error("Or run the SQL schema via Supabase dashboard: GET /api/setup");
    process.exit(1);
  }
  console.log(`   Found: ${grade.name} (${grade.id})\n`);

  // 2. Create Science subject
  console.log("2. Creating Science subject...");
  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .upsert(
      { name: "Science", slug: "science", grade_id: grade.id },
      { onConflict: "slug,grade_id" }
    )
    .select()
    .single();

  if (subjectError) {
    console.error("Failed to create subject:", subjectError.message);
    process.exit(1);
  }
  console.log(`   Created: ${subject.name} (${subject.id})\n`);

  // 3. Create chapters and upload materials
  const sourceDir = path.resolve(__dirname, "../grade8-science");
  const chapterDirs = fs.readdirSync(sourceDir)
    .filter((d) => d.startsWith("chapter-"))
    .sort((a, b) => {
      const numA = parseInt(a.replace("chapter-", ""));
      const numB = parseInt(b.replace("chapter-", ""));
      return numA - numB;
    });

  console.log(`3. Found ${chapterDirs.length} chapter directories\n`);

  for (const chapterDir of chapterDirs) {
    const chapterNum = parseInt(chapterDir.replace("chapter-", ""));
    const chapterName = CHAPTER_NAMES[chapterNum] || `Chapter ${chapterNum}`;

    console.log(`   Processing chapter ${chapterNum}: ${chapterName}`);

    // Create chapter
    const { data: chapter, error: chapterError } = await supabase
      .from("chapters")
      .upsert(
        { number: chapterNum, name: chapterName, subject_id: subject.id },
        { onConflict: "number,subject_id" }
      )
      .select()
      .single();

    if (chapterError) {
      console.error(`   Failed to create chapter: ${chapterError.message}`);
      continue;
    }

    // Check existing materials
    const { count: existingCount } = await supabase
      .from("source_materials")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", chapter.id);

    if (existingCount && existingCount > 0) {
      console.log(`   Skipping uploads (${existingCount} materials already exist)\n`);
      continue;
    }

    // Upload JPEG files
    const chapterPath = path.join(sourceDir, chapterDir);
    const files = fs.readdirSync(chapterPath)
      .filter((f) => f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".png"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || "0");
        const numB = parseInt(b.match(/\d+/)?.[0] || "0");
        return numA - numB;
      });

    console.log(`   Uploading ${files.length} pages...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(chapterPath, file);
      const fileBuffer = fs.readFileSync(filePath);

      const storagePath = `${chapter.id}/textbook/${file}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("source-materials")
        .upload(storagePath, fileBuffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.error(`   Failed to upload ${file}: ${uploadError.message}`);
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("source-materials")
        .getPublicUrl(storagePath);

      // Insert material record
      await supabase.from("source_materials").insert({
        chapter_id: chapter.id,
        type: "textbook",
        file_url: publicUrl,
        page_number: i + 1,
        file_name: file,
      });

      process.stdout.write(".");
    }
    console.log(` Done (${files.length} pages)\n`);
  }

  console.log("\nSeed complete!");
  console.log("You can now generate worksheets at http://localhost:3000");
}

seed().catch(console.error);
