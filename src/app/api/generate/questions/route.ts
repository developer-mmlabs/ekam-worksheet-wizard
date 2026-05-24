import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";
import type { QuestionEditRequest, WorksheetQuestions } from "@/types";

export async function PATCH(req: NextRequest) {
  try {
    const body: QuestionEditRequest = await req.json();
    const { worksheetId, updates } = body;

    if (!worksheetId || !updates || updates.length === 0) {
      return NextResponse.json({ error: "worksheetId and updates are required" }, { status: 400 });
    }

    if (updates.length > 5) {
      return NextResponse.json({ error: "Maximum 5 edits per request" }, { status: 400 });
    }

    // Load the worksheet
    const { data: worksheet, error: fetchError } = await supabaseAdmin
      .from("worksheets")
      .select("id, status, is_finalized, questions_json")
      .eq("id", worksheetId)
      .single();

    if (fetchError || !worksheet) {
      return NextResponse.json({ error: "Worksheet not found" }, { status: 404 });
    }

    if (worksheet.is_finalized) {
      return NextResponse.json({ error: "Cannot edit a finalized worksheet" }, { status: 400 });
    }

    if (worksheet.status !== "completed") {
      return NextResponse.json({ error: "Can only edit completed worksheets" }, { status: 400 });
    }

    const questions = worksheet.questions_json as unknown as WorksheetQuestions;

    // Apply updates
    for (const update of updates) {
      const section = questions.sections[update.sectionIndex];
      if (!section) continue;

      let question;
      if (update.caseStudyIndex !== undefined) {
        const cs = section.caseStudies?.[update.caseStudyIndex];
        if (!cs) continue;
        question = cs.questions[update.questionIndex];
      } else {
        question = section.questions?.[update.questionIndex];
      }

      if (!question) continue;

      // Apply the partial changes
      Object.assign(question, update.changes);
    }

    // Save updated questions_json and set status to processing for PDF re-render
    const { error: updateError } = await supabaseAdmin
      .from("worksheets")
      .update({
        questions_json: questions,
        status: "processing",
      })
      .eq("id", worksheetId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to save question changes" }, { status: 500 });
    }

    // Trigger PDF re-render
    await inngest.send({
      name: "worksheet/pdf.regenerate",
      data: { worksheetId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Question edit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to edit questions" },
      { status: 500 }
    );
  }
}
