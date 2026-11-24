import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { concepts } from "../lib/concepts.mjs";
import { generate } from "../lib/generate.mjs";
import { validate } from "../lib/validate.mjs";
const args = process.argv.slice(2);
const target = args.length === 2 && args[0] === "--id" ? args[1] : null;
if (args.length && (!target || !concepts.some((c) => c.id === target)))
  throw Error("Use --id followed by one of the five concept IDs.");
const progressFile = "results.progress.json";
const provider = process.env.GROQ_API_KEY ? "Groq" : "Gemini";
let progress = [];
if (!target) {
  try {
    progress = JSON.parse(await readFile(progressFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
if (!Array.isArray(progress) || progress.some((row, i) =>
  row.id !== concepts[i]?.id || row.source !== provider ||
  !row.passed || Object.values(validate(row.svg)).some((passed) => !passed)))
  throw Error("Invalid saved generation progress. Inspect results.progress.json before retrying.");
const rows = [];
const previous = target ? JSON.parse(await readFile("results.json", "utf8")) : [];
if (target && (previous.length !== concepts.length || previous.some((row, i) =>
  row.id !== concepts[i].id || row.source !== provider ||
  !row.passed || Object.values(validate(row.svg)).some((passed) => !passed))))
  throw Error("Saved results must be complete before replacing one concept.");
for (const concept of concepts) {
  const result = target && concept.id !== target
    ? previous[rows.length]
    : progress[rows.length] || await generate(concept, process.env);
  if (!result.passed)
    throw Error(
      concept.title +
        " failed validation twice. Existing results.json was preserved.",
    );
  rows.push(result);
  if (!target) {
    const checkpoint = "results." + crypto.randomUUID() + ".tmp";
    try {
      await writeFile(checkpoint, JSON.stringify(rows, null, 2) + "\n");
      await rename(checkpoint, progressFile);
    } finally {
      await unlink(checkpoint).catch(() => {});
    }
  }
}
const temp = "results." + crypto.randomUUID() + ".tmp";
try {
  await writeFile(temp, JSON.stringify(rows, null, 2) + "\n");
  await rename(temp, "results.json");
} finally {
  await unlink(temp).catch(() => {});
}
const readme = await readFile("README.md", "utf8");
const table = [
  "<!-- results-start -->",
  "| Concept | Model | Checks | Estimated USD | Retries |",
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
  readme
    .replace(/<!-- results-start -->[\s\S]*?<!-- results-end -->/, table)
    .replace(
      /<!-- generation-status-start -->[\s\S]*?<!-- generation-status-end -->/,
      "<!-- generation-status-start -->\n" +
        `The five saved diagrams were generated with ${provider} and validated by the code checks. ` +
        "Inspect their scientific accuracy and animation in the browser before submission.\n" +
        "<!-- generation-status-end -->",
    ),
);
if (!target) await unlink(progressFile);
