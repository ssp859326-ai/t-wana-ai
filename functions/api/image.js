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

    // Flux Schnell is stronger at following detailed prompts than the previous
    // DreamShaper LCM model. It uses 4 inference steps and returns image bytes.
    const userPrompt = String(prompt).trim().slice(0, 4000);
    const result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
      prompt: userPrompt,
      width: 1024,
      height: 1024,
      num_steps: 4
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

    // Workers AI image results may be raw streams, Responses, Blobs, or bytes.
    let bytes = null;
    const imageValue = result?.image ?? result;
    if (imageValue instanceof Uint8Array) {
      bytes = imageValue;
    } else if (imageValue instanceof ArrayBuffer) {
      bytes = new Uint8Array(imageValue);
    } else if (typeof Blob !== "undefined" && imageValue instanceof Blob) {
      bytes = new Uint8Array(await imageValue.arrayBuffer());
    } else if (typeof Response !== "undefined" && imageValue instanceof Response) {
      bytes = new Uint8Array(await imageValue.arrayBuffer());
    } else if (imageValue && typeof imageValue.getReader === "function") {
      bytes = new Uint8Array(await new Response(imageValue).arrayBuffer());
    }
    if (!bytes?.length) {
      const shape = result && typeof result === "object" ? Object.keys(result).join(", ") : typeof result;
      return json({ error: "Flux returned an unsupported response format (" + shape + ")." }, 502);
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
