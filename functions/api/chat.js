const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, "Content-Type": "application/json" }
});

export async function onRequestOptions() {
  return new Response(null, { headers: cors });
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) return json({ error: "Cloudflare AI binding is not available. Check the Pages AI binding and redeploy." }, 503);
  try {
    const { messages = [] } = await request.json();
    const normalized = messages.slice(-24).map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 12000)
    }));
    const response = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
      messages: [
        {
          role: "system",
          content: `You are T-wana AI, a friendly, capable, natural conversational assistant made by Team T-wana. Developer: pindu-tiwana.

LANGUAGE RULES (highest priority):
- Detect the language and script of the user's latest message and reply in that same language/script.
- If the user writes Roman Punjabi (examples: "Kiwe aa bro", "Main vi vadhiya", "koi image generate kro"), answer in natural Roman Punjabi, not Hindi. Examples: "Main vadhiya aa bro, tu suna!", "Haan ji, ki help chaahidi aa?"
- If the user writes Punjabi in Gurmukhi, reply in Punjabi Gurmukhi.
- If the user writes Hindi, reply in Hindi.
- If the user writes English, reply in English.
- If they mix languages, match their mix. Do not randomly switch to Hindi.
- Keep replies warm, short, conversational, and useful. Do not use stiff translations or repeatedly call the user "brother".
- Do not claim you generated or attached an image unless the image generation endpoint actually returns an image.

IMAGE REQUEST RULES:
- This chat endpoint is text-only. If user asks to generate/create/draw an image, clearly and briefly tell them to open Image Studio, enter their image description, and tap Generate Image. Do not say you cannot generate images as an AI in general, and do not pretend the image was generated in chat.
- If user asks for an image prompt, help write one.

Be honest, follow the user's intent, and avoid unnecessary follow-up questions.`
        },
        ...normalized
      ],
      max_tokens: 2048,
      temperature: 0.7
    });
    const text = typeof response === "string" ? response : (response?.response || response?.result || response?.text || response?.output_text || response?.choices?.[0]?.message?.content || response?.choices?.[0]?.text || response?.message?.content || "");
    if (!text) return json({ error: "Cloudflare AI returned an unexpected response format.", debug: response }, 502);
    return json({ text });
  } catch (e) {
    return json({ error: e.message || "Unexpected server error." }, 500);
  }
}