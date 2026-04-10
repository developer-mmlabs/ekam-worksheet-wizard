import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generateQuestions } from "@/lib/ai/question-generator";
import { generateWorksheetPDF } from "@/lib/pdf/generator";
import { getTheme } from "@/lib/pdf/templates/themes";
import type { GenerateRequest, Grade, Subject, Chapter, School, GradeBand, QuestionCounts } from "@/types";
import { QUESTION_COUNT_DEFAULTS } from "@/types";

export const maxDuration = 120; // Allow up to 2 minutes for AI generation

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const { chapterId, schoolId, questionCounts } = body;
    const counts: QuestionCounts = {
      ...QUESTION_COUNT_DEFAULTS,
      ...questionCounts,
    };

    if (!chapterId || !schoolId) {
      return NextResponse.json({ success: false, error: "chapterId and schoolId are required" }, { status: 400 });
    }

    // ── Synchronous validation (fast) ──────────────────────────

    // 1. Load chapter + subject + grade metadata
    const { data: chapter, error: chapterError } = await supabaseAdmin
      .from("chapters")
      .select("*, subject:subjects(*, grade:grades(*))")
      .eq("id", chapterId)
      .single();

    if (chapterError || !chapter) {
      return NextResponse.json({ success: false, error: "Chapter not found" }, { status: 404 });
    }

    // 2. Load school
    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select("*")
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json({ success: false, error: "School not found" }, { status: 404 });
    }

    // 3. Check source materials exist (don't download yet)
    const { data: materials } = await supabaseAdmin
      .from("source_materials")
      .select("*")
      .eq("chapter_id", chapterId)
      .order("type")
      .order("page_number");

    if (!materials || materials.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No source materials found for this chapter. Upload textbook pages or question papers first.",
      }, { status: 400 });
    }

    // 4. Insert a PENDING worksheet row
    const { data: worksheet, error: insertError } = await supabaseAdmin
      .from("worksheets")
      .insert({
        chapter_id: chapterId,
        school_id: schoolId,
        status: "pending",
        questions_json: {},
        page_count: 0,
      })
      .select("id")
      .single();

    if (insertError || !worksheet) {
      return NextResponse.json(
        { success: false, error: "Failed to create worksheet record" },
        { status: 500 }
      );
    }

    // ── Return immediately, process in background ──────────────

    after(async () => {
      await processWorksheet(worksheet.id, chapterId, schoolId, chapter, school, materials, counts);
    });

    return NextResponse.json({ success: true, worksheetId: worksheet.id });

  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}

// ── Background processing ──────────────────────────────────────

async function processWorksheet(
  worksheetId: string,
  chapterId: string,
  schoolId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chapter: any,
  school: School,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  materials: any[],
  counts: QuestionCounts,
) {
  try {
    // Mark as processing
    await supabaseAdmin
      .from("worksheets")
      .update({ status: "processing" })
      .eq("id", worksheetId);

    const subjectData = chapter.subject as unknown as Subject & { grade: Grade };
    const gradeData = subjectData.grade;

    // Download images and convert to base64
    const imageBase64s: string[] = [];
    for (const material of materials) {
      try {
        const response = await fetch(material.file_url as string);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const base64 = Buffer.from(buffer).toString("base64");
          imageBase64s.push(base64);
        }
      } catch (e) {
        console.warn(`Failed to fetch image: ${material.file_url}`, e);
      }
    }

    if (imageBase64s.length === 0) {
      throw new Error("Could not load any source material images.");
    }

    // Generate questions via AI
    const questions = await generateQuestions(
      imageBase64s,
      gradeData.name,
      subjectData.name,
      chapter.name as string,
      counts
    );

    // Build theme
    const theme = getTheme(gradeData.band as GradeBand, subjectData.slug, {
      primary: school.primary_color,
      secondary: school.secondary_color,
    });

    // Count existing worksheets for numbering
    const { count } = await supabaseAdmin
      .from("worksheets")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", chapterId);

    const worksheetNumber = count || 1;

    // Generate PDF
    const pdfBuffer = await generateWorksheetPDF({
      school,
      grade: gradeData as Grade,
      subject: subjectData as Subject,
      chapter: chapter as unknown as Chapter,
      questions,
      worksheetNumber,
      theme,
    });

    // Upload PDF to Supabase storage
    const pdfPath = `${schoolId}/${chapterId}/worksheet-${worksheetNumber}-${Date.now()}.pdf`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("worksheets")
      .upload(pdfPath, pdfBuffer, { contentType: "application/pdf" });

    let pdfUrl: string | null = null;
    if (!uploadError) {
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from("worksheets")
        .getPublicUrl(pdfPath);
      pdfUrl = publicUrl;
    }

    // Update worksheet row to completed
    await supabaseAdmin
      .from("worksheets")
      .update({
        status: "completed",
        pdf_url: pdfUrl,
        questions_json: questions,
        page_count: Math.min(4, Math.ceil(questions.metadata.totalQuestions / 8)),
      })
      .eq("id", worksheetId);

  } catch (error) {
    console.error(`Worksheet ${worksheetId} failed:`, error);

    await supabaseAdmin
      .from("worksheets")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Generation failed",
      })
      .eq("id", worksheetId);
  }
}
