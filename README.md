# Figure Desk

A Next.js review workspace for five animated UK GCSE diagrams. The first page is built from the committed results.json and opens without contacting an AI provider. Select a concept and click **Generate** to run the server-side pipeline. Each live result gets its own review history.

Live app: [Figure Desk](https://figure-desk-science-lab.roundpassionflower16.chatgpt.site) (public, no sign-in).

## Run locally

Use Node.js 22.13 or later and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. On Windows PowerShell, use `Copy-Item .env.example .env.local`. For live generation, set `GROQ_API_KEY` in .env.local. This file is ignored by Git. Leave the key out of client variables. Groq is selected when its key is present; otherwise the original Gemini path uses `GEMINI_API_KEY`.

## Saved results

<!-- generation-status-start -->
The five saved diagrams were generated with Groq and validated by the code checks. Inspect their scientific accuracy and animation in the browser before submission.
<!-- generation-status-end -->

<!-- results-start -->
| Concept | Model | Checks | Estimated USD | Retries |
| --- | --- | --- | ---: | ---: |
| Pythagoras’ theorem | openai/gpt-oss-120b | 5/5 pass | 0.000542 | 0 |
| Parts of a circle | openai/gpt-oss-120b | 5/5 pass | 0.000469 | 0 |
| Series circuit | openai/gpt-oss-120b | 5/5 pass | 0.000516 | 0 |
| Photosynthesis | openai/gpt-oss-120b | 5/5 pass | 0.000771 | 0 |
| States of matter | openai/gpt-oss-120b | 5/5 pass | 0.000699 | 0 |
<!-- results-end -->

To create or refresh all five saved diagrams, run `npm run generate`. To refresh one diagram after reviewing it, run `npm run generate -- --id circuit` (replace the ID as needed). Once the saved diagrams are ready, verify the project:

```sh
npm test
npm run build
npm run submission:check
npm start
```

The batch contacts the selected provider sequentially and checkpoints successful concepts in an ignored `results.progress.json` so a timeout can be resumed. It replaces results.json only after all five concepts pass, then updates the table and generation status above. `submission:check` confirms the five saved results came from Groq, have usage logs and valid SVGs, and that a GitHub origin is configured. The current public deployment uses ChatGPT Sites with `GROQ_API_KEY` stored as a server secret. Its signed-out page and live Generate endpoint were both verified. If redeploying elsewhere, configure the same server environment variable and test the public URL again. Submit the live app URL and the [GitHub repository](https://github.com/quantum0059/Figure-desk).

## How generation works

- **lib/concepts.mjs** contains the five original lesson briefs.
- **lib/generate.mjs** calls Groq Chat Completions once per concept when `GROQ_API_KEY` is set, or Gemini generateContent otherwise. A failed check triggers one repair prompt with the previous drawing and the names of the failed checks. HTTP 429 and 503 share a three-retry budget per concept. Exponential waits respect Retry-After. A requested cooldown over 30 seconds exits with a clear error to avoid holding a web request open.
- **lib/validate.mjs** parses XML and verifies the SVG root, bounds, title plus three distinct labels, and a changing animation. The fifth check allowlists shapes, attributes and animation properties. Keeping the drawing format small makes bounds computable. Text uses a conservative one-em-per-character estimate. Geometry, stroke width, polygon joins and animated particle positions are checked. Scientific meaning and label overlaps still require the reviewer.
- **pages/api/generate.js** and the batch script call the same generator. The endpoint accepts one of the five concept IDs. SVGs render in image context. Invalid drawings are withheld, with individual failed checks visible.
- Each run logs JSON with model name, input and output token counts, retries, estimated USD and checks per attempt. Successful provider responses across both attempts contribute to cost. Groq uses its reported prompt and completion tokens, with an estimated list-price equivalent of $0.15 input and $0.60 output per million tokens for `openai/gpt-oss-120b` ([Groq pricing](https://console.groq.com/docs/model/openai/gpt-oss-120b)); the free-tier account is not charged. Update the two `GROQ_*_USD_PER_MILLION` values if pricing changes. Gemini defaults to a $0 free-tier estimate.
- **lib/Studio.jsx** uses localStorage for a single reviewer's decisions, notes and live diagrams. This avoids database setup, survives refresh and keeps review notes on the device. Reviews are keyed by concept and revision so a new drawing starts pending. Browser storage is per origin and browser profile.

## Verification and fixes

Run `npm test` for the XML and bounds checks, retry and usage accounting, provider failures, API contract, and React interactions. UI tests exercise initial load without an AI call, saved decisions and notes, combined filters, failed generation and fresh review state on regeneration. The deterministic provider tests use mocked responses. The browser preview also exercised the actual Next.js missing-key response. The saved five-concept Groq batch has now completed.

The first production build failed because npm initialized the package as CommonJS. Removing that declaration let Next compile the page and API modules. A UI test also caught filter counts that screen readers joined to their labels. The filter controls now have explicit accessible names. Later Gemini attempts exposed a 20-second request timeout and repeated HTTP 503 high-demand responses, so the batch switched to Groq's free tier. The timeout is now 60 seconds, prompts request compact SVGs, repair feedback names the concrete problem, and batch progress is checkpointed for resumption.

The first Groq diagrams passed the code checks but human review found a circuit wire that bypassed components, incorrect photosynthesis arrow directions, and weak particle animation. Concept-specific guidance and regeneration corrected the arrows and particle motion. The final Groq circuit still had a small gap in its lower wire and equal-length cell plates; those two geometry details were corrected manually, recorded in its `reviewEdits` field, and revalidated. The code checks do not judge scientific meaning, so visual review remains essential.

## With one more day

Add curriculum-specific evaluation examples and browser-based visual checks for text collisions. For a shared review team, store reviewer identity and decisions in a database. For an unrestricted public deployment, add a shared generation quota at the host before enabling paid model access.

## AI assistance

OpenAI Codex (ChatGPT) implemented the app, authored the initial reference illustrations and tests, and ran verification. Groq hosts the chosen runtime diagram model; Gemini was attempted first but returned repeated 503 errors and timeouts. Anyone submitting this project should review the implementation and be prepared to change it live.
