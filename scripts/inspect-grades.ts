import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function main() {
  const { data: grades } = await supabase.from("grades").select("id, number, name").order("number");
  console.log("Per-grade overview:");
  console.log("Grade | Subjects | Chapters | Pages | Avg pages/ch | Min | Max");
  console.log("------+----------+----------+-------+--------------+-----+-----");

  for (const g of grades || []) {
    const { data: subjects } = await supabase.from("subjects").select("id, name, slug").eq("grade_id", g.id);
    const subjectIds = (subjects || []).map((s) => s.id);
    if (!subjectIds.length) continue;

    const { data: chapters } = await supabase.from("chapters").select("id").in("subject_id", subjectIds);
    const chapterIds = (chapters || []).map((c) => c.id);
    if (!chapterIds.length) continue;

    // Get page counts per chapter
    const pageCountByChapter = new Map<string, number>();
    for (let i = 0; i < chapterIds.length; i += 100) {
      const batch = chapterIds.slice(i, i + 100);
      const { data: mats } = await supabase.from("source_materials").select("chapter_id").in("chapter_id", batch);
      for (const m of mats || []) {
        pageCountByChapter.set(m.chapter_id, (pageCountByChapter.get(m.chapter_id) || 0) + 1);
      }
    }

    const counts = Array.from(pageCountByChapter.values()).filter((n) => n > 0);
    const total = counts.reduce((a, b) => a + b, 0);
    const avg = counts.length ? (total / counts.length).toFixed(1) : "0";
    const min = counts.length ? Math.min(...counts) : 0;
    const max = counts.length ? Math.max(...counts) : 0;

    console.log(`  ${String(g.number).padStart(2)}  |   ${String(subjects!.length).padStart(4)}   |   ${String(chapterIds.length).padStart(4)}   |  ${String(total).padStart(4)} |     ${String(avg).padStart(5)}    | ${String(min).padStart(3)} | ${String(max).padStart(3)}`);
  }

  // Per-subject breakdown for grades 9 and 10
  console.log("\nPer-subject breakdown (grades 9 and 10):");
  console.log("Grade | Subject              | Chapters | Pages | Avg pages/ch");
  console.log("------+----------------------+----------+-------+-------------");
  for (const g of (grades || []).filter((g) => g.number === 9 || g.number === 10)) {
    const { data: subjects } = await supabase.from("subjects").select("id, name, slug").eq("grade_id", g.id).order("name");
    for (const s of subjects || []) {
      const { data: chapters } = await supabase.from("chapters").select("id").eq("subject_id", s.id);
      const chapterIds = (chapters || []).map((c) => c.id);
      if (!chapterIds.length) {
        console.log(`  ${String(g.number).padStart(2)}  | ${s.name.padEnd(20)} |    0     |   0   |     0`);
        continue;
      }
      const { count: pageCount } = await supabase.from("source_materials").select("id", { count: "exact", head: true }).in("chapter_id", chapterIds);
      const pages = pageCount || 0;
      const avg = chapterIds.length ? (pages / chapterIds.length).toFixed(1) : "0";
      console.log(`  ${String(g.number).padStart(2)}  | ${s.name.padEnd(20)} |   ${String(chapterIds.length).padStart(4)}   |  ${String(pages).padStart(4)} |    ${String(avg).padStart(5)}`);
    }
  }
}

main().catch(console.error);
