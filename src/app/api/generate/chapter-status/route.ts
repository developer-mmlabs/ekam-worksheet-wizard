import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ChapterStatusResponse } from "@/types";
import { chapterArrayFilter, nextWorksheetSet, parseChapterSelection } from "@/lib/worksheet-scope";

export async function GET(req: NextRequest) {
  let chapterIds: string[];
  try {
    const multi = req.nextUrl.searchParams.get("chapterIds");
    chapterIds = parseChapterSelection(req.nextUrl.searchParams.get("chapterId"), multi === null ? undefined : multi.split(","));
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
  const schoolId = req.nextUrl.searchParams.get("schoolId");

  if (!schoolId) {
    return NextResponse.json({ error: "chapterId and schoolId are required" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("worksheets")
    .select("id, set_number, status, is_finalized, pdf_url, created_at")
    .eq("chapter_id", chapterIds[0])
    .eq("school_id", schoolId)
    .order("set_number");
  query = chapterIds.length > 1 ? query.eq("chapter_ids", chapterArrayFilter(chapterIds)) : query.is("chapter_ids", null);
  const { data: worksheets, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch worksheets" }, { status: 500 });
  }

  const nextSetNumber = nextWorksheetSet(worksheets ?? []);

  const response: ChapterStatusResponse = {
    worksheets: (worksheets ?? []).map((w) => ({
      id: w.id,
      setNumber: w.set_number,
      status: w.status,
      isFinalized: w.is_finalized,
      pdfUrl: w.pdf_url,
      createdAt: w.created_at,
    })),
    nextSetNumber,
  };

  return NextResponse.json(response);
}
