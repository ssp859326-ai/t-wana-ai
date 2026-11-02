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
  if (!env.AI) return json({ error: "Cloudflare AI binding is not available yet. The site needs to be redeployed after Workers AI is enabled." }, 503);
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
          content: "You are T-wana AI, a thoughtful, capable, warm assistant. Automatically reply in the language the user writes in: Punjabi (including Gurmukhi or Roman Punjabi), Hindi, or English. If the user mixes languages, naturally match them. Be clear, useful, conversational, and honest. Never claim to have generated an image unless the image tool did."
        },
        ...normalized
      ],
      max_tokens: 2048,
      temperature: 0.7
    });
    const text = response?.response || response?.result || "";
    if (!text) return json({ error: "The AI model returned an empty response. Please try again." }, 502);
    return json({ text });
  } catch (e) {
    return json({ error: e.message || "Unexpected server error." }, 500);
  }
}