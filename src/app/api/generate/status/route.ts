import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { WorksheetStatusResponse } from "@/types";

export async function GET(req: NextRequest) {
  const worksheetId = req.nextUrl.searchParams.get("id");

  if (!worksheetId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const { data: worksheet, error } = await supabaseAdmin
    .from("worksheets")
    .select("id, status, pdf_url, error_message, questions_json, page_count")
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
  };

  return NextResponse.json(response);
}
