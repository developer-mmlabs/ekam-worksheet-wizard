import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { worksheetId } = await req.json();

    if (!worksheetId) {
      return NextResponse.json({ success: false, error: "worksheetId is required" }, { status: 400 });
    }

    const { data: worksheet, error: fetchError } = await supabaseAdmin
      .from("worksheets")
      .select("id, status, is_finalized, chapter_id, school_id, set_number")
      .eq("id", worksheetId)
      .single();

    if (fetchError || !worksheet) {
      return NextResponse.json({ success: false, error: "Worksheet not found" }, { status: 404 });
    }

    if (worksheet.is_finalized) {
      return NextResponse.json({ success: false, error: "Worksheet is already finalized" }, { status: 400 });
    }

    if (worksheet.status !== "completed") {
      return NextResponse.json({
        success: false,
        error: "Only completed worksheets can be finalized",
      }, { status: 400 });
    }

    // Finalize
    const { error: updateError } = await supabaseAdmin
      .from("worksheets")
      .update({ is_finalized: true, finalized_at: new Date().toISOString() })
      .eq("id", worksheetId);

    if (updateError) {
      return NextResponse.json({ success: false, error: "Failed to finalize worksheet" }, { status: 500 });
    }

    // Determine next available set number
    const { data: allWorksheets } = await supabaseAdmin
      .from("worksheets")
      .select("set_number, is_finalized")
      .eq("chapter_id", worksheet.chapter_id)
      .eq("school_id", worksheet.school_id)
      .eq("is_finalized", true);

    const finalizedSets = new Set((allWorksheets ?? []).map((w) => w.set_number));
    // Include the one we just finalized
    finalizedSets.add(worksheet.set_number);

    let nextSetNumber: number | null = null;
    for (let n = 1; n <= 3; n++) {
      if (!finalizedSets.has(n)) {
        nextSetNumber = n;
        break;
      }
    }

    return NextResponse.json({ success: true, nextSetNumber });
  } catch (error) {
    console.error("Finalize error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Finalization failed" },
      { status: 500 }
    );
  }
}
