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
queue deadline. When the worker starts, it receives a separate 15-minute execution
deadline. Inngest step retries retain that deadline; an explicit retry starts a
new attempt. Status requests and a minute-by-minute Inngest cleanup job expire
overdue attempts. Progress timestamps describe completed stage transitions,
not a claim that an external AI request is still responsive.

Timeout cancellation is best-effort; an already-running provider request may
continue, but a superseded or expired attempt cannot replace the current PDF.
Model requests have a 12-minute request timeout (illustrations: 2 minutes);
provider and hosting limits can still fail earlier. History refreshes every
10 seconds and offers Retry for tracked failures. Older failures without saved
request settings must be retried from Generate with the chapters selected again.
