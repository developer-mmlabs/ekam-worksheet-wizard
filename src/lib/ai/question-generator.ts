import { callLLM, createImageContent, createTextContent } from "@/lib/openrouter";
import { WorksheetQuestions, WorksheetConfigValues } from "@/types";

export interface GenerationContext {
  gradeNumber: number;
  gradeName: string;
  subjectSlug: string;
  subjectName: string;
  chapterName: string;
}

// ============================================================
// Class 10 CBSE subject-specific prompts
// Pattern: chapter-wise practice worksheet with Sections A, B, C
//   A = pool of short-answer questions (config.sectionA controls count)
//   B = assertion-reason / grammar / vyakaran (config.assertionReason)
//   C = case study / source-based / literature extract / apathit bodh (config.caseStudy)
// Output is text-only. No marks shown. All questions compulsory.
// ============================================================

const ASSERTION_REASON_KEY = `Directions: Each question consists of two statements - Assertion (A) and Reason (R). Choose the correct option:
(a) Both A and R are true and R is the correct explanation of A.
(b) Both A and R are true but R is NOT the correct explanation of A.
(c) A is true but R is false.
(d) A is false but R is true.`;

const SECTION_A_QUALITY_RULES = `
QUALITY RULES FOR SECTION A:
- NO near-duplicate questions. Two questions must not test the same micro-concept with the same operation (e.g. don't ask "Express 156 as a product of its prime factors" AND "Express 5005 as a product of its prime factors" - pick one).
- Vary BOTH the numbers AND the framing. A question type should appear at most 2-3 times across Section A.
- Distribute across all topics of the chapter, not just the first few pages of source material.
- Order by cognitive level: first third = recall/definitions, middle third = computation/standard application, last third = word problems/proofs/HOTS.
- Use a wide variety of directives: "Find", "Solve", "Prove", "Show that", "Verify", "State", "Justify", "Construct", "Explain why", "Distinguish between", "Give an example of".`;

const CASE_STUDY_QUALITY_RULES = `
QUALITY RULES FOR THE STIMULUS-AND-SUBQUESTIONS BLOCK:
- The stimulus must include concrete numbers, named entities, and a clear setting that the sub-questions can actually interrogate. Avoid vague generalities.
- Sub-questions must escalate in difficulty: first 1-2 are direct lookups from the stimulus, last 1-2 require multi-step reasoning or computation that the stimulus supports.
- All four MCQ options must be plausible. Mix the correct option position across sub-questions (don't always make it option (a)).
- When generating MULTIPLE case studies, each one must use a DIFFERENT real-world context (e.g. don't make every case study about athletes - one could be finance, another design, another daily-life logistics, another sports). Different chapter sub-topics where applicable.`;

const IMAGE_RULES = `
IMAGE RULES — for each case study, decide whether to include an image and which path to use. Modern image-generation models (Gemini 2.5/3 Image, GPT Image 2) reliably handle illustrative diagrams with simple labels, layouts, and real-world scenes — use AI generously where it fits.

OPTION 1 — Emit "imagePrompt" (Track A, AI image generation):
Use when the image is a SCENE, ILLUSTRATIVE DIAGRAM, LAYOUT, or simple chart that current AI image models can produce well. Examples:
- Real-world scenes: "A young Indian student flying a colourful diamond kite in an open park..."
- Concept illustrations with simple labels: "A parabolic satellite dish receiving incoming signals concentrated at a focal point, labels: FOCUS, AXIS OF SYMMETRY, PARABOLA, INCOMING SIGNALS"
- Layout/design diagrams: "Aerial view of a rectangular garden divided into two flower beds with a walking path along one side, dimensions labelled: Total Length 10 m, Total Width 6 m, Flower Bed A, Flower Bed B, Walking Path"
- Simple data visualisations: "A flat infographic showing a 100-question quiz split: x questions learned correctly (green ticks) and 100-x questions guessed wrong (red crosses)"
- Style: flat illustrative, soft colours, white background, minimal short labels (1-5 words each).
- Prompt format: 1-3 sentences describing the scene/diagram. List key labels in plain language; trust the renderer to place them sensibly.

OPTION 2 — Emit "imageNcertHint" (Track B, NCERT extraction — currently a no-op; placeholder for future):
Use when the image is something current AI image generation still CANNOT do reliably:
- Outline maps with country/state borders (India political map, world map)
- Recognisable likeness of specific named historical figures (Gandhi, Nehru, Bose, Lala Lajpat Rai, etc.)
- Exact NCERT-original political cartoons or paintings
- Anatomically precise labelled diagrams (heart with all chambers/valves, eye with retina/cornea, alimentary canal) where pedagogical accuracy matters
- Electrical circuit topology where component connectivity must be correct
imageNcertHint format: a short phrase describing what should be found/cropped from NCERT material, e.g. "Political outline map of India with state borders", "Portrait of Mahatma Gandhi", "Diagram of the human eye with retina and cornea labelled".

CHOICE RULES:
- Pick AT MOST ONE of the two fields per case study. Never both.
- OMIT BOTH fields when no image adds pedagogical value (abstract math problems, text-only source extracts where the extract itself IS the content).
- Do not invent images just to fill the field — pedagogical value first.
- Do not name real public figures or branded products in Option 1 prompts. If a public figure is essential, use Option 2.`;

const ASSERTION_REASON_QUALITY_RULES = `
QUALITY RULES FOR ASSERTION-REASON SECTION:
- COVER THE FULL BREADTH of the chapter. Identify the chapter's distinct sub-topics, then distribute items so that no single sub-topic gets more than ~30% of the items (e.g. with 10 items, no sub-topic exceeds 3 items).
- NO duplicate or near-duplicate Reasons. Each Reason statement (R) must be UNIQUE across all items - both in the concept it cites and in its wording. If item 1's R refers to "parallel lines", no other item's R may refer to "parallel lines".
- NO mirror items. Don't generate two items that are essentially the same claim phrased oppositely (e.g. "consistent if unique solution" and "inconsistent if no solution" are the same idea - pick one).
- MIX the four correct outcomes deliberately. Across the items, aim for roughly equal counts of (a), (b), (c), (d) as the right answer. Do NOT make most items (a).
- AVOID vague meta-claims like "X method is the most accurate" or "X is not suitable" - those are debatable subjective statements, not crisp factual assertions. Stick to concrete properties, theorems, and definitions from the chapter.`;

const GRAMMAR_QUALITY_RULES = `
QUALITY RULES FOR GRAMMAR SECTION:
- Spread items across at least 4 different grammatical categories from this list: Tenses, Modals, Reported Speech, Subject-Verb Concord, Determiners, Active/Passive, Articles, Prepositions, Conditionals.
- No two items should test the same grammatical rule in the same way.
- Each item is a stand-alone exercise (no carry-over context between items).`;

const VYAKARAN_QUALITY_RULES = `
खंड B (व्याकरण) के लिए गुणवत्ता नियम:
- व्याकरण की कम से कम 4 अलग-अलग श्रेणियों में प्रश्न फैलाएं: रचना के आधार पर वाक्य भेद, वाच्य, पद-परिचय, समास, रस, अलंकार, मुहावरे।
- दो प्रश्न एक ही व्याकरण नियम का एक ही ढंग से परीक्षण नहीं करने चाहिए।
- प्रत्येक प्रश्न स्वतंत्र अभ्यास हो।`;

function class10Maths(chapterName: string, cfg: WorksheetConfigValues): string {
  return `You are an expert CBSE Class 10 Mathematics worksheet creator. Generate a chapter-wise practice worksheet aligned to the NCERT textbook pages provided.

CHAPTER: ${chapterName}

STRICT COUNTS — generate EXACTLY (not approximately):
- Section A: EXACTLY ${cfg.sectionA} short-answer questions. Not ${cfg.sectionA - 1}, not ${cfg.sectionA + 1}.
- Section B: EXACTLY ${cfg.assertionReason} assertion-reason items.
- Section C: EXACTLY ${cfg.caseStudy} case studies (each with EXACTLY 4 MCQ sub-questions).
Count your output items before submitting.

WORKSHEET STRUCTURE - produce exactly 3 sections:

SECTION A - Short Answer Questions (${cfg.sectionA} items)
A mixed pool of concept, computation, proof and application questions. No marks shown. No options.
${SECTION_A_QUALITY_RULES}

SECTION B - Assertion and Reason (${cfg.assertionReason} items)
Use the standard 4-option key (in section instructions, not per item). Each item is a pair: Assertion (A) and Reason (R) - both full statements derived from chapter concepts.
${ASSERTION_REASON_QUALITY_RULES}

SECTION C - Case Study (${cfg.caseStudy} case studies)
Each case study has a SUBSTANTIAL real-world stimulus of 150-200 words (8-12 lines), drawing from sports, finance, design, structures, daily life — followed by 4 MCQ sub-questions (4 options each). The stimulus must establish a concrete scenario with multiple named quantities, parties, or constraints so the sub-questions have ample material to interrogate.

Each case study MAY include an image — decide per case study using IMAGE RULES below. Pick at most one of "imagePrompt" or "imageNcertHint", or omit both when no image adds pedagogical value.
${CASE_STUDY_QUALITY_RULES}
${IMAGE_RULES}

GLOBAL RULES:
- Every question must be directly derived from the chapter content in the provided textbook pages.
- Mathematical notation as plain text (x^2, sqrt(15), 22/7). No LaTeX.
- Output PURE JSON only - no markdown fences, no commentary, no preamble.

VERIFICATION before responding:
- sections[0].questions.length === ${cfg.sectionA}
- sections[1].questions.length === ${cfg.assertionReason}
- sections[2].caseStudies.length === ${cfg.caseStudy}
- Each caseStudies[i].questions.length === 4
If any count is off, fix it before producing the response.

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "Mathematics", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
    { "id": "A", "title": "Short Answer Questions", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<actual question>" }] },
    { "id": "B", "title": "Assertion and Reason", "type": "assertion_reason",
      "instructions": ${JSON.stringify(ASSERTION_REASON_KEY)},
      "questions": [{ "number": 1, "assertion": "<full assertion statement>", "reason": "<full reason statement>", "text": "" }] },
    { "id": "C", "title": "Case Study", "type": "case_study",
      "caseStudies": [{
        "number": 1,
        "stimulus": "<150-200 word real-world scenario, 8-12 lines>",
        "imagePrompt": "<EITHER an AI image prompt (Track A) OR omit and use imageNcertHint instead, OR omit both>",
        "imageNcertHint": "<EITHER a Track B hint for NCERT extraction (e.g. 'India political map') OR omit>",
        "questions": [{ "number": 1, "text": "<sub-question>", "options": [
          {"label": "a", "text": "<option>"}, {"label": "b", "text": "<option>"},
          {"label": "c", "text": "<option>"}, {"label": "d", "text": "<option>"}
        ]}]
      }] }
  ]
}`;
}

function class10Science(chapterName: string, cfg: WorksheetConfigValues): string {
  return `You are an expert CBSE Class 10 Science worksheet creator. Generate a chapter-wise practice worksheet aligned to the NCERT textbook pages provided.

CHAPTER: ${chapterName}

STRICT COUNTS — generate EXACTLY (not approximately):
- Section A: EXACTLY ${cfg.sectionA} short-answer questions.
- Section B: EXACTLY ${cfg.assertionReason} assertion-reason items.
- Section C: EXACTLY ${cfg.caseStudy} case studies (each with EXACTLY 4 MCQ sub-questions).
Count your output items before submitting.

WORKSHEET STRUCTURE - produce exactly 3 sections:

SECTION A - Short Answer Questions (${cfg.sectionA} items)
A mixed pool of concept, explanation, application and reasoning questions. Include at least 4 "Give a reason for..." or "Explain why..." items. No marks shown.
${SECTION_A_QUALITY_RULES}

SECTION B - Assertion and Reason (${cfg.assertionReason} items)
Standard 4-option key (in section instructions). Each item is a pair: Assertion (A) and Reason (R) - both full statements from chapter concepts.
${ASSERTION_REASON_QUALITY_RULES}

SECTION C - Case Study (${cfg.caseStudy} case studies)
Each case study has a SUBSTANTIAL scientific stimulus of 150-200 words (8-12 lines) — an experimental setup, real-world phenomenon, observation table, or principle in action — followed by 4 MCQ sub-questions (4 options each). Include data, numbers, specific observations, and named entities so the sub-questions have rich material to probe.

Each case study MAY include an image — decide per case study using IMAGE RULES below. Pick at most one of "imagePrompt" or "imageNcertHint", or omit both when no image adds pedagogical value.
${CASE_STUDY_QUALITY_RULES}
${IMAGE_RULES}
Science-specific guidance:
- For real-world phenomena (power plants, ecosystems, household appliances, lab observations from a distance): Option 1 imagePrompt works well.
- For precise circuit diagrams, ray diagrams, anatomically accurate labelled specimens: prefer Option 2 imageNcertHint — Track B is more reliable for these.

GLOBAL RULES:
- Every question directly derived from the chapter content in the provided textbook pages.
- Balance Physics/Chemistry/Biology if the chapter touches multiple.
- Chemical formulae and equations as plain text (e.g., 2H2 + O2 -> 2H2O).
- Output PURE JSON only - no markdown fences, no commentary.

VERIFICATION before responding:
- sections[0].questions.length === ${cfg.sectionA}
- sections[1].questions.length === ${cfg.assertionReason}
- sections[2].caseStudies.length === ${cfg.caseStudy}
- Each caseStudies[i].questions.length === 4

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "Science", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
    { "id": "A", "title": "Short Answer Questions", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<question>" }] },
    { "id": "B", "title": "Assertion and Reason", "type": "assertion_reason",
      "instructions": ${JSON.stringify(ASSERTION_REASON_KEY)},
      "questions": [{ "number": 1, "assertion": "<statement>", "reason": "<statement>", "text": "" }] },
    { "id": "C", "title": "Case Study", "type": "case_study",
      "caseStudies": [{
        "number": 1,
        "stimulus": "<150-200 word scientific scenario, 8-12 lines>",
        "imagePrompt": "<Option 1 AI prompt OR omit>",
        "imageNcertHint": "<Option 2 NCERT hint OR omit>",
        "questions": [{ "number": 1, "text": "<sub-question>", "options": [
          {"label": "a", "text": "<option>"}, {"label": "b", "text": "<option>"},
          {"label": "c", "text": "<option>"}, {"label": "d", "text": "<option>"}
        ]}]
      }] }
  ]
}`;
}

function class10SocialScience(chapterName: string, cfg: WorksheetConfigValues): string {
  return `You are an expert CBSE Class 10 Social Science worksheet creator. Generate a chapter-wise practice worksheet aligned to the NCERT textbook pages provided.

CHAPTER: ${chapterName}

STRICT COUNTS — generate EXACTLY (not approximately):
- Section A: EXACTLY ${cfg.sectionA} short-answer questions.
- Section B: EXACTLY ${cfg.assertionReason} assertion-reason items.
- Section C: EXACTLY ${cfg.caseStudy} source-based extracts (each with EXACTLY 4 sub-questions).
Count your output items before submitting.

WORKSHEET STRUCTURE - produce exactly 3 sections:

SECTION A - Short Answer Questions (${cfg.sectionA} items)
A mixed pool of factual recall, cause-effect and analytical questions. Cover the chapter's full breadth across History/Geography/Civics/Economics as relevant.
${SECTION_A_QUALITY_RULES}

SECTION B - Assertion and Reason (${cfg.assertionReason} items)
Standard 4-option key. Assertion is a historical/geographical/civic/economic claim; Reason explains.
${ASSERTION_REASON_QUALITY_RULES}

SECTION C - Source-Based Questions (${cfg.caseStudy} source extracts)
Each item has a 150-200 word source extract (8-12 lines): a quoted speech, treaty excerpt, news report, data passage, or NCERT-style historical narrative — period-authentic and rich enough to support multi-step interpretation. Followed by 4 sub-questions (3 MCQ + 1 short answer OR 4 MCQs).

Each item MAY include an image — decide using IMAGE RULES below. Source-based questions in CBSE board papers are usually text-only; emit an image only when it adds real pedagogical value.
${CASE_STUDY_QUALITY_RULES}
- The source extract must read like an actual primary text - quote a named speaker, dated document, or specific data source where appropriate.
${IMAGE_RULES}
Social-Science specific guidance:
- For period crowd scenes, everyday-life of an era, generic landscapes: Option 1 imagePrompt works.
- For political maps with state/country borders, recognisable historical figures by name, and NCERT-original political cartoons: use Option 2 imageNcertHint — AI cannot do these reliably.

GLOBAL RULES:
- Every question directly derived from the chapter content in the provided textbook pages.
- Indian context preferred for examples.
- Output PURE JSON only - no markdown fences, no commentary.

VERIFICATION before responding:
- sections[0].questions.length === ${cfg.sectionA}
- sections[1].questions.length === ${cfg.assertionReason}
- sections[2].caseStudies.length === ${cfg.caseStudy}
- Each caseStudies[i].questions.length === 4

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "Social Science", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
    { "id": "A", "title": "Short Answer Questions", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<question>" }] },
    { "id": "B", "title": "Assertion and Reason", "type": "assertion_reason",
      "instructions": ${JSON.stringify(ASSERTION_REASON_KEY)},
      "questions": [{ "number": 1, "assertion": "<statement>", "reason": "<statement>", "text": "" }] },
    { "id": "C", "title": "Source-Based Questions", "type": "case_study",
      "caseStudies": [{
        "number": 1,
        "stimulus": "<150-200 word source extract, 8-12 lines, primary-text style>",
        "imagePrompt": "<Option 1 AI prompt OR omit>",
        "imageNcertHint": "<Option 2 NCERT hint (e.g. 'India political map', 'Portrait of Gandhi') OR omit>",
        "questions": [{ "number": 1, "text": "<sub-question>", "options": [
          {"label": "a", "text": "<option>"}, {"label": "b", "text": "<option>"},
          {"label": "c", "text": "<option>"}, {"label": "d", "text": "<option>"}
        ]}]
      }] }
  ]
}`;
}

function class10English(chapterName: string, cfg: WorksheetConfigValues): string {
  return `You are an expert CBSE Class 10 English (Language and Literature) worksheet creator. Generate a chapter-wise practice worksheet aligned to the NCERT textbook pages provided.

CHAPTER: ${chapterName}

STRICT COUNTS — generate EXACTLY (not approximately):
- Section A: EXACTLY ${cfg.sectionA} reading / comprehension questions.
- Section B: EXACTLY ${cfg.assertionReason} grammar items.
- Section C: EXACTLY ${cfg.caseStudy} literature extracts (each with EXACTLY 4-5 sub-questions).
Count your output items before submitting.

WORKSHEET STRUCTURE - produce exactly 3 sections:

SECTION A - Short Answer / Reading Questions (${cfg.sectionA} items)
A mixed pool of literal comprehension, inferential questions, vocabulary-in-context (meaning/synonym/antonym), character/theme/setting analysis, and RTC short questions. No options. No marks.
${SECTION_A_QUALITY_RULES}

SECTION B - Grammar (${cfg.assertionReason} items)
Each item tests a grammatical concept relevant to Class 10 CBSE (Tenses, Reported Speech, Modals, Subject-Verb Concord, Determiners, Active/Passive). Each is either:
- a fill-in-the-blank with the answer cue in brackets, OR
- an error-correction sentence, OR
- a transformation task.
Stand-alone short items, no options.
${GRAMMAR_QUALITY_RULES}

SECTION C - Literature Extract (${cfg.caseStudy} extracts)
Each extract is a 4-7 line passage (50-90 words) drawn directly from the chapter text — prose or poetry as relevant. Quote the chapter text faithfully; do not paraphrase. Length is naturally constrained by the source text and should NOT be artificially padded. Each extract is followed by 4-5 sub-questions: 2-3 MCQ-style (4 options each) testing comprehension of the extract, and 1-2 short-answer sub-questions testing inference or theme.
${CASE_STUDY_QUALITY_RULES}

GLOBAL RULES:
- Stay within the chapter's content (textbook pages provided).
- Use language and tone appropriate for Class 10 CBSE.
- Output PURE JSON only - no markdown fences, no commentary.

VERIFICATION before responding:
- sections[0].questions.length === ${cfg.sectionA}
- sections[1].questions.length === ${cfg.assertionReason}
- sections[2].caseStudies.length === ${cfg.caseStudy}

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "English", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
    { "id": "A", "title": "Short Answer / Reading Questions", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<question>" }] },
    { "id": "B", "title": "Grammar", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<grammar exercise>" }] },
    { "id": "C", "title": "Literature Extract", "type": "case_study",
      "caseStudies": [{
        "number": 1,
        "stimulus": "<4-7 line extract (50-90 words) quoted faithfully from the chapter>",
        "questions": [
          { "number": 1, "text": "<MCQ sub-question>", "options": [
            {"label": "a", "text": "<option>"}, {"label": "b", "text": "<option>"},
            {"label": "c", "text": "<option>"}, {"label": "d", "text": "<option>"}
          ]},
          { "number": 4, "text": "<short-answer sub-question, no options>" }
        ]
      }] }
  ]
}`;
}

function class10Hindi(chapterName: string, cfg: WorksheetConfigValues): string {
  return `आप एक विशेषज्ञ CBSE कक्षा 10 हिंदी वर्कशीट निर्माता हैं। दिए गए NCERT पाठ्यपुस्तक पृष्ठों के आधार पर अध्यायवार अभ्यास वर्कशीट तैयार करें।

अध्याय: ${chapterName}

कठोर संख्याएँ - ठीक उतनी ही उत्पन्न करें (अनुमानित नहीं):
- खंड A: ठीक ${cfg.sectionA} लघु उत्तरीय प्रश्न।
- खंड B: ठीक ${cfg.assertionReason} व्याकरण प्रश्न।
- खंड C: ठीक ${cfg.caseStudy} पाठ्यांश (प्रत्येक के लिए 4-5 उप-प्रश्न)।
उत्तर देने से पहले अपनी संख्याएँ गिनें।

वर्कशीट संरचना - ठीक 3 अनुभाग बनाएं:

खंड A - लघु उत्तरीय प्रश्न (${cfg.sectionA} प्रश्न)
पाठ्यपुस्तक से अर्थ-ग्रहण, संदर्भ, भाव-स्पष्टीकरण, चरित्र-विश्लेषण, विषय-वस्तु संबंधी मिश्रित लघु प्रश्न। निर्देश शब्दों का प्रयोग: "बताइए", "लिखिए", "स्पष्ट कीजिए", "किसने कहा और क्यों", "आशय स्पष्ट कीजिए"। कोई विकल्प नहीं, कोई अंक नहीं।
${SECTION_A_QUALITY_RULES}

खंड B - व्याकरण (${cfg.assertionReason} प्रश्न)
कक्षा 10 के पाठ्यक्रम से प्रासंगिक व्याकरण: रचना के आधार पर वाक्य भेद, वाच्य, पद-परिचय, रस, समास, अलंकार, मुहावरे। प्रत्येक प्रश्न रिक्त-स्थान, पहचान, या रूपांतरण कार्य हो। कोई विकल्प नहीं।
${VYAKARAN_QUALITY_RULES}

खंड C - अपठित बोध / पाठ्यांश आधारित प्रश्न (${cfg.caseStudy} गद्यांश/पद्यांश)
प्रत्येक के लिए पाठ से 5-8 पंक्तियों का एक अंश (60-100 शब्द) दीजिए और 4-5 उप-प्रश्न दीजिए: 2-3 MCQ (4 विकल्प प्रत्येक) तथा 1-2 लघु उत्तरीय। पाठ का अंश यथावत् उद्धृत करें - व्याख्या नहीं।
${CASE_STUDY_QUALITY_RULES}

सामान्य नियम:
- सभी प्रश्न दिए गए पाठ्यपुस्तक पृष्ठों के अध्याय की विषय-वस्तु से ही निकाले जाएं।
- भाषा कक्षा 10 स्तर की हो।
- केवल शुद्ध JSON दें - कोई markdown fences नहीं, कोई टिप्पणी नहीं।

जाँच - उत्तर देने से पहले:
- sections[0].questions.length === ${cfg.sectionA}
- sections[1].questions.length === ${cfg.assertionReason}
- sections[2].caseStudies.length === ${cfg.caseStudy}

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "Hindi", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
    { "id": "A", "title": "लघु उत्तरीय प्रश्न", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<प्रश्न>" }] },
    { "id": "B", "title": "व्याकरण", "type": "short_answer",
      "questions": [{ "number": 1, "text": "<व्याकरण अभ्यास>" }] },
    { "id": "C", "title": "पाठ्यांश आधारित प्रश्न", "type": "case_study",
      "caseStudies": [{
        "number": 1,
        "stimulus": "<5-8 पंक्तियों का अंश (60-100 शब्द), पाठ से यथावत् उद्धृत>",
        "questions": [
          { "number": 1, "text": "<MCQ उप-प्रश्न>", "options": [
            {"label": "a", "text": "<विकल्प>"}, {"label": "b", "text": "<विकल्प>"},
            {"label": "c", "text": "<विकल्प>"}, {"label": "d", "text": "<विकल्प>"}
          ]},
          { "number": 4, "text": "<लघु उत्तरीय उप-प्रश्न, बिना विकल्प>" }
        ]
      }] }
  ]
}`;
}

// ============================================================
// Generic fallback prompt (used for grade+subject combinations
// that don't have a dedicated builder). Reads legacy 6-count keys
// from the config map.
// ============================================================

interface SectionDef {
  type: string;
  title: string;
  count: number;
  requirement: string;
  schemaExample: string;
}

function buildGenericPrompt(cfg: WorksheetConfigValues): string {
  const allSections: SectionDef[] = [
    { type: "mcq", title: "Multiple Choice Questions",
      count: cfg.mcq ?? 0,
      requirement: `${cfg.mcq ?? 0} questions, 4 options each, 1 mark each`,
      schemaExample: `{
          "number": 1,
          "text": "<actual question about the chapter>",
          "marks": 1,
          "options": [
            {"label": "a", "text": "<actual option>"}, {"label": "b", "text": "<actual option>"},
            {"label": "c", "text": "<actual option>"}, {"label": "d", "text": "<actual option>"}
          ]
        }` },
    { type: "fill_in_the_blanks", title: "Fill in the Blanks",
      count: cfg.fillInTheBlanks ?? 0,
      requirement: `${cfg.fillInTheBlanks ?? 0} questions, 1 mark each. Use "______" (six underscores) in the sentence where the blank goes`,
      schemaExample: `{ "number": 1, "text": "<sentence with ______ for the blank>", "marks": 1 }` },
    { type: "match_the_following", title: "Match the Following",
      count: cfg.matchTheFollowing ?? 0,
      requirement: `${cfg.matchTheFollowing ?? 0} questions, each with 4-5 pairs, marks = number of pairs`,
      schemaExample: `{
          "number": 1, "text": "Match the items in Column A with Column B", "marks": 4,
          "matchPairs": [
            {"left": "<term>", "right": "<match>"}, {"left": "<term>", "right": "<match>"},
            {"left": "<term>", "right": "<match>"}, {"left": "<term>", "right": "<match>"}
          ]
        }` },
    { type: "very_short", title: "Very Short Answer Questions",
      count: cfg.veryShort ?? 0,
      requirement: `${cfg.veryShort ?? 0} questions, 1 mark each`,
      schemaExample: `{ "number": 1, "text": "<actual question about the chapter>", "marks": 1 }` },
    { type: "short_answer", title: "Short Answer Questions",
      count: cfg.shortAnswer ?? 0,
      requirement: `${cfg.shortAnswer ?? 0} questions, 3 marks each`,
      schemaExample: `{ "number": 1, "text": "<actual question about the chapter>", "marks": 3 }` },
    { type: "long_answer", title: "Long Answer / Numerical Questions",
      count: cfg.longAnswer ?? 0,
      requirement: `${cfg.longAnswer ?? 0} questions, 5 marks each, with subparts`,
      schemaExample: `{
          "number": 1, "text": "<actual question about the chapter>", "marks": 5,
          "subparts": ["<actual subpart a>", "<actual subpart b>"]
        }` },
  ];

  const sections = allSections
    .filter((s) => s.count > 0)
    .map((s, i) => ({ ...s, id: String.fromCharCode(65 + i) }));

  const total = sections.reduce((sum, s) => sum + s.count, 0);
  const aimFor = Math.ceil(total * 1.1);

  const schemaStr = sections
    .map(
      (s) => `    {
      "id": "${s.id}", "title": "${s.title}", "type": "${s.type}",
      "questions": [
        ${s.schemaExample}
      ]
    }`
    )
    .join(",\n");

  const requirementsStr = sections
    .map((s) => `- Section ${s.id} (${s.title}): Exactly ${s.requirement}`)
    .join("\n");

  return `You are an expert educational worksheet creator for Indian schools (CBSE/ICSE curriculum). Your job is to generate high-quality worksheet questions from textbook content and previous question papers.

CRITICAL RULES:
1. Generate a MINIMUM of ${total} questions across all sections
2. Questions must be directly derived from the provided textbook content and question papers
3. Cover the full breadth of the chapter - don't cluster questions from just one topic
4. Questions should progress from simple recall to application and analysis
5. For MCQs, all 4 options must be plausible (no obviously wrong answers)
6. Keep question text concise and clear - suitable for compressed worksheet layout
7. Include numerical/calculation questions where applicable
8. Include diagram-based questions where the chapter content involves visual concepts
9. For Fill in the Blanks, use "______" (six underscores) to indicate the blank within a complete sentence
10. For Match the Following, provide exactly 4-5 pairs per question with shuffled right-column items
11. NEVER use placeholder text like "question text", "part a text", "option text" — every field must contain actual educational content from the chapter

OUTPUT FORMAT: You must respond with ONLY valid JSON (no markdown, no code fences, no explanation).

The JSON schema:
{
  "metadata": { "grade": "string", "subject": "string", "chapter": "string", "totalQuestions": number },
  "sections": [
${schemaStr}
  ]
}

SECTION REQUIREMENTS:
${requirementsStr}

Total: ${total} questions. Aim for up to ${aimFor} for comprehensive coverage.`;
}

// ============================================================
// Dispatch: pick Class 10 subject-specific prompt or generic fallback
// ============================================================

function buildSystemPrompt(ctx: GenerationContext, cfg: WorksheetConfigValues): string {
  if (ctx.gradeNumber === 10) {
    switch (ctx.subjectSlug) {
      case "mathematics":     return class10Maths(ctx.chapterName, cfg);
      case "science":         return class10Science(ctx.chapterName, cfg);
      case "social_studies":  return class10SocialScience(ctx.chapterName, cfg);
      case "english":         return class10English(ctx.chapterName, cfg);
      case "hindi":           return class10Hindi(ctx.chapterName, cfg);
    }
  }
  return buildGenericPrompt(cfg);
}

// ============================================================
// Public API
// ============================================================

export async function generateQuestions(
  imageBase64s: string[],
  context: GenerationContext,
  config: WorksheetConfigValues,
): Promise<WorksheetQuestions> {
  const contentParts = [];

  contentParts.push(
    createTextContent(
      `Generate a comprehensive worksheet for:\n- Grade: ${context.gradeName}\n- Subject: ${context.subjectName}\n- Chapter: ${context.chapterName}\n\nBelow are the textbook pages and/or previous question papers for this chapter. Study them carefully and generate questions that cover all topics in the chapter.\n\nTextbook/Question Paper Pages:`
    )
  );

  const maxImages = Math.min(imageBase64s.length, 50);
  for (let i = 0; i < maxImages; i++) {
    contentParts.push(createImageContent(imageBase64s[i]));
    contentParts.push(createTextContent(`[Page ${i + 1} of ${imageBase64s.length}]`));
  }

  if (imageBase64s.length > maxImages) {
    contentParts.push(
      createTextContent(
        `Note: ${imageBase64s.length - maxImages} additional pages were not included due to size limits. Generate questions covering all visible content.`
      )
    );
  }

  contentParts.push(
    createTextContent(`\nNow generate the worksheet JSON. Valid JSON only, no markdown fences.`)
  );

  const response = await callLLM([
    { role: "system", content: buildSystemPrompt(context, config) },
    { role: "user", content: contentParts },
  ]);

  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const questions: WorksheetQuestions = JSON.parse(jsonStr);

  // Total includes case-study sub-questions
  const totalQuestions = questions.sections.reduce((sum, section) => {
    if (section.caseStudies?.length) {
      return sum + section.caseStudies.reduce((s, cs) => s + cs.questions.length, 0);
    }
    return sum + (section.questions?.length ?? 0);
  }, 0);

  questions.metadata.totalQuestions = totalQuestions;

  // Log count drift for Class 10 (where we ask for exact counts)
  if (context.gradeNumber === 10) {
    const actualSectionA = questions.sections[0]?.questions?.length ?? 0;
    const actualSectionB = questions.sections[1]?.questions?.length ?? 0;
    const actualSectionC = questions.sections[2]?.caseStudies?.length ?? 0;
    const want = {
      a: config.sectionA ?? 0,
      b: config.assertionReason ?? 0,
      c: config.caseStudy ?? 0,
    };
    const got = { a: actualSectionA, b: actualSectionB, c: actualSectionC };
    if (got.a !== want.a || got.b !== want.b || got.c !== want.c) {
      console.warn(
        `[worksheet-gen] Count drift for ${context.subjectSlug} "${context.chapterName}": ` +
        `requested A=${want.a}/B=${want.b}/C=${want.c}, got A=${got.a}/B=${got.b}/C=${got.c}`
      );
    }
  }

  // Renumber sequentially within each section / case study
  questions.sections.forEach((section) => {
    section.questions?.forEach((q, idx) => {
      q.number = idx + 1;
    });
    section.caseStudies?.forEach((cs, csIdx) => {
      cs.number = csIdx + 1;
      cs.questions.forEach((q, idx) => {
        q.number = idx + 1;
      });
    });
  });

  return questions;
}
