import assets from "virtual:next-assets";
import { handleGenerate } from "../lib/api.mjs";
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/api/generate") {
      let body = null;
      if (request.method === "POST") {
        const text = await request.text();
        if (text.length > 2048)
          return Response.json(
            { error: "Request is too large." },
            { status: 413 },
          );
        try {
          body = JSON.parse(text);
        } catch {
          return Response.json({ error: "Invalid JSON." }, { status: 400 });
        }
      }
      const result = await handleGenerate(request.method, body, env);
      return Response.json(result.body, {
        status: result.status,
        headers: { "Cache-Control": "no-store", Allow: "POST" },
      });
    }
    if (!["GET", "HEAD"].includes(request.method))
      return new Response(null, { status: 405 });
    const asset = Object.hasOwn(assets, path) ? assets[path] : null;
    if (!asset) return new Response("Page not found", { status: 404 });
    return new Response(request.method === "HEAD" ? null : asset.text, {
      headers: {
        "Content-Type": asset.mime,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": path.startsWith("/_next/static/")
          ? "public,max-age=31536000,immutable"
          : "no-cache",
      },
    });
  },
};
