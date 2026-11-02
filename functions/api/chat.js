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
  if (!env.GEMINI_API_KEY) return json({ error: "AI is not connected yet. Add GEMINI_API_KEY in Cloudflare Pages settings." }, 503);
  try {
    const { messages = [] } = await request.json();
    const contents = messages.slice(-24).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "").slice(0, 12000) }]
    }));
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are T-wana AI, a thoughtful, capable, warm assistant. Automatically reply in the language the user writes in: Punjabi (including Gurmukhi or Roman Punjabi), Hindi, or English. If the user mixes languages, naturally match them. Be clear, useful, conversational, and honest. Never claim to have generated an image unless the image tool did." }] },
        contents,
        generationConfig: { temperature: 0.75, maxOutputTokens: 2048 }
      })
    });
    const data = await response.json();
    if (!response.ok) return json({ error: data?.error?.message || "AI request failed." }, response.status);
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "I couldn't generate a response. Please try again.";
    return json({ text });
  } catch (e) {
    return json({ error: e.message || "Unexpected server error." }, 500);
  }
}