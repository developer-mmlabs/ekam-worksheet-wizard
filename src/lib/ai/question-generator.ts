import { callLLM, createImageContent, createTextContent } from "@/lib/openrouter";
import { WorksheetQuestions, QuestionCounts, QUESTION_COUNT_DEFAULTS } from "@/types";

interface SectionDef {
  type: string;
  title: string;
  count: number;
  requirement: string;
  schemaExample: string;
}

function buildSystemPrompt(counts: QuestionCounts): string {
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

export async function generateQuestions(
  imageBase64s: string[],
  gradeName: string,
  subjectName: string,
  chapterName: string,
  questionCounts: QuestionCounts = QUESTION_COUNT_DEFAULTS
): Promise<WorksheetQuestions> {
  // Build the message content with all images
  const contentParts = [];

  contentParts.push(
    createTextContent(
      `Generate a comprehensive worksheet for:\n- Grade: ${gradeName}\n- Subject: ${subjectName}\n- Chapter: ${chapterName}\n\nBelow are the textbook pages and/or previous question papers for this chapter. Study them carefully and generate questions that cover all topics in the chapter.\n\nTextbook/Question Paper Pages:`
    )
  );

  // Add images (limit to 20 to stay within token limits)
  const maxImages = Math.min(imageBase64s.length, 20);
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

  const requestedTotal = questionCounts.mcq + questionCounts.fillInTheBlanks + questionCounts.matchTheFollowing + questionCounts.veryShort + questionCounts.shortAnswer + questionCounts.longAnswer;

  contentParts.push(
    createTextContent(
      `\nNow generate the worksheet JSON. Remember: ${requestedTotal} questions total, valid JSON only, no markdown fences.`
    )
  );

  const response = await callLLM([
    { role: "system", content: buildSystemPrompt(questionCounts) },
    { role: "user", content: contentParts },
  ]);

  // Parse the JSON response - strip any markdown fences if present
  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const questions: WorksheetQuestions = JSON.parse(jsonStr);

  // Validate minimum question count
  const totalQuestions = questions.sections.reduce((sum, section) => sum + section.questions.length, 0);
  const minimumExpected = Math.floor(requestedTotal * 0.8);
  if (totalQuestions < minimumExpected) {
    console.warn(`Warning: Only ${totalQuestions} questions generated (expected at least ${minimumExpected})`);
  }

  // Update metadata
  questions.metadata.totalQuestions = totalQuestions;

  // Renumber questions sequentially within each section
  questions.sections.forEach((section) => {
    section.questions.forEach((q, idx) => {
      q.number = idx + 1;
    });
  });

  return questions;
}
