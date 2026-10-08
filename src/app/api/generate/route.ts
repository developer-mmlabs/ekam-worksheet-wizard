import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";
import { defaultConfigValues, getWorksheetConfigSpec } from "@/lib/worksheet-configs";
import type { GenerateRequest, WorksheetConfigValues, WorksheetQuestions } from "@/types";
import { flattenQuestionsForDedup } from "@/types";
import { chapterArrayFilter, nextWorksheetSet, parseChapterSelection } from "@/lib/worksheet-scope";

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const { schoolId, config: clientConfig, sectionOrder } = body;
    let chapterIds: string[];
    try { chapterIds = parseChapterSelection(body.chapterId, body.chapterIds); }
    catch (error) {
      return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
    }
    const chapterId = chapterIds[0];
    const multi = chapterIds.length > 1;

    if (!chapterId || !schoolId) {
      return NextResponse.json({ success: false, error: "chapterId and schoolId are required" }, { status: 400 });
    }

    // Load chapter -> subject -> grade so we know which config spec to use
    const { data: chapters, error: chapterError } = await supabaseAdmin
      .from("chapters")
      .select("id, name, number, subject_id, subject:subjects(slug, grade:grades(number))")
      .in("id", chapterIds)
      .order("number");

    if (chapterError || !chapters || chapters.length !== chapterIds.length) {
      return NextResponse.json({ success: false, error: "Chapter not found" }, { status: 404 });
    }
    const chapter = chapters[0];
    if (chapters.some((item) => item.subject_id !== chapter.subject_id)) {
      return NextResponse.json({ success: false, error: "All chapters must belong to the same grade and subject." }, { status: 400 });
    }

    const subjectData = chapter.subject as unknown as { slug: string; grade: { number: number } };
    const spec = getWorksheetConfigSpec(subjectData.grade.number, subjectData.slug);
    const config: WorksheetConfigValues = { ...defaultConfigValues(spec), ...clientConfig };
    if (spec.controls.some((control) => !Number.isInteger(config[control.id]) || config[control.id] < control.min || config[control.id] > control.max)
      || !spec.controls.some((control) => config[control.id] > 0)) {
      return NextResponse.json({ success: false, error: "Choose valid question counts, with at least one question type enabled." }, { status: 400 });
    }

    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select("id")
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json({ success: false, error: "School not found" }, { status: 404 });
    }

    const materialChecks = await Promise.all(chapters.map(async (item) => {
      const { count, error } = await supabaseAdmin.from("source_materials")
        .select("id", { count: "exact", head: true }).eq("chapter_id", item.id);
      if (error) throw new Error("Failed to check source materials.");
      return { chapter: item, count };
    }));
    const missing = materialChecks.filter((item) => !item.count);
    if (missing.length) {
      return NextResponse.json({
        success: false,
        error: `Upload textbook pages or question papers for: ${missing.map(({ chapter: item }) => `Ch ${item.number}: ${item.name}`).join(", ")}.`,
      }, { status: 400 });
    }

    // Determine set_number: find finalized worksheets and any pending/in-progress drafts
    let existingQuery = supabaseAdmin
      .from("worksheets")
      .select("id, set_number, is_finalized, status, questions_json")
      .eq("chapter_id", chapterId)
      .eq("school_id", schoolId)
      .order("set_number");
    existingQuery = multi ? existingQuery.eq("chapter_ids", chapterArrayFilter(chapterIds)) : existingQuery.is("chapter_ids", null);
    const { data: existingWorksheets, error: existingError } = await existingQuery;
    if (existingError) throw new Error("Failed to load worksheet sets. Check that the multi-chapter database migration is applied.");

    const finalized = (existingWorksheets ?? []).filter((w) => w.is_finalized);
    const setNumber = nextWorksheetSet(existingWorksheets ?? []);

    if (setNumber === null) {
      return NextResponse.json({
        success: false,
        error: "All 3 worksheets for this chapter selection have been finalized.",
      }, { status: 400 });
    }

    // Delete any existing non-finalized draft for this set_number (regeneration)
    const existingDraft = (existingWorksheets ?? []).find(
      (w) => w.set_number === setNumber && !w.is_finalized
    );
    if (existingDraft) {
      if (existingDraft.status === "pending" || existingDraft.status === "processing") {
        return NextResponse.json({ success: true, worksheetId: existingDraft.id, setNumber });
      }
      const { error: deleteError } = await supabaseAdmin.from("worksheets").delete().eq("id", existingDraft.id).eq("is_finalized", false);
      if (deleteError) throw new Error("Failed to replace the existing draft.");
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
        chapter_ids: multi ? chapterIds : null,
        school_id: schoolId,
        status: "pending",
        questions_json: multi ? { metadata: { chapters: chapters.map(({ id, number, name }) => ({ id, number, name })) } } : {},
        page_count: 0,
        set_number: setNumber,
        is_finalized: false,
      })
      .select("id")
      .single();

    if (insertError || !worksheet) {
      return NextResponse.json(
        { success: false, error: insertError?.code === "23505" ? "A worksheet for this selection is already being generated. Select the chapters again to refresh its status." : "Failed to create worksheet record" },
        { status: insertError?.code === "23505" ? 409 : 500 }
      );
    }

    try { await inngest.send({
      name: "worksheet/generate.requested",
      data: {
        worksheetId: worksheet.id,
        chapterId,
        chapterIds,
        schoolId,
        config,
        sectionOrder,
        previousQuestions,
      },
    }); } catch {
      await supabaseAdmin.from("worksheets").update({ status: "failed", error_message: "Unable to queue generation. Please try again." }).eq("id", worksheet.id);
      throw new Error("Unable to queue generation. Please try again.");
    }

    return NextResponse.json({ success: true, worksheetId: worksheet.id, setNumber });

  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
