import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "worksheet-wizard",
  // Local edits must run on the local worker, not an older cloud deployment.
  // Explicit INNGEST_DEV settings still take precedence.
  isDev: process.env.INNGEST_DEV === undefined && process.env.NODE_ENV === "development" ? true : undefined,
});
