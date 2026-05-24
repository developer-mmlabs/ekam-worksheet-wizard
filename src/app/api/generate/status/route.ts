import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { WorksheetStatusResponse } from "@/types";

export async function GET(req: NextRequest) {
  const worksheetId = req.nextUrl.searchParams.get("id");
  const includeQuestions = req.nextUrl.searchParams.get("include") === "questions";

  if (!worksheetId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const { data: worksheet, error } = await supabaseAdmin
    .from("worksheets")
    .select("id, status, pdf_url, error_message, questions_json, page_count, set_number, is_finalized, created_at")
    .eq("id", worksheetId)
    .single();

  if (error || !worksheet) {
    return NextResponse.json({ error: "Worksheet not found" }, { status: 404 });
  }

  // Compute queue position for pending/processing worksheets
  // Ignore stale rows older than 15 minutes (likely orphaned)
  let queuePosition: number | null = null;
  if (worksheet.status === "pending" || worksheet.status === "processing") {
    const staleThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const { count } = await supabaseAdmin
      .from("worksheets")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "processing"])
      .gt("created_at", staleThreshold)
      .lt("created_at", worksheet.created_at);

    queuePosition = (count ?? 0) + 1;

    // If this worksheet itself is stale (>15 min in pending/processing), mark it failed
    if (worksheet.created_at < staleThreshold) {
      await supabaseAdmin
        .from("worksheets")
        .update({ status: "failed", error_message: "Generation timed out" })
        .eq("id", worksheetId)
        .in("status", ["pending", "processing"]);

      return NextResponse.json({
        ...({
          id: worksheet.id, status: "failed" as const, pdfUrl: null,
          errorMessage: "Generation timed out", questionCount: null, pageCount: null,
          setNumber: worksheet.set_number, isFinalized: false, queuePosition: null,
        }),
      });
    }
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
    queuePosition,
    ...(includeQuestions ? { questionsJson: worksheet.questions_json } : {}),
  };

  return NextResponse.json(response);
}
