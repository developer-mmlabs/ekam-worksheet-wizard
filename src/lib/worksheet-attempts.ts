import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import { supabaseAdmin } from "@/lib/supabase/server";

export function errorMessage(error: unknown): string {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message : "Unknown generation error";
}

export async function expireAttempts() {
  const { data, error } = await supabaseAdmin.rpc("expire_worksheet_attempts");
  if (error) throw new Error("Unable to verify job status. Check the worksheet-attempts database migration.");
  if (data?.length) {
    // Cancellation is best-effort; DB fencing still rejects late writes if the queue is offline.
    try {
      await inngest.send(data.filter((row: { attempt_id: string | null }) => row.attempt_id).map((row: { attempt_id: string }) => ({
        name: "worksheet/attempt.cancelled", data: { attemptId: row.attempt_id },
      })));
    } catch (error) { console.warn("Attempt cancellation could not reach queue:", errorMessage(error)); }
  }
}

export async function updateAttempt(id: string, attemptId: string, action: string, data: Record<string, unknown> = {}) {
  const result = await supabaseAdmin.rpc("update_worksheet_attempt", {
    p_id: id, p_attempt: attemptId, p_action: action, p_data: data,
  });
  if (result.error) throw new Error(`Unable to save attempt ${action}: ${result.error.message}`);
  return result.data === true;
}

export async function requireAttempt(id: string, attemptId: string, action: string, data: Record<string, unknown> = {}) {
  if (!attemptId || !await updateAttempt(id, attemptId, action, data)) {
    throw new NonRetriableError("This attempt expired or was replaced. Its result will not be saved.");
  }
}

export async function queueAttempt(data: Record<string, unknown>, kind: "generate" | "pdf", expectedAttempt?: string | null) {
  await expireAttempts();
  const result = await supabaseAdmin.rpc("queue_worksheet_attempt", {
    p_data: data, p_kind: kind, p_expected: expectedAttempt ?? null,
  });
  if (result.error) throw new Error(`Unable to start attempt: ${result.error.message}`);
  const { worksheet, claimed } = result.data;
  if (!claimed) {
    if (kind === "pdf" && data.questions_json) throw new Error("Another attempt is active. Wait for it to finish before editing.");
    return worksheet;
  }
  try {
    await inngest.send({
      id: worksheet.attempt_id,
      name: kind === "pdf" ? "worksheet/pdf.regenerate"
        : worksheet.attempt_request?.chapterIds?.length > 1 ? "worksheet/multi.generate.requested" : "worksheet/generate.requested",
      data: { ...(kind === "generate" ? worksheet.attempt_request : {}), worksheetId: worksheet.id, attemptId: worksheet.attempt_id },
    });
  } catch (error) {
    await updateAttempt(worksheet.id, worksheet.attempt_id, "fail", {
      error_message: `Unable to queue generation. Check Inngest and retry. ${errorMessage(error)}`,
    });
    throw new Error("Unable to queue generation. Check Inngest and retry.");
  }
  return worksheet;
}
