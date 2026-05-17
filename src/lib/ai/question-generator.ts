import { callLLM, createImageContent, createTextContent } from "@/lib/openrouter";
import { WorksheetQuestions, QuestionCounts, QUESTION_COUNT_DEFAULTS } from "@/types";

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
//   A = ~N short-answer pool (concept + computation + application)
//   B = subject-specific Section B (assertion-reason / grammar / vyakaran)
//   C = subject-specific Section C (case study / source-based / literature extract / apathit bodh)
// Output is text-only. No marks shown. All questions compulsory (no internal choice).
// ============================================================

const ASSERTION_REASON_KEY = `Directions: Each question consists of two statements - Assertion (A) and Reason (R). Choose the correct option:
(a) Both A and R are true and R is the correct explanation of A.
(b) Both A and R are true but R is NOT the correct explanation of A.
(c) A is true but R is false.
(d) A is false but R is true.`;

function class10Maths(chapterName: string, sectionACount: number): string {
  return `You are an expert CBSE Class 10 Mathematics worksheet creator. Generate a chapter-wise practice worksheet aligned to the NCERT textbook pages provided.

CHAPTER: ${chapterName}

STRICT WORKSHEET STRUCTURE - produce exactly 3 sections:

SECTION A - Short Answer Questions (${sectionACount} items)
A mixed pool of concept, computation, proof and application questions. Use directives like "Find", "Solve", "Prove", "Show that", "Verify", "State", "Justify", "Construct". No marks shown. No options.

SECTION B - Assertion and Reason (6 items)
Use the standard 4-option key (in section instructions, not per item). Each item is a pair: Assertion (A) and Reason (R). Both A and R are full statements. Mix outcomes across all four options - do not make every answer (a).

SECTION C - Case Study (2 case studies)
Each case study has a 2-4 line real-world stimulus (sports, finance, design, structures, daily life) followed by 4 MCQ sub-questions (4 options each). Stimulus must be derived from the chapter's mathematical concepts.

RULES:
- Every question must be directly derived from the chapter content in the provided textbook pages.
- Cover the full breadth of the chapter; do not cluster on one topic.
- Mathematical notation as plain text (x^2, sqrt(15), 22/7). No LaTeX.
- Output PURE JSON only - no markdown fences, no commentary, no preamble.

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "Mathematics", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
    {
      "id": "A",
      "title": "Short Answer Questions",
      "type": "short_answer",
      "questions": [
        { "number": 1, "text": "<actual question>" }
      ]
    },
    {
      "id": "B",
      "title": "Assertion and Reason",
      "type": "assertion_reason",
      "instructions": ${JSON.stringify(ASSERTION_REASON_KEY)},
      "questions": [
        { "number": 1, "assertion": "<full assertion statement>", "reason": "<full reason statement>", "text": "" }
      ]
    },
    {
      "id": "C",
      "title": "Case Study",
      "type": "case_study",
      "caseStudies": [
        {
          "number": 1,
          "stimulus": "<2-4 line real-world scenario from chapter concepts>",
          "questions": [
            { "number": 1, "text": "<sub-question>", "options": [
              { "label": "a", "text": "<option>" },
              { "label": "b", "text": "<option>" },
              { "label": "c", "text": "<option>" },
              { "label": "d", "text": "<option>" }
            ]}
          ]
        }
      ]
    }
  ]
}`;
}

function class10Science(chapterName: string, sectionACount: number): string {
  return `You are an expert CBSE Class 10 Science worksheet creator. Generate a chapter-wise practice worksheet aligned to the NCERT textbook pages provided.

CHAPTER: ${chapterName}

STRICT WORKSHEET STRUCTURE - produce exactly 3 sections:

SECTION A - Short Answer Questions (${sectionACount} items)
A mixed pool of concept recall, explanation, application and reasoning questions. Use directives like "Define", "State", "Explain why", "Write the balanced equation", "Identify", "Differentiate between", "List". Include at least 3-4 reasoning questions (e.g., "Give a reason for..."). No marks shown.

SECTION B - Assertion and Reason (6 items)
Standard 4-option key (in section instructions). Each item is a pair of full statements: Assertion (A) and Reason (R). Mix outcomes across all four options.

SECTION C - Case Study (2 case studies)
Each case study has a 3-5 line scientific stimulus (experimental setup, real-world phenomenon, observation, or scientific principle) followed by 4 MCQ sub-questions (4 options each).

RULES:
- Every question directly derived from the chapter content in the provided textbook pages.
- Cover the full breadth - balance Physics/Chemistry/Biology if the chapter touches multiple.
- Chemical formulae and equations as plain text (e.g., 2H2 + O2 -> 2H2O).
- Output PURE JSON only - no markdown fences, no commentary.

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "Science", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
    {
      "id": "A",
      "title": "Short Answer Questions",
      "type": "short_answer",
      "questions": [{ "number": 1, "text": "<question>" }]
    },
    {
      "id": "B",
      "title": "Assertion and Reason",
      "type": "assertion_reason",
      "instructions": ${JSON.stringify(ASSERTION_REASON_KEY)},
      "questions": [{ "number": 1, "assertion": "<statement>", "reason": "<statement>", "text": "" }]
    },
    {
      "id": "C",
      "title": "Case Study",
      "type": "case_study",
      "caseStudies": [
        {
          "number": 1,
          "stimulus": "<3-5 line scientific scenario>",
          "questions": [
            { "number": 1, "text": "<sub-question>", "options": [
              { "label": "a", "text": "<option>" },
              { "label": "b", "text": "<option>" },
              { "label": "c", "text": "<option>" },
              { "label": "d", "text": "<option>" }
            ]}
          ]
        }
      ]
    }
  ]
}`;
}

function class10SocialScience(chapterName: string, sectionACount: number): string {
  return `You are an expert CBSE Class 10 Social Science worksheet creator. Generate a chapter-wise practice worksheet aligned to the NCERT textbook pages provided.

CHAPTER: ${chapterName}

STRICT WORKSHEET STRUCTURE - produce exactly 3 sections:

SECTION A - Short Answer Questions (${sectionACount} items)
A mixed pool of factual recall, cause-effect, and analytical questions. Use directives like "State", "Mention", "Describe", "Explain", "Why did...", "What were the causes/effects/significance of...", "Distinguish between". Cover the chapter's full breadth.

SECTION B - Assertion and Reason (6 items)
Standard 4-option key (in section instructions). Assertion (A) is a historical/geographical/civic/economic fact or claim; Reason (R) is an explanation. Mix outcomes across all four options.

SECTION C - Source-Based Questions (2 source extracts)
Each item has a 4-6 line source extract (a quoted primary text, speech, treaty excerpt, news report, or data passage relevant to the chapter) followed by 4 sub-questions (3 MCQ + 1 short answer, OR 4 MCQs). Sub-questions test interpretation, not just recall.

RULES:
- Every question directly derived from the chapter content in the provided textbook pages.
- Source extracts should sound authentic to the period/context (Indian context preferred).
- Output PURE JSON only - no markdown fences, no commentary.

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "Social Science", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
    {
      "id": "A",
      "title": "Short Answer Questions",
      "type": "short_answer",
      "questions": [{ "number": 1, "text": "<question>" }]
    },
    {
      "id": "B",
      "title": "Assertion and Reason",
      "type": "assertion_reason",
      "instructions": ${JSON.stringify(ASSERTION_REASON_KEY)},
      "questions": [{ "number": 1, "assertion": "<statement>", "reason": "<statement>", "text": "" }]
    },
    {
      "id": "C",
      "title": "Source-Based Questions",
      "type": "case_study",
      "caseStudies": [
        {
          "number": 1,
          "stimulus": "<4-6 line source extract relevant to the chapter>",
          "questions": [
            { "number": 1, "text": "<sub-question>", "options": [
              { "label": "a", "text": "<option>" },
              { "label": "b", "text": "<option>" },
              { "label": "c", "text": "<option>" },
              { "label": "d", "text": "<option>" }
            ]}
          ]
        }
      ]
    }
  ]
}`;
}

function class10English(chapterName: string, sectionACount: number): string {
  return `You are an expert CBSE Class 10 English (Language and Literature) worksheet creator. Generate a chapter-wise practice worksheet aligned to the NCERT textbook pages provided.

CHAPTER: ${chapterName}

STRICT WORKSHEET STRUCTURE - produce exactly 3 sections:

SECTION A - Short Answer / Reading Questions (${sectionACount} items)
A mixed pool of:
- Literal comprehension and inferential questions from the chapter text
- Vocabulary in context (meaning, synonym, antonym)
- Character/theme/setting analysis (if literature chapter)
- Reference-to-context (RTC) short questions
No options. No marks.

SECTION B - Grammar (6 items)
Each item tests a grammatical concept relevant to Class 10 CBSE (Tenses, Reported Speech, Modals, Subject-Verb Concord, Determiners, Active/Passive). Each is a fill-in-the-blank with the answer cue in brackets, OR an error-correction sentence, OR a transformation task. Stand-alone short items, no options.

SECTION C - Literature Extract (1 extract)
Provide a 4-6 line extract from the chapter (prose or poetry as relevant) and 4-5 sub-questions: 2-3 MCQ-style (4 options each) testing comprehension of the extract, and 1-2 short-answer sub-questions testing inference or theme.

RULES:
- Stay within the chapter's content (textbook pages provided).
- Use the language and tone appropriate for Class 10 CBSE.
- Output PURE JSON only - no markdown fences, no commentary.

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "English", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
    {
      "id": "A",
      "title": "Short Answer / Reading Questions",
      "type": "short_answer",
      "questions": [{ "number": 1, "text": "<question>" }]
    },
    {
      "id": "B",
      "title": "Grammar",
      "type": "short_answer",
      "questions": [{ "number": 1, "text": "<grammar exercise>" }]
    },
    {
      "id": "C",
      "title": "Literature Extract",
      "type": "case_study",
      "caseStudies": [
        {
          "number": 1,
          "stimulus": "<4-6 line extract from the chapter>",
          "questions": [
            { "number": 1, "text": "<MCQ sub-question>", "options": [
              { "label": "a", "text": "<option>" },
              { "label": "b", "text": "<option>" },
              { "label": "c", "text": "<option>" },
              { "label": "d", "text": "<option>" }
            ]},
            { "number": 4, "text": "<short-answer sub-question, no options>" }
          ]
        }
      ]
    }
  ]
}`;
}

function class10Hindi(chapterName: string, sectionACount: number): string {
  return `आप एक विशेषज्ञ CBSE कक्षा 10 हिंदी वर्कशीट निर्माता हैं। दिए गए NCERT पाठ्यपुस्तक पृष्ठों के आधार पर अध्यायवार अभ्यास वर्कशीट तैयार करें।

अध्याय: ${chapterName}

कठोर वर्कशीट संरचना - ठीक 3 अनुभाग बनाएं:

खंड A - लघु उत्तरीय प्रश्न (${sectionACount} प्रश्न)
पाठ्यपुस्तक से अर्थ-ग्रहण, संदर्भ, भाव-स्पष्टीकरण, चरित्र-विश्लेषण, विषय-वस्तु संबंधी मिश्रित लघु प्रश्न। निर्देश शब्दों का प्रयोग: "बताइए", "लिखिए", "स्पष्ट कीजिए", "किसने कहा और क्यों", "आशय स्पष्ट कीजिए"। कोई विकल्प नहीं, कोई अंक नहीं।

खंड B - व्याकरण (6 प्रश्न)
कक्षा 10 के पाठ्यक्रम से प्रासंगिक व्याकरण: रचना के आधार पर वाक्य भेद, वाच्य, पद-परिचय, रस, समास, अलंकार, मुहावरे (पाठ्यक्रम अनुसार)। प्रत्येक प्रश्न रिक्त-स्थान, पहचान, या रूपांतरण कार्य हो। कोई विकल्प नहीं।

खंड C - अपठित बोध / पाठ्यांश आधारित प्रश्न (1 गद्यांश/पद्यांश)
पाठ से 5-7 पंक्तियों का एक अंश दीजिए और 4-5 उप-प्रश्न दीजिए: 2-3 MCQ (4 विकल्प प्रत्येक) तथा 1-2 लघु उत्तरीय।

नियम:
- सभी प्रश्न दिए गए पाठ्यपुस्तक पृष्ठों के अध्याय की विषय-वस्तु से ही निकाले जाएं।
- भाषा कक्षा 10 स्तर की हो।
- केवल शुद्ध JSON दें - कोई markdown fences नहीं, कोई टिप्पणी नहीं।

JSON SCHEMA:
{
  "metadata": { "grade": "Grade 10", "subject": "Hindi", "chapter": "${chapterName}", "totalQuestions": <number> },
  "sections": [
    {
      "id": "A",
      "title": "लघु उत्तरीय प्रश्न",
      "type": "short_answer",
      "questions": [{ "number": 1, "text": "<प्रश्न>" }]
    },
    {
      "id": "B",
      "title": "व्याकरण",
      "type": "short_answer",
      "questions": [{ "number": 1, "text": "<व्याकरण अभ्यास>" }]
    },
    {
      "id": "C",
      "title": "पाठ्यांश आधारित प्रश्न",
      "type": "case_study",
      "caseStudies": [
        {
          "number": 1,
          "stimulus": "<5-7 पंक्तियों का अंश>",
          "questions": [
            { "number": 1, "text": "<MCQ उप-प्रश्न>", "options": [
              { "label": "a", "text": "<विकल्प>" },
              { "label": "b", "text": "<विकल्प>" },
              { "label": "c", "text": "<विकल्प>" },
              { "label": "d", "text": "<विकल्प>" }
            ]},
            { "number": 4, "text": "<लघु उत्तरीय उप-प्रश्न, बिना विकल्प>" }
          ]
        }
      ]
    }
  ]
}`;
}

// ============================================================
// Generic fallback prompt (used for non-Class-10 grades).
// Builds sections based on QuestionCounts - same as original.
// ============================================================

interface SectionDef {
  type: string;
  title: string;
  count: number;
  requirement: string;
  schemaExample: string;
}

function buildGenericPrompt(counts: QuestionCounts): string {
  const allSections: SectionDef[] = [
    {
      type: "mcq",
      title: "Multiple Choice Questions",
      count: counts.mcq,
      requirement: `${counts.mcq} questions, 4 options each, 1 mark each`,
      schemaExample: `{
          "number": 1,
          "text": "<actual question about the chapter>",
          "marks": 1,
          "options": [
            {"label": "a", "text": "<actual option>"},
            {"label": "b", "text": "<actual option>"},
            {"label": "c", "text": "<actual option>"},
            {"label": "d", "text": "<actual option>"}
          ]
        }`,
    },
    {
      type: "fill_in_the_blanks",
      title: "Fill in the Blanks",
      count: counts.fillInTheBlanks,
      requirement: `${counts.fillInTheBlanks} questions, 1 mark each. Use "______" (six underscores) in the sentence where the blank goes`,
      schemaExample: `{
          "number": 1,
          "text": "<sentence with ______ for the blank>",
          "marks": 1
        }`,
    },
    {
      type: "match_the_following",
      title: "Match the Following",
      count: counts.matchTheFollowing,
      requirement: `${counts.matchTheFollowing} questions, each with 4-5 pairs, marks = number of pairs`,
      schemaExample: `{
          "number": 1,
          "text": "Match the items in Column A with Column B",
          "marks": 4,
          "matchPairs": [
            {"left": "<term from chapter>", "right": "<matching definition/answer>"},
            {"left": "<term from chapter>", "right": "<matching definition/answer>"},
            {"left": "<term from chapter>", "right": "<matching definition/answer>"},
            {"left": "<term from chapter>", "right": "<matching definition/answer>"}
          ]
        }`,
    },
    {
      type: "very_short",
      title: "Very Short Answer Questions",
      count: counts.veryShort,
      requirement: `${counts.veryShort} questions, 1 mark each`,
      schemaExample: `{
          "number": 1,
          "text": "<actual question about the chapter>",
          "marks": 1
        }`,
    },
    {
      type: "short_answer",
      title: "Short Answer Questions",
      count: counts.shortAnswer,
      requirement: `${counts.shortAnswer} questions, 3 marks each`,
      schemaExample: `{
          "number": 1,
          "text": "<actual question about the chapter>",
          "marks": 3
        }`,
    },
    {
      type: "long_answer",
      title: "Long Answer / Numerical Questions",
      count: counts.longAnswer,
      requirement: `${counts.longAnswer} questions, 5 marks each, with subparts`,
      schemaExample: `{
          "number": 1,
          "text": "<actual question about the chapter>",
          "marks": 5,
          "subparts": ["<actual subpart a question>", "<actual subpart b question>"]
        }`,
    },
  ];

  const sections = allSections
    .filter((s) => s.count > 0)
    .map((s, i) => ({ ...s, id: String.fromCharCode(65 + i) }));

  const total = sections.reduce((sum, s) => sum + s.count, 0);
  const aimFor = Math.ceil(total * 1.1);

  const schemaStr = sections
    .map(
      (s) => `    {
      "id": "${s.id}",
      "title": "${s.title}",
      "type": "${s.type}",
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
  "metadata": {
    "grade": "string",
    "subject": "string",
    "chapter": "string",
    "totalQuestions": number
  },
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

function buildSystemPrompt(ctx: GenerationContext, counts: QuestionCounts): string {
  if (ctx.gradeNumber === 10) {
    const sectionACount = counts.mcq + counts.veryShort + counts.shortAnswer + counts.longAnswer;
    switch (ctx.subjectSlug) {
      case "mathematics":
        return class10Maths(ctx.chapterName, sectionACount);
      case "science":
        return class10Science(ctx.chapterName, sectionACount);
      case "social_studies":
        return class10SocialScience(ctx.chapterName, sectionACount);
      case "english":
        return class10English(ctx.chapterName, sectionACount);
      case "hindi":
        return class10Hindi(ctx.chapterName, sectionACount);
    }
  }
  return buildGenericPrompt(counts);
}

// ============================================================
// Public API
// ============================================================

export async function generateQuestions(
  imageBase64s: string[],
  context: GenerationContext,
  questionCounts: QuestionCounts = QUESTION_COUNT_DEFAULTS
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
    createTextContent(
      `\nNow generate the worksheet JSON. Valid JSON only, no markdown fences.`
    )
  );

  const response = await callLLM([
    { role: "system", content: buildSystemPrompt(context, questionCounts) },
    { role: "user", content: contentParts },
  ]);

  // Strip any markdown fences if present
  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const questions: WorksheetQuestions = JSON.parse(jsonStr);

  // Total question count (includes case-study sub-questions)
  const totalQuestions = questions.sections.reduce((sum, section) => {
    if (section.caseStudies?.length) {
      return sum + section.caseStudies.reduce((s, cs) => s + cs.questions.length, 0);
    }
    return sum + (section.questions?.length ?? 0);
  }, 0);

  questions.metadata.totalQuestions = totalQuestions;

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
