import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { concepts } from "../lib/concepts.mjs";
import { validate } from "../lib/validate.mjs";

const problems = [];
const rows = JSON.parse(await readFile("results.json", "utf8"));
const readme = await readFile("README.md", "utf8");

if (!Array.isArray(rows) || rows.length !== concepts.length) {
  problems.push("results.json must contain exactly five results.");
} else {
  for (const [index, concept] of concepts.entries()) {
    const row = rows[index];
    const label = concept.title;
    if (row?.id !== concept.id) problems.push(`${label}: wrong or missing concept ID.`);
    if (row?.source !== "Groq" || !row.model)
      problems.push(`${label}: replace the reference with a Groq result.`);
    if (!Number.isFinite(row?.inputTokens) || row.inputTokens <= 0 ||
        !Number.isFinite(row?.outputTokens) || row.outputTokens <= 0 ||
        !Number.isFinite(row?.cost) || row.cost < 0 ||
        !Number.isInteger(row?.retries) || row.retries < 0)
      problems.push(`${label}: token, cost, or retry data is missing.`);
    if (row?.passed !== true || typeof row?.svg !== "string" ||
        Object.values(validate(row?.svg)).some((passed) => !passed))
      problems.push(`${label}: saved SVG does not pass every code check.`);
    if (!Array.isArray(row?.attempts) || row.attempts.length === 0 ||
        !row.attempts.every((attempt) => attempt?.checks &&
          Object.keys(attempt.checks).length === 5))
      problems.push(`${label}: per-attempt check log is missing.`);
  }
}

if (!readme.includes("<!-- results-start -->") ||
    !readme.includes("<!-- results-end -->") ||
    readme.includes("These are not the five final AI results"))
  problems.push("README.md still describes the reference-only state.");

try {
  const remote = execFileSync("git", ["remote", "get-url", "origin"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+(?:\.git)?$/.test(remote) &&
      !/^git@github\.com:[^/]+\/[^/]+(?:\.git)?$/.test(remote))
    problems.push("Git origin must point to the submission's GitHub repository.");
} catch {
  problems.push("Add the GitHub repository as git origin.");
}

if (problems.length) {
  console.error("Submission checks failed:\n- " + problems.join("\n- "));
  process.exitCode = 1;
} else {
  console.log("Saved Groq results, metadata, README, and GitHub origin are ready.");
  console.log("Final manual checks: live public URL, Generate button, diagram accuracy, and submitted links.");
}
