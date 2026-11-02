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
  if (!env.GEMINI_API_KEY) return json({ error: "Image generation is not connected yet. Add GEMINI_API_KEY in Cloudflare Pages settings." }, 503);
  try {
    const { prompt } = await request.json();
    if (!prompt || !String(prompt).trim()) return json({ error: "Describe the image you want to create." }, 400);
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: String(prompt).slice(0, 4000) }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
      })
    });
    const data = await response.json();
    if (!response.ok) return json({ error: data?.error?.message || "Image generation failed." }, response.status);
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData?.data);
    if (!imagePart) return json({ error: parts.find(p => p.text)?.text || "The model returned no image. Try another prompt." }, 502);
    return json({ image: "data:" + imagePart.inlineData.mimeType + ";base64," + imagePart.inlineData.data, text: parts.find(p => p.text)?.text || "" });
  } catch (e) {
    return json({ error: e.message || "Unexpected server error." }, 500);
  }
}