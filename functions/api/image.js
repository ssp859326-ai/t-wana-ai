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
    const { prompt, image_b64, strength } = await request.json();
    if (!prompt || !String(prompt).trim()) return json({ error: "Describe the image you want to create." }, 400);
    if (image_b64 && (typeof image_b64 !== "string" || image_b64.length > 7_000_000)) {
      return json({ error: "Reference image is too large. Please choose a smaller image." }, 413);
    }

    // FLUX.2 dev accepts reference images through multipart input_image_0.
    // Convert the client's base64 image into binary and pass a multipart stream
    // to the Workers AI binding; JSON image_b64 is not a valid model tensor.
    let result;
    if (image_b64) {
      const raw = atob(image_b64);
      const imageBytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) imageBytes[i] = raw.charCodeAt(i);
      const form = new FormData();
      form.append("prompt", userPrompt);
      form.append("input_image_0", new Blob([imageBytes], { type: "image/jpeg" }), "reference.jpg");
      form.append("width", "512");
      form.append("height", "512");
      const multipart = new Response(form);
      result = await env.AI.run("@cf/black-forest-labs/flux-2-dev", {
        multipart: {
          body: multipart.body,
          contentType: multipart.headers.get("content-type")
        }
      });
    } else {
      result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
        prompt: userPrompt
      });
    }

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
      return json({ error: "Workers AI returned an unsupported image response format (" + shape + ")." }, 502);
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
