import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { getTheme } from "../src/lib/pdf/templates/themes";
import { generateWorksheetPDF } from "../src/lib/pdf/generator";
import { HINDI_PDF_FONT, PDF_FONT } from "../src/lib/pdf/fonts";
import { generateQuestions } from "../src/lib/ai/question-generator";
import type { WorksheetPDFData, WorksheetQuestions } from "../src/types";

const require = createRequire(import.meta.url);
const fontkit = require("fontkit") as { openSync(path: string): {
  hasGlyphForCodePoint(code: number): boolean;
  layout(text: string): { glyphs: { id: number }[]; positions: { xAdvance: number }[] };
} };
const specimen = "हिन्दी मातृभूमि विद्यालय प्रश्न दृष्टि प्रार्थना राष्ट्रीय क्षेत्र ज्ञान श्रद्धा क्ष त्र ज्ञ श्र कि की कु कू कृ के कै को कौ चाँद हिंदी फ़िल्म ०१२३४५६७८९";

test("Hindi regular/bold fonts cover and shape Devanagari; Latin/math fallback stays available", () => {
  for (const weight of ["Regular", "Bold"]) {
    const font = fontkit.openSync(`src/lib/pdf/fonts/NotoSansDevanagari-${weight}.ttf`);
    for (const char of specimen) assert.ok(font.hasGlyphForCodePoint(char.codePointAt(0)!), `Missing ${char} in ${weight}`);
    const run = font.layout(specimen);
    assert.ok(run.glyphs.every((glyph) => glyph.id !== 0));
    assert.ok(run.positions.reduce((sum, pos) => sum + pos.xAdvance, 0) > 0);
  }
  for (const band of ["primary", "middle", "senior"] as const) {
    for (const colors of [undefined, { primary: "#2563eb", secondary: "#1d4ed8" }]) {
      assert.deepEqual(getTheme(band, "hindi", colors).fontFamily, [HINDI_PDF_FONT, PDF_FONT]);
      assert.equal(getTheme(band, "science", colors).fontFamily, PDF_FONT);
    }
  }
});

function fixture(multi: boolean): WorksheetPDFData {
  const chapter = { id: "hindi-1", number: 1, name: "मातृभूमि", subject_id: "hindi", created_at: "" };
  const questions: WorksheetQuestions = {
    metadata: { grade: "Grade 6", subject: "Hindi", chapter: "मातृभूमि", totalQuestions: 27,
      ...(multi ? { chapters: [chapter, { id: "hindi-2", number: 2, name: "गोल" }] } : {}) },
    sections: [
      { id: "A", title: "बहुविकल्पीय प्रश्न", type: "mcq", instructions: "सही विकल्प चुनिए। सभी प्रश्नों के उत्तर दीजिए।", questions: Array.from({ length: 12 }, (_, i) => ({ number: i + 1,
        text: i === 0 ? "किस नदी का उल्लेख 'मातृभूमि' कविता में किया गया है?" : i === 1 ? "'वह पुण्य-भूमि मेरी' में 'पुण्य' का अर्थ क्या है?" : "कवि ने अपनी मातृभूमि की किन विशेषताओं का वर्णन किया है? उचित विकल्प चुनिए।",
        options: [{ label: "a", text: "नर्मदा" }, { label: "b", text: "गंगा" }, { label: "c", text: "सरस्वती" }, { label: "d", text: "ब्रह्मपुत्र" }],
      })) },
      { id: "B", title: "अति लघु उत्तरीय प्रश्न", type: "very_short", questions: Array.from({ length: 8 }, (_, i) => ({ number: i + 1,
        text: i === 0 ? specimen : i === 1 ? "मिश्रित पाठ: Grade 6, Worksheet 1, πr², √9 = 3, 5 × 2 = 10." : "विद्यालय में राष्ट्रीय एकता बढ़ाने के लिए आप क्या करेंगे? अपने विचार लिखिए।" })) },
      { id: "C", title: "मिलान कीजिए", type: "match_the_following", questions: [{ number: 1, text: "शब्दों का उनके अर्थ से मिलान कीजिए।", matchPairs: [{ left: "मातृभूमि", right: "जन्मभूमि" }, { left: "पुण्य", right: "पवित्र" }] }] },
      { id: "D", title: "कथन और कारण", type: "assertion_reason", questions: [{ number: 1, text: "संबंध स्पष्ट कीजिए।", assertion: "मातृभूमि हमें प्रिय है।", reason: "यह हमारी जन्मभूमि है।" }] },
      { id: "E", title: "पाठ्यांश आधारित प्रश्न", type: "case_study", caseStudies: [{ number: 1, stimulus: "हमारा विद्यालय एक सुंदर बगीचे के पास है। बच्चे प्रतिदिन वहाँ पेड़ लगाते हैं। वृक्ष हमें छाया और स्वच्छ वायु देते हैं। हमें प्रकृति की रक्षा करनी चाहिए।",
        imageSvg: { viewBox: "0 0 110 110", shapes: [{ type: "circle", cx: 55, cy: 40, r: 20 }, { type: "text", x: 10, y: 90, text: "वृक्ष Tree", fontSize: 10 }] },
        questions: [{ number: 1, text: "बच्चे प्रतिदिन क्या करते हैं?" }, { number: 2, text: "वृक्ष हमारे लिए क्यों आवश्यक हैं?" }] }] },
      { id: "F", title: "दीर्घ उत्तरीय प्रश्न", type: "long_answer", questions: [{ number: 1, text: "मातृभूमि के प्रति अपने कर्तव्यों का वर्णन कीजिए।", subparts: ["पर्यावरण की रक्षा", "समाज के प्रति जिम्मेदारी"] }] },
    ],
  };
  return {
    school: { id: "school", name: "EKAM विद्यालय / School", logo_url: null, primary_color: "#e87979", secondary_color: "#9f1239", location: "बेंगलुरु / Bengaluru", academic_year: "2026-27", created_at: "", updated_at: "" },
    grade: { id: "grade", number: 6, name: "Grade 6", band: "middle", created_at: "" },
    subject: { id: "hindi", name: "Hindi", slug: "hindi", grade_id: "grade", created_at: "" },
    chapter, questions, worksheetNumber: 1,
    theme: getTheme("middle", "hindi", { primary: "#e87979", secondary: "#9f1239" }),
  };
}

test("single, multi and edited Hindi PDFs embed both fonts without an AI request", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new Error("PDF generation must not call AI or download fonts"); });
  await mkdir(".playwright-mcp/hindi-review", { recursive: true });
  for (const mode of ["single", "multi", "edited"]) {
    const data = fixture(mode !== "single");
    if (mode === "edited") data.questions.sections[0].questions![0].text = "संशोधित प्रश्न: मातृभूमि के प्रति हमारा क्या कर्तव्य है?";
    const pdf = await generateWorksheetPDF(data);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.match(pdf.toString("latin1"), /NotoSansDevanagari/);
    assert.match(pdf.toString("latin1"), /DejaVuSans/);
    await writeFile(`.playwright-mcp/hindi-review/${mode}.pdf`, pdf);
  }
});

test("Hindi prompts explicitly request Devanagari at both generic and Class 10 levels", async (t) => {
  let system = "";
  t.mock.method(globalThis, "fetch", async (_input: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    system = body.messages[0].content;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ metadata: { grade: "Grade 6", subject: "Hindi", chapter: "मातृभूमि", totalQuestions: 0 }, sections: [] }) } }] });
  });
  for (const gradeNumber of [6, 10]) {
    await generateQuestions([], { gradeNumber, gradeName: `Grade ${gradeNumber}`, subjectName: "Hindi", subjectSlug: "hindi", chapterName: "मातृभूमि" }, {});
    assert.match(system, /Hindi using Devanagari script/);
    assert.match(system, /Keep JSON field names/);
  }
  await generateQuestions([], { gradeNumber: 6, gradeName: "Grade 6", subjectName: "Science", subjectSlug: "science", chapterName: "Plants" }, {});
  assert.doesNotMatch(system, /HINDI LANGUAGE/);
});
