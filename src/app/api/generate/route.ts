import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";
import { defaultConfigValues, getWorksheetConfigSpec } from "@/lib/worksheet-configs";
import type { GenerateRequest, WorksheetConfigValues, WorksheetQuestions } from "@/types";
import { flattenQuestionsForDedup } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const { chapterId, schoolId, config: clientConfig, sectionOrder } = body;

    if (!chapterId || !schoolId) {
      return NextResponse.json({ success: false, error: "chapterId and schoolId are required" }, { status: 400 });
    }

    // Load chapter -> subject -> grade so we know which config spec to use
    const { data: chapter, error: chapterError } = await supabaseAdmin
      .from("chapters")
      .select("id, subject:subjects(slug, grade:grades(number))")
      .eq("id", chapterId)
      .single();

    if (chapterError || !chapter) {
      return NextResponse.json({ success: false, error: "Chapter not found" }, { status: 404 });
    }

    const subjectData = chapter.subject as unknown as { slug: string; grade: { number: number } };
    const spec = getWorksheetConfigSpec(subjectData.grade.number, subjectData.slug);
    const config: WorksheetConfigValues = { ...defaultConfigValues(spec), ...clientConfig };

    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select("id")
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json({ success: false, error: "School not found" }, { status: 404 });
    }

    const { count: materialCount } = await supabaseAdmin
      .from("source_materials")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", chapterId);

    if (!materialCount || materialCount === 0) {
      return NextResponse.json({
        success: false,
        error: "No source materials found for this chapter. Upload textbook pages or question papers first.",
      }, { status: 400 });
    }

    // Determine set_number: find finalized worksheets and any pending/in-progress drafts
    const { data: existingWorksheets } = await supabaseAdmin
      .from("worksheets")
      .select("id, set_number, is_finalized, status, questions_json")
      .eq("chapter_id", chapterId)
      .eq("school_id", schoolId)
      .order("set_number");

    const finalized = (existingWorksheets ?? []).filter((w) => w.is_finalized);
    const finalizedSetNumbers = new Set(finalized.map((w) => w.set_number));

    if (finalizedSetNumbers.size >= 3) {
      return NextResponse.json({
        success: false,
        error: "All 3 worksheets for this chapter have been finalized.",
      }, { status: 400 });
    }

    // Next set_number = first unfinalized slot (1, 2, or 3)
    let setNumber = 1;
    for (let n = 1; n <= 3; n++) {
      if (!finalizedSetNumbers.has(n)) {
        setNumber = n;
        break;
      }
    }

    // Delete any existing non-finalized draft for this set_number (regeneration)
    const existingDraft = (existingWorksheets ?? []).find(
      (w) => w.set_number === setNumber && !w.is_finalized
    );
    if (existingDraft) {
      await supabaseAdmin.from("worksheets").delete().eq("id", existingDraft.id);
    }

    // Gather previously used questions from finalized worksheets for dedup
    const previousQuestions: string[] = [];
    for (const fw of finalized) {
      const qj = fw.questions_json as unknown as WorksheetQuestions;
      if (qj?.sections) {
        previousQuestions.push(...flattenQuestionsForDedup(qj));
      }
    }

    const { data: worksheet, error: insertError } = await supabaseAdmin
      .from("worksheets")
      .insert({
        chapter_id: chapterId,
        school_id: schoolId,
        status: "pending",
        questions_json: {},
        page_count: 0,
        set_number: setNumber,
        is_finalized: false,
      })
      .select("id")
      .single();

    if (insertError || !worksheet) {
      return NextResponse.json(
        { success: false, error: "Failed to create worksheet record" },
        { status: 500 }
      );
    }

    await inngest.send({
      name: "worksheet/generate.requested",
      data: {
        worksheetId: worksheet.id,
        chapterId,
        schoolId,
        config,
        sectionOrder,
        previousQuestions,
      },
    });

    return NextResponse.json({ success: true, worksheetId: worksheet.id, setNumber });

  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
