# Worksheet Wizard

## Local development

Install dependencies with `npm install`, configure `.env.local`, then run:

```powershell
npm run dev
```

This starts Next.js and the Inngest development server together. Logs are labelled
`app` and `queue`. Next.js starts on port 3000 and tries the next available port
if it is occupied. Open the app URL printed by Next.js. Inngest discovers local
apps automatically, including ports 3000 through 3010.

Open `http://localhost:8288/apps` and wait for `worksheet-wizard` to appear before
generating a worksheet. Press Ctrl+C to stop both services. If either service
exits, the combined command stops the other as well.

Stop previous instances of this project's app and queue before starting the
combined command. Run only one instance of this project to avoid discovering an
older copy on another port.

For troubleshooting, run these commands in separate terminals:

```powershell
npm run dev:app
npm run dev:queue
```

For a port outside Inngest's discovery range, explicitly supply the matching URL:

```powershell
npm run dev:app -- --port 3030
npm run dev:queue -- --no-discovery -u http://localhost:3030/api/inngest
```

These commands are for local development. Vercel uses the production build and
Inngest Cloud; it does not run the local development queue.

## Generation attempts

Apply `supabase/migrations/20261012_worksheet_attempts.sql` before running the updated
workers. Stop older workers during rollout; they do not enforce attempt IDs.
The migration keeps completed worksheets and PDFs and marks untracked legacy
pending/processing rows as failed so they can be retried explicitly.

With the existing admin `exec_sql` RPC configured, validate (all changes rolled back)
and apply using:

```powershell
node --env-file=.env.local --import tsx scripts/migrate-worksheet-attempts.ts --test
node --env-file=.env.local --import tsx scripts/migrate-worksheet-attempts.ts --apply
```

Otherwise run the migration in the Supabase SQL editor. These SQL functions are
restricted to the service role. Each attempt has its own identity and a 15-minute
queue deadline. When the worker starts, Single Chapter and PDF edits receive a separate 15-minute execution
deadline. Multi Chapter uses the workload budget described below. Inngest step retries retain that deadline; an explicit retry starts a
new attempt. Status requests and a minute-by-minute Inngest cleanup job expire
overdue attempts. Progress timestamps describe completed stage transitions,
not a claim that an external AI request is still responsive.

Timeout cancellation is best-effort; an already-running provider request may
continue, but a superseded or expired attempt cannot replace the current PDF.
Single-chapter model requests have a 12-minute request timeout (illustrations: 2 minutes);
provider and hosting limits can still fail earlier. History refreshes every
10 seconds and offers Retry for tracked failures. Older failures without saved
request settings must be retried from Generate with the chapters selected again.

## Resumable multi-chapter generation

Apply `supabase/migrations/20261012_multi_chapter_checkpoints.sql` after the attempts
migration and before deploying the new worker. With the admin SQL RPC:

```powershell
node --env-file=.env.local --import tsx scripts/migrate-worksheet-attempts.ts --multi --test
node --env-file=.env.local --import tsx scripts/migrate-worksheet-attempts.ts --multi --apply
```

Multi Chapter uses the same configured OpenRouter model. It reads each source page
sequentially as one resized image, saves concise source notes (including Hindi and
quoted passages), then generates batches of up to four questions or one case study.
Each writer request uses a bounded selection of those notes spread across the chapter.
The notes are summaries, not a complete transcription; teachers should still review
questions and quotations before finalizing. Question counts are totals across all
chapters. Class 10 grammar remains a separate section from short answers.
The app records each batch's supplied reference pages itself; these are not
AI-verified citations. Missing or incorrect page IDs in an AI response do not
block generation. Question content, counts, and structure still require validation.
Blank pages and unused Notes pages are saved as skipped checkpoints and excluded
from question references. Their IDs are retained in `metadata.skippedSourcePages`.
Educational content that is unreadable produces a specific clearer-image error;
a chapter containing only non-content pages cannot generate questions. Existing
successful text checkpoints remain reusable after this reader update.

Each AI call has a 90-second timeout, with at most two automatic retries for a
retryable failed step. Inngest yields between steps; the Next.js endpoint declares
`maxDuration = 300` and requires a Vercel configuration that permits that duration.
The execution budget is `2 × pages + 3 × question batches + 10` minutes, bounded to
20–120 minutes. This is a deadline, not an expected duration. Queue waiting still
has its separate 15-minute deadline. Requests are limited to 400 pages and must
have enough question items to represent every selected chapter.

Progress reports completed chapters and the current page/batch. If a step fails,
History and Generate show the failure and offer Retry. **Retry keeps the generation
ID and reuses saved page notes and question batches**, including successful batches
within the failed chapter. A fresh Generate request starts over with a new ID.
Changing sources, settings, prompts or the model invalidates dependent checkpoints.
No partial PDF is published: every chapter must finish and counts/types must pass
validation before the existing PDF renderer runs. Combining results uses code and
does not require another AI call. An earlier PDF remains available during retries.

Checkpoints are service-role-only and are deleted when their worksheet is deleted.
Attempt IDs and database deadlines prevent late workers overwriting current work.
A provider call that succeeds but cannot save its result may be repeated; provider
charges and occasional network/provider timeouts cannot be eliminated. Single
Chapter retains its existing generation prompt, model, and request timeout.
