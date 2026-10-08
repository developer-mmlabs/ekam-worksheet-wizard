// Run once against the configured project: npx tsx --env-file=.env.local scripts/migrate-multi-chapter.ts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Load .env.local before running the migration.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  // The RPC itself is one transaction; PL/pgSQL cannot execute BEGIN/COMMIT.
  const sql = readFileSync(new URL("../supabase/migrations/20261008_multi_chapter.sql", import.meta.url), "utf8")
    .replace(/^(BEGIN|COMMIT);\r?$/gm, "");
  const { error } = await db.rpc("exec_sql", { query: sql });
  if (error) throw new Error(`Migration failed (${error.code}). Run supabase/migrations/20261008_multi_chapter.sql in the Supabase SQL editor.`);
  console.log("Multi-chapter database migration applied.");
}

main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
