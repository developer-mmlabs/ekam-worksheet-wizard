import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { generateQuestions } from "@/lib/ai/question-generator";
import { generateWorksheetPDF } from "@/lib/pdf/generator";
import { getTheme } from "@/lib/pdf/templates/themes";
import type { GenerateRequest, Grade, Subject, Chapter, School, GradeBand } from "@/types";

export const maxDuration = 120; // Allow up to 2 minutes for AI generation

export async function POST(req: NextRequest) {
  try {
    const body: GenerateRequest = await req.json();
    const { chapterId, schoolId } = body;

    if (!chapterId || !schoolId) {
      return NextResponse.json({ success: false, error: "chapterId and schoolId are required" }, { status: 400 });
    }

    // 1. Load all metadata
    const { data: chapter, error: chapterError } = await supabaseAdmin
      .from("chapters")
      .select("*, subject:subjects(*, grade:grades(*))")
      .eq("id", chapterId)
      .single();

    if (chapterError || !chapter) {
      return NextResponse.json({ success: false, error: "Chapter not found" }, { status: 404 });
    }

    const { data: school, error: schoolError } = await supabaseAdmin
      .from("schools")
      .select("*")
      .eq("id", schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json({ success: false, error: "School not found" }, { status: 404 });
    }

    const subjectData = chapter.subject as unknown as Subject & { grade: Grade };
    const gradeData = subjectData.grade;

    // 2. Load source material images
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

    // 3. Download images and convert to base64
    const imageBase64s: string[] = [];
    for (const material of materials) {
      try {
        const response = await fetch(material.file_url);
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
      return NextResponse.json({
        success: false,
        error: "Could not load any source material images.",
      }, { status: 500 });
    }

    // 4. Generate questions via AI
    const questions = await generateQuestions(
      imageBase64s,
      gradeData.name,
      subjectData.name,
      chapter.name as string
    );

    // 5. Build theme using school's configured colors
    const theme = getTheme(gradeData.band as GradeBand, subjectData.slug, {
      primary: school.primary_color,
      secondary: school.secondary_color,
    });

    // 6. Count existing worksheets for numbering
    const { count } = await supabaseAdmin
      .from("worksheets")
      .select("id", { count: "exact", head: true })
      .eq("chapter_id", chapterId);

    const worksheetNumber = (count || 0) + 1;

    // 7. Generate PDF
    const pdfBuffer = await generateWorksheetPDF({
      school: school as School,
      grade: gradeData as Grade,
      subject: subjectData as Subject,
      chapter: chapter as unknown as Chapter,
      questions,
      worksheetNumber,
      theme,
    });

    // 8. Upload PDF to Supabase storage
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

    // 9. Save worksheet record
    await supabaseAdmin.from("worksheets").insert({
      chapter_id: chapterId,
      school_id: schoolId,
      pdf_url: pdfUrl,
      questions_json: questions,
      page_count: Math.min(4, Math.ceil(questions.metadata.totalQuestions / 8)),
    });

    // 10. Return PDF as base64 for immediate download
    const pdfBase64 = pdfBuffer.toString("base64");

    return NextResponse.json({
      success: true,
      pdfUrl,
      pdfBase64,
      questionCount: questions.metadata.totalQuestions,
      pageCount: Math.min(4, Math.ceil(questions.metadata.totalQuestions / 8)),
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
