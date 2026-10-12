import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { expireAttempts } from "@/lib/worksheet-attempts";

export async function GET() {
  try {
    await expireAttempts();
    const { data, error } = await supabaseAdmin.from("worksheets")
      .select("id, status, pdf_url, page_count, created_at, is_finalized, error_message, progress, started_at, queued_at, attempt_kind, metadata:questions_json->metadata, chapter:chapters(number, name, subject:subjects(name, grade:grades(name)))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unable to verify worksheet status. Please refresh." }, { status: 503 });
  }
}
