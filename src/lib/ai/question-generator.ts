import { callLLM, createImageContent, createTextContent } from "@/lib/openrouter";
import { WorksheetQuestions } from "@/types";

const SYSTEM_PROMPT = `You are an expert educational worksheet creator for Indian schools (CBSE/ICSE curriculum). Your job is to generate high-quality worksheet questions from textbook content and previous question papers.

CRITICAL RULES:
1. Generate a MINIMUM of 25 questions across all sections
2. Questions must be directly derived from the provided textbook content and question papers
3. Cover the full breadth of the chapter - don't cluster questions from just one topic
4. Questions should progress from simple recall to application and analysis
5. For MCQs, all 4 options must be plausible (no obviously wrong answers)
6. Keep question text concise and clear - suitable for compressed worksheet layout
7. Include numerical/calculation questions where applicable
8. Include diagram-based questions where the chapter content involves visual concepts

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
    {
      "id": "A",
      "title": "Multiple Choice Questions",
      "type": "mcq",
      "questions": [
        {
          "number": 1,
          "text": "question text",
          "marks": 1,
          "options": [
            {"label": "a", "text": "option text"},
            {"label": "b", "text": "option text"},
            {"label": "c", "text": "option text"},
            {"label": "d", "text": "option text"}
          ]
        }
      ]
    },
    {
      "id": "B",
      "title": "Very Short Answer Questions",
      "type": "very_short",
      "questions": [
        {
          "number": 1,
          "text": "question text",
          "marks": 1
        }
      ]
    },
    {
      "id": "C",
      "title": "Short Answer Questions",
      "type": "short_answer",
      "questions": [
        {
          "number": 1,
          "text": "question text",
          "marks": 3
        }
      ]
    },
    {
      "id": "D",
      "title": "Long Answer / Numerical Questions",
      "type": "long_answer",
      "questions": [
        {
          "number": 1,
          "text": "question text",
          "marks": 5,
          "subparts": ["part a text", "part b text"]
        }
      ]
    }
  ]
}

SECTION REQUIREMENTS:
- Section A (MCQ): Minimum 12 questions, 4 options each, 1 mark each
- Section B (Very Short Answer): Minimum 8 questions, 1 mark each
- Section C (Short Answer): Minimum 6 questions, 3 marks each
- Section D (Long Answer / Numerical): Minimum 4 questions, 5 marks each, with subparts

Total minimum: 30 questions. Aim for 32-36 for comprehensive coverage.`;

export async function generateQuestions(
  imageBase64s: string[],
  gradeName: string,
  subjectName: string,
  chapterName: string
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

  contentParts.push(
    createTextContent(
      "\nNow generate the worksheet JSON. Remember: minimum 30 questions, valid JSON only, no markdown fences."
    )
  );

  const response = await callLLM([
    { role: "system", content: SYSTEM_PROMPT },
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
  if (totalQuestions < 25) {
    console.warn(`Warning: Only ${totalQuestions} questions generated (minimum 25 required)`);
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
