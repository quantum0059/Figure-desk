// Bundle the prerendered Next page, its hashed JS/CSS, and the same generation handler for Worker hosting.
import { readdir, readFile, mkdir } from "node:fs/promises";
import { build } from "esbuild";
const assets = {
  "/": {
    text: await readFile(".next/server/pages/index.html", "utf8"),
    mime: "text/html; charset=utf-8",
  },
};
for (const file of await readdir(".next/static", { recursive: true })) {
  const mime = file.endsWith(".js")
    ? "application/javascript"
    : file.endsWith(".css")
      ? "text/css"
      : null;
  if (mime)
    assets["/_next/static/" + file.replaceAll("\\", "/")] = {
      mime,
      text: await readFile(".next/static/" + file, "utf8"),
    };
}
await mkdir("dist/server", { recursive: true });
await build({
  entryPoints: ["scripts/worker.mjs"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  plugins: [
    {
      name: "next-assets",
      setup(plugin) {
        plugin.onResolve({ filter: /^virtual:next-assets$/ }, () => ({
          path: "assets",
          namespace: "next",
        }));
        plugin.onLoad({ filter: /.*/, namespace: "next" }, () => ({
          contents: JSON.stringify(assets),
          loader: "json",
        }));
      },
    },
  ],
});
