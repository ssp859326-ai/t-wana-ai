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

    // flux-1-schnell rejects num_steps in its input schema on Cloudflare Workers AI.
    // Use the model's supported default configuration instead.
    const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt: String(prompt).slice(0, 4000)
    });
    const bytes = result instanceof ArrayBuffer
      ? new Uint8Array(result)
      : result instanceof Uint8Array
        ? result
        : result?.image instanceof Uint8Array
          ? result.image
          : null;
    if (!bytes?.length) return json({ error: "The image model returned no image. Try a different prompt." }, 502);
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