// ============================================================
// Image generation client.
// Generates scenic illustrations for worksheet case studies via OpenAI's
// Images API (DALL-E 3). Style suffix is appended server-side so the LLM
// only controls the scene description, not the rendering style.
// ============================================================

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "dall-e-3";

// Locked stylistic suffix applied to every prompt. Keeps output consistent
// across worksheets and away from the LLM's reach.
const STYLE_SUFFIX =
  ", simple flat illustrative style, soft pastel colors, no text or labels, white background, clean composition, educational worksheet aesthetic";

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: "image/png";
}

export async function isImageGenAvailable(): Promise<boolean> {
  return Boolean(OPENAI_API_KEY);
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const fullPrompt = `${prompt}${STYLE_SUFFIX}`;

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt: fullPrompt,
      size: "1024x1024",
      quality: "standard",
      response_format: "b64_json",
      n: 1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI Images error (${response.status}): ${errText}`);
  }

  const data = (await response.json()) as { data: Array<{ b64_json: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI Images returned no image data");
  }

  return {
    buffer: Buffer.from(b64, "base64"),
    mimeType: "image/png",
  };
}
