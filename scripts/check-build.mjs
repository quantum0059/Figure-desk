import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
// Use a data URL so Node loads the portable Worker bundle as an ES module.
const source = await readFile("dist/server/index.js");
const { default: worker } = await import(
  "data:text/javascript;base64," + source.toString("base64")
);
const visit = (path, init) =>
  worker.fetch(new Request("https://review.example" + path, init), {});
const response = await visit("/");
assert.equal(response.status, 200);
const html = await response.text();
assert.equal((html.match(/<img /g) || []).length, 5);
const links = [
  ...html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+)"/g),
].map((m) => m[1]);
assert.ok(links.length >= 3);
for (const link of links) assert.equal((await visit(link)).status, 200, link);
assert.equal((await visit("/missing")).status, 404);
const api = await visit("/api/generate", {
  method: "POST",
  body: JSON.stringify({ id: "circle" }),
});
assert.equal(api.status, 503);
assert.match((await api.json()).error, /GEMINI_API_KEY/);
console.log(
  "Production bundle verified: five diagrams, " +
    links.length +
    " static asset references, missing page and API error handling.",
);
