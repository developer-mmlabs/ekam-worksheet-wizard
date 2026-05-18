// ============================================================
// Image generation client (via OpenRouter).
// Uses the existing OPENROUTER_API_KEY. Default model is Google's
// Gemini 2.5 Flash Image ("Nano Banana") - very cheap (~$0.003/image)
// and good at illustrative content. Override via OPENROUTER_IMAGE_MODEL.
// ============================================================

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_IMAGE_MODEL =
  process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-2.5-flash-image";

// Locked stylistic suffix applied to every prompt. Keeps output consistent
// across worksheets and away from the LLM's reach.
const STYLE_SUFFIX =
  ", simple flat illustrative style, soft pastel colors, no text or labels, white background, clean composition, educational worksheet aesthetic";

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

interface OpenRouterImageResponse {
  choices?: Array<{
    message?: {
      role: string;
      content?: string;
      images?: Array<{
        type: string;
        image_url: { url: string };
      }>;
    };
  }>;
}

export async function isImageGenAvailable(): Promise<boolean> {
  return Boolean(OPENROUTER_API_KEY);
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY not configured");
  }

  const fullPrompt = `${prompt}${STYLE_SUFFIX}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://worksheet-wizard.vercel.app",
      "X-Title": "Worksheet Wizard",
    },
    body: JSON.stringify({
      model: OPENROUTER_IMAGE_MODEL,
      messages: [{ role: "user", content: fullPrompt }],
      modalities: ["image", "text"],
      image_config: {
        aspect_ratio: "1:1",
        image_size: "1K",
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter image gen error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as OpenRouterImageResponse;
  const dataUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!dataUrl) {
    throw new Error("OpenRouter image response did not include image data");
  }

  // data URL format: "data:image/png;base64,<base64>"
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Unexpected image data URL format");
  }

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");

  return { buffer, mimeType };
}
