const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "qwen/qwen2.5-vl-72b-instruct";

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
    message: {
      content: string;
    };
  }[];
}

export async function callLLM(messages: Message[]): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://worksheet-wizard.vercel.app",
      "X-Title": "Worksheet Wizard",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages,
      max_tokens: 16000,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${error}`);
  }

  const data: OpenRouterResponse = await response.json();
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

export function createTextContent(text: string): TextPart {
  return {
    type: "text",
    text,
  };
}
