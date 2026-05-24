import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { callLLM, createTextContent } from "@/lib/openrouter";
import { inngest } from "@/inngest/client";
import type { WorksheetQuestions } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { worksheetId, message } = await req.json();

    if (!worksheetId || !message) {
      return NextResponse.json({ error: "worksheetId and message are required" }, { status: 400 });
    }

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

    const systemPrompt = `You are a worksheet editing assistant. The user has a generated worksheet and wants to modify specific questions.

CURRENT WORKSHEET (JSON):
${JSON.stringify(questions, null, 2)}

RULES:
- The user will describe which questions they want changed and how.
- Apply ONLY the changes they request. Do not modify any other questions.
- Maintain the exact same JSON structure, section IDs, types, and question numbering.
- Keep the same number of questions in each section.
- If the user asks to replace a question, write a new question on the same topic/type that fits the chapter context.
- If the user asks to modify wording, options, or difficulty — do exactly that.
- Respond with a JSON object containing two fields:
  1. "reply": A brief human-readable summary of what you changed (1-2 sentences).
  2. "questions": The FULL updated worksheet JSON (same structure as the input, with your edits applied).

Output PURE JSON only — no markdown fences, no commentary outside the JSON.`;

    const response = await callLLM([
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ]);

    let jsonStr = response.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr);
    const updatedQuestions: WorksheetQuestions = parsed.questions;
    const reply: string = parsed.reply || "Changes applied.";

    // Save updated questions and trigger PDF re-render
    const { error: updateError } = await supabaseAdmin
      .from("worksheets")
      .update({
        questions_json: updatedQuestions,
        status: "processing",
      })
      .eq("id", worksheetId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to save changes" }, { status: 500 });
    }

    await inngest.send({
      name: "worksheet/pdf.regenerate",
      data: { worksheetId },
    });

    return NextResponse.json({ success: true, reply });
  } catch (error) {
    console.error("Chat edit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat edit failed" },
      { status: 500 }
    );
  }
}
