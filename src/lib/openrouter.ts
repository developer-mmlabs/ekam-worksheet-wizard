const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
export const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-3-flash-preview";

interface Message {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

type ContentPart = TextPart | ImagePart;

interface TextPart {
  type: "text";
  text: string;
}

interface ImagePart {
  type: "image_url";
  image_url: {
    url: string; // base64 data URI or URL
  };
}

interface OpenRouterResponse {
  choices: {
    finish_reason?: string;
    message: {
      content: string;
    };
  }[];
}

export async function callLLM(messages: Message[], options?: { timeoutMs: number; maxTokens: number }): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    // Leave time for PDF/storage work before the attempt's 15-minute deadline.
    signal: AbortSignal.timeout(options?.timeoutMs ?? 12 * 60 * 1000),
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://worksheet-wizard.vercel.app",
      "X-Title": "Worksheet Wizard",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      max_tokens: options?.maxTokens ?? 16000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${error}`);
  }

  const data: OpenRouterResponse = await response.json();
  if (options && (data.choices?.[0]?.finish_reason === "length" || !data.choices?.[0]?.message?.content)) {
    throw new Error("AI response was incomplete. Retry this step.");
  }
  return data.choices[0].message.content;
}

export function createImageContent(base64Data: string, mimeType: string = "image/jpeg"): ImagePart {
  return {
    type: "image_url",
    image_url: {
      url: `data:${mimeType};base64,${base64Data}`,
    },
  };
}

export function createImageContentFromUrl(url: string): ImagePart {
  return {
    type: "image_url",
    image_url: { url },
  };
}

export function createTextContent(text: string): TextPart {
  return {
    type: "text",
    text,
  };
}
