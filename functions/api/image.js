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
    const { prompt } = await request.json();
    if (!prompt || !String(prompt).trim()) return json({ error: "Describe the image you want to create." }, 400);

    // Quality-first settings: use the full SDXL-Lightning step budget and 1024px output.
    const result = await env.AI.run("@cf/lykon/dreamshaper-8-lcm", {
      prompt: String(prompt).trim().slice(0, 4000),
      negative_prompt: "low quality, blurry, pixelated, low resolution, poorly drawn, distorted, malformed, deformed, duplicate objects, extra limbs, bad anatomy, unrealistic textures, oversaturated, watermark, text, logo",
      width: 1024,
      height: 1024,
      num_steps: 20,
      guidance: 7.5
    });

    const base64 = typeof result?.image === "string"
      ? result.image
      : typeof result === "string"
        ? result
        : null;
    if (base64?.length) {
      return json({
        image: base64.startsWith("data:image/") ? base64 : "data:image/png;base64," + base64,
        text: ""
      });
    }
    const bytes = result instanceof ArrayBuffer
      ? new Uint8Array(result)
      : result instanceof Uint8Array
        ? result
        : result?.image instanceof Uint8Array
          ? result.image
          : null;
    if (!bytes?.length) {
      const shape = result && typeof result === "object" ? Object.keys(result).join(", ") : typeof result;
      return json({ error: "DreamShaper returned an unsupported response format (" + shape + ")." }, 502);
    }
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return json({ image: "data:image/png;base64," + btoa(binary), text: "" });
  } catch (e) {
    return json({ error: e.message || "Unexpected server error." }, 500);
  }
}