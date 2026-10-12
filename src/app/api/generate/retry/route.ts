import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { errorMessage, expireAttempts, queueAttempt } from "@/lib/worksheet-attempts";

export async function POST(req: NextRequest) {
  try {
    const { worksheetId } = await req.json();
    await expireAttempts();
    const { data: row, error } = await supabaseAdmin.from("worksheets").select("*").eq("id", worksheetId).single();
    if (error || !row) return NextResponse.json({ error: "Worksheet not found" }, { status: 404 });
    if (row.is_finalized || row.status !== "failed") {
      return NextResponse.json({ error: "Only a failed, unfinalized attempt can be retried. Refresh its status." }, { status: 409 });
    }
    if (!row.attempt_kind || (row.attempt_kind === "generate" && !row.attempt_request)) {
      return NextResponse.json({ error: "Open Generate, select these chapters and generate again. This older request has no saved settings." }, { status: 409 });
    }
    const worksheet = await queueAttempt({ id: row.id }, row.attempt_kind, row.attempt_id);
    return NextResponse.json({ success: true, worksheetId: worksheet.id });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
