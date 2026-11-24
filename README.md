# Figure Desk

A Next.js review workspace for five animated UK GCSE diagrams. The first page is built from the committed results.json and opens without contacting Gemini. Select a concept and click **Generate** to run the server-side pipeline. Each live result gets its own review history.

## Run locally

Use Node.js 22.13 or later and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. On Windows PowerShell, use `Copy-Item .env.example .env.local`. For live generation, set `GEMINI_API_KEY` in .env.local. This file is ignored by Git. Leave the key out of client variables. The assignment suggests `gemini-3.5-flash-lite`. If your account requires another free model, set `GEMINI_MODEL` and record the choice here.

## Saved results

This checkout starts with five authored reference illustrations so the entire review flow is usable offline. No Gemini key was supplied during development. Their model usage and estimated cost are unknown or inapplicable. A complete assignment submission needs the actual five Gemini results.

<!-- results-start -->
| Concept | Source | Checks | Estimated USD | Retries |
| --- | --- | --- | ---: | ---: |
| Pythagoras’ theorem | Reference | 5/5 pass | — | 0 |
| Parts of a circle | Reference | 5/5 pass | — | 0 |
| Series circuit | Reference | 5/5 pass | — | 0 |
| Photosynthesis | Reference | 5/5 pass | — | 0 |
| States of matter | Reference | 5/5 pass | — | 0 |
<!-- results-end -->

With your key configured, run the following before submitting.

```sh
npm run generate
npm test
npm run build
npm start
```

The batch contacts Gemini sequentially, replaces results.json only after all five concepts pass, and updates the table above. Inspect the animation and scientific content of each diagram, then commit results.json and README.md. For Vercel, import the GitHub repo as a Next.js project, add the same server environment variables, and deploy. Confirm the reviewer can open the URL signed out. Hand in the deployed URL and the GitHub repository.

## How generation works

- **lib/concepts.mjs** contains the five original lesson briefs.
- **lib/generate.mjs** calls generateContent once per concept. A failed check triggers one repair prompt with the previous drawing and the names of the failed checks. HTTP 429 and 503 share a three-retry budget per concept. Exponential waits respect Retry-After. A requested cooldown over 30 seconds exits with a clear error to avoid holding a web request open.
- **lib/validate.mjs** parses XML and verifies the SVG root, bounds, title plus three distinct labels, and a changing animation. The fifth check allowlists shapes, attributes and animation properties. Keeping the drawing format small makes bounds computable. Text uses a conservative one-em-per-character estimate. Geometry, stroke width, polygon joins and animated particle positions are checked. Scientific meaning and label overlaps still require the reviewer.
- **pages/api/generate.js** and the batch script call the same generator. The endpoint accepts one of the five concept IDs. SVGs render in image context. Invalid drawings are withheld, with individual failed checks visible.
- Each run logs JSON with model name, input and output token counts, retries, estimated USD and checks per attempt. Output includes thinking tokens in the reported total. Successful provider responses across both attempts contribute to cost. The default estimate assumes free-tier usage at zero USD per million tokens. For another pricing tier, set the two per-million rates in .env.example to that model's rates.
- **lib/Studio.jsx** uses localStorage for a single reviewer's decisions, notes and live diagrams. This avoids database setup, survives refresh and keeps review notes on the device. Reviews are keyed by concept and revision so a new drawing starts pending. Browser storage is per origin and browser profile.

## Verification and fixes

Run `npm test` for the XML and bounds checks, retry and usage accounting, provider failures, API contract, and React interactions. UI tests exercise initial load without Gemini, saved decisions and notes, combined filters, failed generation and fresh review state on regeneration. The deterministic provider tests use mocked responses. The browser preview also exercised the actual Next.js missing-key response. A real Gemini generation still requires credentials.

The first production build failed because npm initialized the package as CommonJS. Removing that declaration let Next compile the page and API modules. A UI test also caught filter counts that screen readers joined to their labels. The filter controls now have explicit accessible names.

## With one more day

Add curriculum-specific evaluation examples and browser-based visual checks for text collisions. For a shared review team, store reviewer identity and decisions in a database. For an unrestricted public deployment, add a shared generation quota at the host before enabling paid model access.

## AI assistance

OpenAI Codex (ChatGPT) implemented the app, authored the initial reference illustrations and tests, and ran verification. Gemini is the runtime diagram provider. Anyone submitting this project should review the implementation and be prepared to change it live.
