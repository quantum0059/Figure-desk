import { dialect, validate } from "./validate.mjs";

export class GenerationError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const lessonGuidance = {
  pythagoras:
    "Draw a right triangle with the right-angle corner marked. Label its two legs a and b, the opposite longest side c, and show the visible equation a² + b² = c². If you draw squares on the sides, they must actually be square.",
  circle:
    "Show a centre point, a radius from that point to the circle edge, a diameter through the centre with both ends on the edge, and the circumference as the outer circle. Keep the labels separate.",
  circuit:
    "Draw one rectangular series loop with corners (80,60) and (460,180). On the top edge y=60, two resistor rectangles occupy x=180..230 and x=320..370; draw wire only on x=80..180, 230..320, 370..460 so no wire bypasses either resistor. Draw the right edge x=460 y=60..180 and bottom edge y=180 x=80..460. On the left edge x=80 draw wire y=60..100 and y=120..180, with a cell symbol in the gap: two unequal HORIZONTAL plate lines at y=100 and y=120. Keep the plates separate. Label same current everywhere and voltage shared. No other wires or branches.",
  photosynthesis:
    "Place a chlorophyll leaf at x=260..340, y=80..160. Draw sunlight DOWN at x=300 from y=20 to y=80, CO₂ RIGHT from x=150 to x=260 at y=120, and water UP at x=300 from y=220 to y=160. Draw glucose RIGHT from x=340 to x=470 at y=105 and oxygen RIGHT from x=340 to x=470 at y=145. Put arrowheads at the listed destinations. Do not overlap the sunlight and oxygen arrows or reverse the water arrow.",
  matter:
    "Show separate solid, liquid and gas particle groups. Animate at least one particle in each: solid particles vibrate a tiny distance in place, liquid particles move past neighbours, and widely spaced gas particles move a larger distance faster. Use circle cx or cy animation for movement.",
};
export async function generate(
  concept,
  env,
  { request = fetch, wait = pause, log = console.info } = {},
) {
  if (!env.GROQ_API_KEY && !env.GEMINI_API_KEY)
    throw new GenerationError(
      "Live generation needs an API key. Set GROQ_API_KEY or GEMINI_API_KEY on the server and try again.",
      503,
    );
  const provider = env.GROQ_API_KEY ? "Groq" : "Gemini";
  const model = provider === "Groq"
    ? env.GROQ_MODEL || "openai/gpt-oss-120b"
    : env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const thinkingLevel = env.GEMINI_THINKING_LEVEL ||
    (model === "gemini-3.8-flash" ? "low" : "minimal");
  const rates = provider === "Groq"
    ? [
        Number(env.GROQ_INPUT_USD_PER_MILLION ?? 0.15),
        Number(env.GROQ_OUTPUT_USD_PER_MILLION ?? 0.60),
      ]
    : [
        Number(env.INPUT_USD_PER_MILLION || 0),
        Number(env.OUTPUT_USD_PER_MILLION || 0),
      ];
  if (!rates.every((x) => Number.isFinite(x) && x >= 0))
    throw new GenerationError("Invalid server pricing configuration.", 500);
  const run = {
    id: concept.id,
    revision: crypto.randomUUID(),
    source: provider,
    model,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    retries: 0,
    attempts: [],
    checks: null,
  };
  const prompt =
    "Draw one accurate UK GCSE teaching diagram. Return only raw SVG. " +
    dialect +
    " Lesson: " +
    concept.brief +
    " Drawing guidance: " + (lessonGuidance[concept.id] || "");
  let instruction = prompt,
    transient = 0;
  try {
    for (let pass = 0; pass < 2; pass++) {
      let response;
      while (true) {
        response = await request(
          provider === "Groq"
            ? "https://api.groq.com/openai/v1/chat/completions"
            : "https://generativelanguage.googleapis.com/v1beta/models/" +
                encodeURIComponent(model) + ":generateContent",
          {
            method: "POST",
            headers: provider === "Groq"
              ? {
                  "Content-Type": "application/json",
                  Authorization: "Bearer " + env.GROQ_API_KEY,
                }
              : {
                  "Content-Type": "application/json",
                  "x-goog-api-key": env.GEMINI_API_KEY,
                },
            body: JSON.stringify(provider === "Groq"
              ? {
                  model,
                  messages: [{ role: "user", content: instruction }],
                  max_completion_tokens: 2048,
                  reasoning_effort: "low",
                  include_reasoning: false,
                  temperature: 0.2,
                }
              : {
                  contents: [{ parts: [{ text: instruction }] }],
                  generationConfig: {
                    maxOutputTokens: 1536,
                    thinkingConfig: { thinkingLevel },
                  },
                }),
            signal: AbortSignal.timeout(60000),
          },
        );
        if (![429, 503].includes(response.status) || transient >= 3) break;
        const retryAfter = response.headers.get("Retry-After");
        const delay =
          retryAfter === null
            ? 0
            : /^\d+$/.test(retryAfter)
              ? Number(retryAfter) * 1000
              : Date.parse(retryAfter) - Date.now();
        if (delay > 30000)
          throw new GenerationError(
            provider + " requested a longer cooldown. Please try again later.",
            429,
          );
        await wait(Math.max(1000 * 2 ** transient, delay || 0));
        transient++;
        run.retries++;
      }
      if (!response.ok)
        throw new GenerationError(
          provider + " returned HTTP " +
            response.status +
            ". " +
            ([401, 403, 404].includes(response.status)
              ? "Check the server key and model."
              : "Please try again later."),
          response.status === 429 ? 429 : 502,
        );
      const data = await response.json(),
        usage = provider === "Groq" ? data.usage : data.usageMetadata;
      const input = provider === "Groq"
        ? usage?.prompt_tokens : usage?.promptTokenCount;
      const output = provider === "Groq"
        ? usage?.completion_tokens
        : usage?.totalTokenCount - usage?.promptTokenCount;
      if (
        !usage ||
        !Number.isFinite(input) ||
        !Number.isFinite(output)
      )
        throw new GenerationError(
          provider + " omitted usage information. Please retry.",
        );
      run.inputTokens += input;
      run.outputTokens += Math.max(0, output);
      run.cost =
        (rates[0] * run.inputTokens + rates[1] * run.outputTokens) / 1e6;
      const svg = (provider === "Groq"
        ? data.choices?.[0]?.message?.content || ""
        : (data.candidates?.[0]?.content?.parts || [])
            .filter((p) => !p.thought)
            .map((p) => p.text || "")
            .join(""))
        .trim()
        .replace(
          /^\x60\x60\x60(?:svg|xml)?\s*([\s\S]*?)\s*\x60\x60\x60$/i,
          "$1",
        );
      run.checks = validate(svg);
      run.attempts.push({ checks: run.checks });
      const failed = Object.keys(run.checks).filter((k) => !run.checks[k]);
      if (!failed.length) return { ...run, svg, passed: true };
      if (pass === 0) {
        run.retries++;
        const hints = {
          "Valid SVG": "Return well-formed SVG with the correct namespace.",
          "Inside canvas": "A shape, stroke, animation position or label exceeded the 600 by 240 viewBox. Keep text short and all coordinates inside it.",
          "Title & labels": "Include a nonempty title and at least three distinct visible text labels.",
          Animated: "Include a changing animate element inside a visible shape.",
          "Safe elements": "Use only the listed SVG elements and attributes, with no styles or transforms.",
        };
        instruction =
          prompt +
          " Previous attempt failed: " +
          failed.join(", ") +
          ". " + failed.map((name) => hints[name]).join(" ") +
          " Redraw it and fix these failures. Previous SVG: " +
          svg.slice(0, 12000);
      }
    }
    return { ...run, svg: null, passed: false };
  } catch (error) {
    if (error instanceof GenerationError) throw error;
    throw new GenerationError(
      error.name === "TimeoutError"
        ? provider + " timed out. Please retry."
        : "Could not read a response from " + provider + ". Please retry.",
    );
  } finally {
    log(JSON.stringify(run));
  }
}
