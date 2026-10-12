import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { expireAttempts } from "@/lib/worksheet-attempts";
import type { WorksheetStatusResponse } from "@/types";

export async function GET(req: NextRequest) {
  const worksheetId = req.nextUrl.searchParams.get("id");
  const includeQuestions = req.nextUrl.searchParams.get("include") === "questions";

  if (!worksheetId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  try { await expireAttempts(); }
  catch { return NextResponse.json({ error: "Unable to verify progress. Please try again." }, { status: 503 }); }

  const { data: worksheet, error } = await supabaseAdmin
    .from("worksheets")
    .select("id, status, pdf_url, error_message, questions_json, page_count, set_number, is_finalized, created_at, attempt_id, attempt_kind, queued_at, started_at, deadline_at, last_activity_at, progress")
    .eq("id", worksheetId)
    .single();

  if (error || !worksheet) {
    return NextResponse.json({ error: "Worksheet not found" }, { status: 404 });
  }

  const response: WorksheetStatusResponse = {
    id: worksheet.id,
    status: worksheet.status,
    pdfUrl: worksheet.pdf_url,
    errorMessage: worksheet.error_message,
    questionCount: worksheet.questions_json?.metadata?.totalQuestions ?? null,
    pageCount: worksheet.page_count || null,
    setNumber: worksheet.set_number,
    isFinalized: worksheet.is_finalized,
    queuePosition: null,
    attemptId: worksheet.attempt_id,
    attemptKind: worksheet.attempt_kind,
    queuedAt: worksheet.queued_at,
    startedAt: worksheet.started_at,
    deadlineAt: worksheet.deadline_at,
    lastActivityAt: worksheet.last_activity_at,
    progress: worksheet.progress,
    ...(includeQuestions ? { questionsJson: worksheet.questions_json } : {}),
  };

  return NextResponse.json(response);
}
