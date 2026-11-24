import test from "node:test";
import assert from "node:assert/strict";
import fixtures from "./reference.json" with { type: "json" };
import rows from "../results.json" with { type: "json" };
import { concepts } from "../lib/concepts.mjs";
import { generate } from "../lib/generate.mjs";
import { validate } from "../lib/validate.mjs";
import { handleGenerate } from "../lib/api.mjs";
const svg = fixtures[0].svg;
for (const [i, r] of rows.entries())
  test("Saved row: " + r.id, () => {
    assert.equal(r.id, concepts[i].id);
    assert.deepEqual(validate(r.svg), r.checks);
    assert.ok(Object.values(r.checks).every(Boolean));
  });
for (const [label, input, check] of [
  ["malformed XML", "<svg>", "Valid SVG"],
  ["doctype", "<!DOCTYPE foo>" + svg, "Valid SVG"],
  ["wrong namespace", svg.replace("2000/svg", "2000/bogus"), "Valid SVG"],
  ["out of bounds", svg.replace("115,46", "-10,46"), "Inside canvas"],
  [
    "unsupported transform",
    svg.replace("<polygon", '<polygon transform="translate(5)"'),
    "Safe elements",
  ],
  [
    "event handler",
    svg.replace("<line", '<line onclick="alert(1)"'),
    "Safe elements",
  ],
  [
    "external image",
    svg.replace("</svg>", '<image href="remote"/></svg>'),
    "Safe elements",
  ],
  ["missing title", svg.replace(/<title>.*?<\/title>/, ""), "Title & labels"],
  ["empty labels", svg.replace(/<text .*?<\/text>/g, ""), "Title & labels"],
  ["no motion", svg.replace(/<animate[^>]+\/>/, ""), "Animated"],
  ["constant animation", svg.replace("1;0.35;1", "1;1"), "Animated"],
  ["text overflow", svg.replace('x="345"', 'x="599"'), "Inside canvas"],
  ["oversized input", " ".repeat(100001), "Valid SVG"],
])
  test(label, () => assert.equal(validate(input)[check], false));
const valid = () =>
  Response.json({
    candidates: [{ content: { parts: [{ text: svg }] } }],
    usageMetadata: { promptTokenCount: 100, totalTokenCount: 350 },
  });
function harness(responses) {
  const requests = [],
    delays = [],
    logs = [];
  const opts = {
    request: async (url, init) => {
      requests.push({ url, ...init });
      return responses.shift()();
    },
    wait: async (ms) => delays.push(ms),
    log: (v) => logs.push(JSON.parse(v)),
  };
  return {
    requests,
    delays,
    logs,
    run: () =>
      generate(
        concepts[0],
        {
          GEMINI_API_KEY: "fake",
          INPUT_USD_PER_MILLION: "1",
          OUTPUT_USD_PER_MILLION: "2",
        },
        opts,
      ),
  };
}
const invalid = () =>
  Response.json({
    candidates: [{ content: { parts: [{ text: "broken" }] } }],
    usageMetadata: { promptTokenCount: 10, totalTokenCount: 50 },
  });
test("success records measured cost and no retry", async () => {
  const h = harness([valid]);
  const r = await h.run();
  assert.equal(r.cost, 0.0006);
  assert.equal(r.retries, 0);
  assert.equal(r.outputTokens, 250);
  assert.equal(h.logs.length, 1);
});
test("repair includes failed checks and both attempts count toward cost", async () => {
  const h = harness([invalid, valid]);
  const r = await h.run();
  assert.match(h.requests[1].body, /Previous attempt failed: Valid SVG/);
  assert.equal(r.attempts.length, 2);
  assert.equal(r.inputTokens, 110);
  assert.equal(r.outputTokens, 290);
  assert.equal(r.retries, 1);
});
test("two invalid responses withhold the drawing", async () => {
  const r = await harness([invalid, invalid]).run();
  assert.equal(r.svg, null);
  assert.equal(r.passed, false);
  assert.equal(r.retries, 1);
});
for (const status of [429, 503])
  test("backs off on " + status, async () => {
    const h = harness([
      () => new Response(null, { status, headers: { "retry-after": "2" } }),
      valid,
    ]);
    assert.equal((await h.run()).retries, 1);
    assert.deepEqual(h.delays, [2000]);
  });
test("caps temporary retries at three", async () => {
  const h = harness(Array(4).fill(() => new Response(null, { status: 503 })));
  await assert.rejects(h.run(), /503/);
  assert.deepEqual(h.delays, [1000, 2000, 4000]);
  assert.equal(h.logs[0].retries, 3);
});
test("permanent rejection has no retry", async () => {
  const h = harness([() => new Response(null, { status: 403 })]);
  await assert.rejects(h.run(), /403/);
  assert.deepEqual(h.delays, []);
});
test("missing usage is an error", async () => {
  await assert.rejects(harness([() => Response.json({})]).run(), /usage/);
});
test("timeout is visible", async () => {
  await assert.rejects(
    harness([
      () => {
        throw new DOMException("timeout", "TimeoutError");
      },
    ]).run(),
    /timed out/,
  );
});
test("API validates method, concept and key", async () => {
  for (const [method, body, status] of [
    ["GET", {}, 405],
    ["POST", { id: "unknown" }, 400],
    ["POST", { id: "circle" }, 503],
  ])
    assert.equal((await handleGenerate(method, body, {})).status, status);
});
test("animated particle trajectories stay within the canvas", () => {
  const moving = fixtures[4].svg.replace(
    /attributeName="cx" values="[^"]+"/,
    'attributeName="cx" values="10;700;10"',
  );
  assert.equal(validate(moving)["Inside canvas"], false);
});
test("CDATA text contributes to label bounds", () => {
  const wide = svg.replace(
    "hypotenuse</text>",
    "hypotenuse<![CDATA[" + "X".repeat(200) + "]]></text>",
  );
  assert.equal(validate(wide)["Inside canvas"], false);
});
