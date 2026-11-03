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
  if (!env.AI) {
    return json({
      error: "Cloudflare Workers AI binding is missing. Enable the AI binding for this Pages project and redeploy."
    }, 503);
  }

  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const image_b64 = body?.image_b64;
    if (!prompt) return json({ error: "Please describe the image you want to generate." }, 400);
    if (prompt.length > 4000) return json({ error: "Please keep your image prompt under 4,000 characters." }, 400);
    if (image_b64 && (typeof image_b64 !== "string" || image_b64.length > 7_000_000)) {
      return json({ error: "Reference image is too large. Please choose a smaller image." }, 413);
    }

    let result;
    if (image_b64) {
      // FLUX.2 dev accepts reference images as multipart input_image_0.
      const raw = atob(image_b64);
      const imageBytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) imageBytes[i] = raw.charCodeAt(i);

      const form = new FormData();
      form.append("prompt", prompt);
      form.append("input_image_0", new Blob([imageBytes], { type: "image/jpeg" }), "reference.jpg");
      form.append("width", "1024");
      form.append("height", "1024");
      const multipart = new Response(form);
      result = await env.AI.run("@cf/black-forest-labs/flux-2-dev", {
        multipart: {
          body: multipart.body,
          contentType: multipart.headers.get("content-type")
        }
      });
    } else {
      // Text-to-image: submit the user's full prompt to a general-purpose image model.
      // Do not force a fixed subject or art style; the prompt controls the result.
      result = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
        prompt,
        width: 1024,
        height: 1024,
        steps: 4
      });
    }

    const imageValue = result?.image ?? result;
    if (typeof imageValue === "string" && imageValue.length) {
      return json({
        image: imageValue.startsWith("data:image/")
          ? imageValue
          : "data:image/png;base64," + imageValue,
        text: ""
      });
    }

    let bytes = null;
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
      return json({ error: "The image model returned no image. Please try a different prompt." }, 502);
    }

    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return json({ image: "data:image/png;base64," + btoa(binary), text: "" });
  } catch (e) {
    const message = e?.message || "Unexpected server error.";
    return json({ error: "Image generation failed: " + message }, 500);
  }
}
