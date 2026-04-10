# Worksheet Wizard

AI-powered worksheet generator for Indian schools (CBSE/ICSE). Teachers select a grade, subject, and chapter; the app sends NCERT textbook page images to an LLM, which generates structured questions; a PDF worksheet is rendered server-side and returned for download.

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 3
- **Database & Storage**: Supabase (Postgres + Storage buckets)
- **AI**: OpenRouter API (Qwen 2.5 VL 72B) for vision-based question generation
- **PDF**: `@react-pdf/renderer` (server-side, via `serverExternalPackages` in next.config.ts)

## Architecture

```
User selects chapter → POST /api/generate
  → Fetch chapter metadata + source material image URLs from Supabase
  → Download images, convert to base64
  → Send to OpenRouter LLM with system prompt → get structured JSON questions
  → Render PDF with @react-pdf/renderer (themed by subject + school colors)
  → Upload PDF to Supabase Storage
  → Return PDF as base64 for immediate download
```

### Database Schema (Supabase)

`schools` → `grades` → `subjects` → `chapters` → `source_materials` / `worksheets`

- **grades**: 1-12, with `band` (primary/middle/senior)
- **subjects**: slug-based (`science`, `mathematics`, `english`, `social_studies`, `hindi`, `physics`, `chemistry`, `biology`, `evs`, `computer_science`)
- **source_materials**: Textbook page images stored in `source-materials` bucket, referenced by `file_url`
- **worksheets**: Generated PDFs stored in `worksheets` bucket

Foreign keys cascade on delete. Full schema in `supabase/schema.sql`.

### Storage Buckets

- `source-materials` — NCERT textbook page images (JPEG, ~220-315 KB each)
- `worksheets` — Generated PDF worksheets
- `school-assets` — School logos

### Key Directories

- `src/app/` — Next.js pages and API routes
- `src/app/api/generate/route.ts` — Main generation endpoint (the core pipeline)
- `src/app/api/setup/route.ts` — DB schema creation + seed (POST creates, GET returns raw SQL)
- `src/lib/ai/question-generator.ts` — LLM prompt and response parsing
- `src/lib/openrouter.ts` — OpenRouter API client
- `src/lib/pdf/` — PDF generation (generator, header, section components, decorations, themes)
- `src/lib/pdf/templates/themes.ts` — Subject color palettes + school color derivation
- `src/lib/pdf/decorations.tsx` — SVG icon sets and background shapes per subject
- `src/lib/supabase/` — Client (browser) and server (admin) Supabase clients
- `src/types/index.ts` — All TypeScript interfaces
- `scripts/` — Seed scripts for populating Supabase from local NCERT images

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run seed:ncert   # Seed NCERT content: npx tsx scripts/seed-ncert.ts [grade_numbers...]
```

The seed script reads from a local `ncert-textbook-images/` directory (not in this repo — lives in `../worksheet-wizard-assets/`). It manually loads `.env.local` since it runs outside Next.js. Supports CLI grade filtering: `npm run seed:ncert -- 2 4 7 10`.

## Environment Variables

Required for both local dev and Vercel deployment:

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client | Supabase anon/public key |
| `SUPABASE_SECRET_KEY` | Server only | Supabase service role key |
| `OPENROUTER_API_KEY` | Server only | OpenRouter API key for LLM calls |
| `OPENROUTER_MODEL` | Server only (optional) | Model override, defaults to `qwen/qwen2.5-vl-72b-instruct` |

## Important Conventions

- **Subject slugs** are the canonical identifiers used across themes, decorations, and database. Always use the slug (e.g., `social_studies`, not `Social Science`).
- **Grade bands**: primary (1-5), middle (6-9), senior (10-12). Affects PDF font, decoration opacity.
- **School colors**: When a school has configured `primary_color`/`secondary_color`, the theme system derives all palette colors from those. Otherwise falls back to subject-specific palettes.
- **Question generation**: The AI returns exactly the questions it generates. Never pad, remove, or reorder questions to fill layout space.
- **PDF rendering** happens server-side only. `@react-pdf/renderer` is listed in `serverExternalPackages` to work on Vercel.
- **Supabase clients**: Use `supabaseAdmin` (from `lib/supabase/server.ts`) in API routes. Use `supabase` (from `lib/supabase/client.ts`) in client components. Both use lazy-init Proxy pattern to avoid build-time env var errors.

## Current Test Data

Supabase is seeded with grades 2, 4, 7, 10 (17 subjects, 267 chapters, ~4,056 textbook page images). Default school: "EKAM INSTITUTIONS" (schoolId: `9c118b4c-deb1-47df-9975-b2deeae37cfe`). Free tier limit: 1 GB storage.
