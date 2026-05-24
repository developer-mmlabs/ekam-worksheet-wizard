import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { processWorksheet, regeneratePDF } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processWorksheet, regeneratePDF],
});
