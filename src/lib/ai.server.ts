// Server-only Lovable AI Gateway helpers for caption + image generation.
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function getKey() {
  const k = process.env.LOVABLE_API_KEY;
  if (!k) throw new Error("LOVABLE_API_KEY is not configured");
  return k;
}

async function chat(model: string, system: string, user: string): Promise<string> {
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI chat failed [${res.status}]: ${t}`);
  }
  const data: any = await res.json();
  return String(data?.choices?.[0]?.message?.content ?? "").trim();
}

export async function generateCaption(opts: {
  channelName?: string;
  theme?: string;
  keywords?: string;
}): Promise<string> {
  const sys =
    "You are a social media copywriter for Indonesian Telegram channels. Write engaging, concise captions (max 600 chars) with relevant emojis. Output the caption ONLY — no preface, no quotes.";
  const u = `Channel: ${opts.channelName || "(general)"}
Tema: ${opts.theme || "-"}
Keyword: ${opts.keywords || "-"}
Tulis caption Telegram yang menarik, ringkas, dengan emoji.`;
  return chat("google/gemini-2.5-flash", sys, u);
}

export async function rewriteCaption(original: string, channelName?: string): Promise<string> {
  const sys =
    "Rewrite the user's caption so it stays the same meaning and tone but uses different wording. Keep emojis. Output the caption ONLY.";
  return chat(
    "google/gemini-2.5-flash",
    sys,
    `Channel: ${channelName || "-"}\nCaption asli:\n${original}`,
  );
}

export async function generateImagePrompt(channelName?: string, theme?: string): Promise<string> {
  const sys = "Produce ONE concise English image-generation prompt (max 200 chars). Output ONLY the prompt.";
  return chat(
    "google/gemini-2.5-flash",
    sys,
    `Channel: ${channelName || "-"}\nTheme: ${theme || "lifestyle"}\nWrite an image prompt suitable for a social post.`,
  );
}

/** Generate an image; returns the raw base64 PNG. */
export async function generateImageBase64(prompt: string): Promise<string> {
  const res = await fetch(`${GATEWAY}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI image failed [${res.status}]: ${t}`);
  }
  const data: any = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("AI image returned no data");
  return b64;
}
