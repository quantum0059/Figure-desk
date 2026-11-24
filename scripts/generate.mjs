import { writeFile, rename, unlink } from "node:fs/promises";
import { concepts } from "../lib/concepts.mjs";
import { generate } from "../lib/generate.mjs";
const rows = [];
for (const concept of concepts) {
  const result = await generate(concept, process.env);
  if (!result.passed)
    throw Error(
      concept.title +
        " failed validation twice. Existing results.json was preserved.",
    );
  rows.push(result);
}
const temp = "results." + crypto.randomUUID() + ".tmp";
try {
  await writeFile(temp, JSON.stringify(rows, null, 2) + "\n");
  await rename(temp, "results.json");
} finally {
  await unlink(temp).catch(() => {});
}
const { readFile } = await import("node:fs/promises");
const readme = await readFile("README.md", "utf8");
const table = [
  "<!-- results-start -->",
  "| Concept | Source | Checks | Estimated USD | Retries |",
  "| --- | --- | --- | ---: | ---: |",
  ...rows.map(
    (r, i) =>
      "| " +
      [
        concepts[i].title,
        r.model,
        "5/5 pass",
        r.cost.toFixed(6),
        r.retries,
      ].join(" | ") +
      " |",
  ),
  "<!-- results-end -->",
].join("\n");
await writeFile(
  "README.md",
  readme.replace(/<!-- results-start -->[\s\S]*?<!-- results-end -->/, table),
);
