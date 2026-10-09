import { join } from "node:path";
import { Font } from "@react-pdf/renderer";

// ============================================================
// PDF font registration. DejaVu Sans replaces react-pdf's built-in
// Helvetica because Helvetica is WinAnsi-only — Unicode math glyphs
// (√, π, ≈, ≤, ≥, ∑, ∫, etc.) silently render as zero-width with it.
// DejaVu Sans covers Latin, Greek, math operators, and currency in
// one TTF, so a "200√3 m" string renders as written.
//
// Fonts are bundled in src/lib/pdf/fonts/ and the path is registered
// via outputFileTracingIncludes in next.config.ts so they ship with
// Vercel serverless functions.
// ============================================================

export const PDF_FONT = "DejaVuSans";
export const HINDI_PDF_FONT = "NotoSansDevanagari";

export function pdfFontForSubject(subject: string): string | string[] {
  return subject === "hindi" ? [HINDI_PDF_FONT, PDF_FONT] : PDF_FONT;
}

let registered = false;

export function registerPdfFonts() {
  if (registered) return;

  const fontsDir = join(process.cwd(), "src", "lib", "pdf", "fonts");

  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: join(fontsDir, "DejaVuSans.ttf"), fontWeight: "normal", fontStyle: "normal" },
      { src: join(fontsDir, "DejaVuSans-Bold.ttf"), fontWeight: "bold", fontStyle: "normal" },
      { src: join(fontsDir, "DejaVuSans-Oblique.ttf"), fontWeight: "normal", fontStyle: "italic" },
      { src: join(fontsDir, "DejaVuSans-BoldOblique.ttf"), fontWeight: "bold", fontStyle: "italic" },
    ],
  });

  Font.register({
    family: HINDI_PDF_FONT,
    fonts: [
      { src: join(fontsDir, "NotoSansDevanagari-Regular.ttf"), fontWeight: "normal", fontStyle: "normal" },
      { src: join(fontsDir, "NotoSansDevanagari-Bold.ttf"), fontWeight: "bold", fontStyle: "normal" },
      // Noto Devanagari has no italic face. Use upright Hindi for inherited italic styles.
      { src: join(fontsDir, "NotoSansDevanagari-Regular.ttf"), fontWeight: "normal", fontStyle: "italic" },
      { src: join(fontsDir, "NotoSansDevanagari-Bold.ttf"), fontWeight: "bold", fontStyle: "italic" },
    ],
  });
  registered = true;
}
