import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { callLLM } from "@/lib/openrouter";
import { inngest } from "@/inngest/client";
import type { WorksheetQuestions } from "@/types";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export async function POST(req: NextRequest) {
  try {
    const { worksheetId, message, history } = await req.json() as {
      worksheetId: string;
      message: string;
      history?: ChatMessage[];
    };

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

    // Always read the LATEST questions_json from DB (may have been updated by previous chat turns)
    const questions = worksheet.questions_json as unknown as WorksheetQuestions;

    const systemPrompt = `You are a worksheet editing assistant. The user has a generated worksheet and wants to modify specific questions through conversation.

CURRENT WORKSHEET (JSON) — this reflects ALL prior edits in this session:
${JSON.stringify(questions, null, 2)}

RULES:
- The user will describe which questions they want changed and how.
- Apply ONLY the changes they request. Do not modify any other questions.
- Maintain the exact same JSON structure, section IDs, types, and question numbering.
- Keep the same number of questions in each section.
- If the user asks to replace a question, write a new question on the same topic/type that fits the chapter context.
- If the user asks to modify wording, options, or difficulty — do exactly that.
- If the user asks a clarifying question or just wants to discuss (not requesting edits), respond conversationally WITHOUT producing the "questions" field. Only include "questions" when you are actually making changes.
- Respond with a JSON object:
  - Always include "reply": A human-readable response (what you changed, or your answer to the user's question).
  - Include "questions" ONLY when you made edits: the FULL updated worksheet JSON (same structure as input, with edits applied).
  - If no edits were made (just conversation), omit the "questions" field entirely.

Output PURE JSON only — no markdown fences, no commentary outside the JSON.`;

    // Build the full message chain: system + conversation history + new message
    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // Replay conversation history so the LLM has full context
    if (history && history.length > 0) {
      for (const msg of history) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.text,
        });
      }
    }

    // Add the new message
    messages.push({ role: "user", content: message });

    const response = await callLLM(messages);

    let jsonStr = response.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr);
    const reply: string = parsed.reply || "Changes applied.";
    const hasEdits = !!parsed.questions;

    if (hasEdits) {
      const updatedQuestions: WorksheetQuestions = parsed.questions;

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
    }

    return NextResponse.json({ success: true, reply, hasEdits });
  } catch (error) {
    console.error("Chat edit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat edit failed" },
      { status: 500 }
    );
  }
}
