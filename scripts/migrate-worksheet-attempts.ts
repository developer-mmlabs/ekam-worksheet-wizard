import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const test = process.argv.includes("--test");
  const multi = process.argv.includes("--multi");
  if (!test && !process.argv.includes("--apply")) throw new Error("Choose --test (rolled back) or --apply.");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);
  if (!test) {
    const { data, error } = await db.from("worksheets").select("id").in("status", ["pending", "processing"])
      .gt("deadline_at", new Date().toISOString());
    if (error || data?.length) throw new Error("Cannot apply safely while recent attempts may be active. Stop old workers and verify their runs first.");
  }
  let sql = readFileSync(multi ? "supabase/migrations/20261012_multi_chapter_checkpoints.sql" : "supabase/migrations/20261012_worksheet_attempts.sql", "utf8").replace(/^(BEGIN|COMMIT);\r?$/gm, "");
  if (test) sql += readFileSync(multi ? "tests/multi-chapter-checkpoints.sql" : "tests/worksheet-attempts.sql", "utf8");
  const { error } = await db.rpc("exec_sql", { query: sql });
  if (test && error?.message === "ATTEMPT_TESTS_PASSED_ROLLBACK") {
    console.log("Database attempt tests passed; migration and test data rolled back."); return;
  }
  if (error || test) throw new Error(error?.message ?? "Tests did not roll back as expected");
  console.log(multi ? "Multi-chapter checkpoint migration applied." : "Worksheet-attempt migration applied.");
}
main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
