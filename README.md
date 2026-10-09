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
