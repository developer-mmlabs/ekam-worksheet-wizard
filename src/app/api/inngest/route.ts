import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processWorksheet, processMultiWorksheet, regeneratePDF, expireWorksheetAttempts } from "@/inngest/functions";

export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processWorksheet, processMultiWorksheet, regeneratePDF, expireWorksheetAttempts],
});
