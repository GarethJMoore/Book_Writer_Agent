# Agentic Book Writer (v0)

A minimal Next.js app that runs an agentic book-writing pipeline with validator-driven revisions. Drafts chapters, validates for consistency/style/citations, and persists everything to disk under `/data`.

## Setup

```bash
npm install
```

Create an `.env.local` file with:

```
OPENAI_API_KEY=your_key_here
```

If the key is missing, the app falls back to a mock LLM adapter for deterministic demo output.

## Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## Usage

1. Fill in idea, target length, style guide, and optional sources.
2. Click **Run** to start a pipeline run.
3. Watch streaming logs and issues.
4. Use **Stop** or **Continue** to control runs.
5. Export the manuscript or report JSON with the buttons.

Runs persist to `/data/runs/<run_id>/` with:

- `inputs.json`
- `outline.md`
- `chapters/<i>.md`
- `manuscript.md`
- `book_bible.json`
- `issues_<iteration>.json`
- `logs.ndjson`
- `report.json`

## LLM Adapter Architecture

Adapters live in `/lib/llm` and conform to the `LLMAdapter` interface (`generate` + `stream`).

To add a new provider:

1. Create a new adapter in `/lib/llm/<provider>.ts` implementing the interface.
2. Update `createLLMAdapter` in `/lib/llm/index.ts` to select your adapter.
3. Ensure the adapter reads credentials from environment variables.

## Notes

- Validators emit structured issues only (no rewriting).
- The revision stage is the only editor.
- Citations validator is active only when sources are provided.
- URLs are treated as text placeholders; no web fetching is performed.
