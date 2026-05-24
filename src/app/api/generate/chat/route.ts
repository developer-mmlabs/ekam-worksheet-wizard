import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { callLLM } from "@/lib/openrouter";
import { inngest } from "@/inngest/client";
import type { WorksheetQuestions, QuestionSection, Question, MCQOption, MatchPair } from "@/types";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

// ============================================================
// Diff-based edit types the LLM can emit
// ============================================================

interface QuestionEdit {
  action: "replace" | "modify";
  sectionId: string; // e.g. "A", "B", "C"
  questionNumber: number; // Q number within the section
  caseStudyNumber?: number; // if editing a case study sub-question
  // For "modify": partial fields to update
  text?: string;
  assertion?: string;
  reason?: string;
  options?: MCQOption[];
  matchPairs?: MatchPair[];
  subparts?: string[];
  // For "replace": the full replacement question
  replacement?: Question;
}

interface CaseStudyEdit {
  action: "replace_stimulus";
  sectionId: string;
  caseStudyNumber: number;
  stimulus: string;
}

interface LLMResponse {
  reply: string;
  edits?: (QuestionEdit | CaseStudyEdit)[];
}

// ============================================================
// Apply edits to worksheet JSON
// ============================================================

function applyEdits(questions: WorksheetQuestions, edits: (QuestionEdit | CaseStudyEdit)[]): { applied: number; errors: string[] } {
  let applied = 0;
  const errors: string[] = [];

  for (const edit of edits) {
    const section = questions.sections.find((s) => s.id === edit.sectionId);
    if (!section) {
      errors.push(`Section ${edit.sectionId} not found`);
      continue;
    }

    if ("stimulus" in edit && edit.action === "replace_stimulus") {
      // Case study stimulus edit
      const cs = section.caseStudies?.find((c) => c.number === edit.caseStudyNumber);
      if (!cs) {
        errors.push(`Case study ${edit.caseStudyNumber} in Section ${edit.sectionId} not found`);
        continue;
      }
      cs.stimulus = edit.stimulus;
      applied++;
      continue;
    }

    const qEdit = edit as QuestionEdit;

    if (qEdit.caseStudyNumber !== undefined) {
      // Editing a case study sub-question
      const cs = section.caseStudies?.find((c) => c.number === qEdit.caseStudyNumber);
      if (!cs) {
        errors.push(`Case study ${qEdit.caseStudyNumber} in Section ${edit.sectionId} not found`);
        continue;
      }
      const qIdx = cs.questions.findIndex((q) => q.number === qEdit.questionNumber);
      if (qIdx < 0) {
        errors.push(`Q${qEdit.questionNumber} in CS${qEdit.caseStudyNumber} Section ${edit.sectionId} not found`);
        continue;
      }
      if (qEdit.action === "replace" && qEdit.replacement) {
        qEdit.replacement.number = qEdit.questionNumber;
        cs.questions[qIdx] = qEdit.replacement;
      } else {
        applyPartialEdit(cs.questions[qIdx], qEdit);
      }
      applied++;
    } else {
      // Editing a regular question
      const qList = section.questions;
      if (!qList) {
        errors.push(`Section ${edit.sectionId} has no questions array`);
        continue;
      }
      const qIdx = qList.findIndex((q) => q.number === qEdit.questionNumber);
      if (qIdx < 0) {
        errors.push(`Q${qEdit.questionNumber} in Section ${edit.sectionId} not found`);
        continue;
      }
      if (qEdit.action === "replace" && qEdit.replacement) {
        qEdit.replacement.number = qEdit.questionNumber;
        qList[qIdx] = qEdit.replacement;
      } else {
        applyPartialEdit(qList[qIdx], qEdit);
      }
      applied++;
    }
  }

  return { applied, errors };
}

function applyPartialEdit(q: Question, edit: QuestionEdit) {
  if (edit.text !== undefined) q.text = edit.text;
  if (edit.assertion !== undefined) q.assertion = edit.assertion;
  if (edit.reason !== undefined) q.reason = edit.reason;
  if (edit.options !== undefined) q.options = edit.options;
  if (edit.matchPairs !== undefined) q.matchPairs = edit.matchPairs;
  if (edit.subparts !== undefined) q.subparts = edit.subparts;
}

// ============================================================
// Build a compact question index for the system prompt
// (much smaller than full JSON — just enough to reference questions)
// ============================================================

function buildQuestionIndex(questions: WorksheetQuestions): string {
  const lines: string[] = [];
  for (const s of questions.sections) {
    lines.push(`\nSection ${s.id}: ${s.title} (type: ${s.type})`);
    if (s.questions) {
      for (const q of s.questions) {
        const preview = (q.assertion ? `A: ${q.assertion} | R: ${q.reason}` : q.text).slice(0, 120);
        lines.push(`  Q${q.number}: ${preview}`);
        if (q.options) {
          lines.push(`    Options: ${q.options.map((o) => `(${o.label}) ${o.text.slice(0, 50)}`).join(" | ")}`);
        }
      }
    }
    if (s.caseStudies) {
      for (const cs of s.caseStudies) {
        lines.push(`  CS${cs.number}: "${cs.stimulus.slice(0, 100)}..."`);
        for (const q of cs.questions) {
          lines.push(`    Q${q.number}: ${q.text.slice(0, 100)}`);
          if (q.options) {
            lines.push(`      Options: ${q.options.map((o) => `(${o.label}) ${o.text.slice(0, 40)}`).join(" | ")}`);
          }
        }
      }
    }
  }
  return lines.join("\n");
}

// ============================================================
// Route handler
// ============================================================

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

    const questions = worksheet.questions_json as unknown as WorksheetQuestions;
    const questionIndex = buildQuestionIndex(questions);

    const systemPrompt = `You are a worksheet editing assistant. The user wants to modify specific questions in their worksheet through conversation.

WORKSHEET: ${questions.metadata.grade} / ${questions.metadata.subject} / ${questions.metadata.chapter}
TOTAL: ${questions.metadata.totalQuestions} questions

QUESTION INDEX (use this to understand what exists):
${questionIndex}

RESPONDING:
- If the user asks a question or needs clarification, respond normally with just a "reply".
- If the user requests edits, respond with "reply" AND "edits" — a list of surgical changes.

EDIT FORMAT — each edit is one of:
1. MODIFY a field: { "action": "modify", "sectionId": "A", "questionNumber": 3, "text": "new text" }
   - Can modify: text, assertion, reason, options (full array), matchPairs, subparts
   - For case study sub-questions, add "caseStudyNumber": 1
2. REPLACE entirely: { "action": "replace", "sectionId": "A", "questionNumber": 3, "replacement": { "number": 3, "text": "...", ... } }
3. REPLACE stimulus: { "action": "replace_stimulus", "sectionId": "C", "caseStudyNumber": 1, "stimulus": "new 150-word stimulus..." }

RULES:
- Reference questions by their Section ID + question number (e.g. Section A Q3, Section B Q7)
- Only emit edits for questions the user explicitly asks to change
- Keep the same question type when replacing (MCQ stays MCQ, short answer stays short answer)
- When replacing, ensure the new question fits the chapter topic
- Options must have labels "a", "b", "c", "d" and plausible text

RESPONSE FORMAT (pure JSON, no markdown fences):
{
  "reply": "Human-readable summary of what you did or your response",
  "edits": [ ... ]  // ONLY include when making changes. Omit entirely for conversation-only responses.
}`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (history && history.length > 0) {
      for (const msg of history) {
        messages.push({
          role: msg.role === "user" ? "user" : "assistant",
          content: msg.text,
        });
      }
    }

    messages.push({ role: "user", content: message });

    const response = await callLLM(messages);

    let jsonStr = response.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed: LLMResponse = JSON.parse(jsonStr);
    const reply = parsed.reply || "Done.";
    const hasEdits = parsed.edits && parsed.edits.length > 0;

    if (hasEdits) {
      const { applied, errors } = applyEdits(questions, parsed.edits!);

      // Recompute total
      questions.metadata.totalQuestions = questions.sections.reduce((sum, section) => {
        if (section.caseStudies?.length) {
          return sum + section.caseStudies.reduce((s, cs) => s + cs.questions.length, 0);
        }
        return sum + (section.questions?.length ?? 0);
      }, 0);

      const { error: updateError } = await supabaseAdmin
        .from("worksheets")
        .update({
          questions_json: questions,
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

      const fullReply = errors.length > 0
        ? `${reply}\n\n(${applied} edit(s) applied, ${errors.length} skipped: ${errors.join("; ")})`
        : reply;

      return NextResponse.json({ success: true, reply: fullReply, hasEdits: true, applied });
    }

    return NextResponse.json({ success: true, reply, hasEdits: false });
  } catch (error) {
    console.error("Chat edit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat edit failed" },
      { status: 500 }
    );
  }
}
