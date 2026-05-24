import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ChapterStatusResponse } from "@/types";

export async function GET(req: NextRequest) {
  const chapterId = req.nextUrl.searchParams.get("chapterId");
  const schoolId = req.nextUrl.searchParams.get("schoolId");

  if (!chapterId || !schoolId) {
    return NextResponse.json({ error: "chapterId and schoolId are required" }, { status: 400 });
  }

  const { data: worksheets, error } = await supabaseAdmin
    .from("worksheets")
    .select("id, set_number, status, is_finalized, pdf_url, created_at")
    .eq("chapter_id", chapterId)
    .eq("school_id", schoolId)
    .order("set_number");

  if (error) {
    return NextResponse.json({ error: "Failed to fetch worksheets" }, { status: 500 });
  }

  const finalizedSets = new Set(
    (worksheets ?? []).filter((w) => w.is_finalized).map((w) => w.set_number)
  );

  let nextSetNumber: number | null = null;
  for (let n = 1; n <= 3; n++) {
    if (!finalizedSets.has(n)) {
      nextSetNumber = n;
      break;
    }
  }

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
