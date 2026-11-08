# Agent Memory

Long-term project memory for `vibium-ai-qa`. Every agent reads the
`Current State` section first. Session progress lives in `STATUS.md`, which is
private and gitignored. Only project facts go here.

## What this repo is

It measures what [Vibium](https://github.com/VibiumDev/vibium) is worth for
AI-driven QA. The test ground is Playground Bank, from the public
[Agents-Playground](https://github.com/asaf-1/Agents-Playground) repo.

- **Agents-Playground is never changed.** This repo runs it and tests it
  over HTTP, like any visitor.
- **No Playwright here.** The only browser tool is Vibium.
- **Free only:** no paid APIs or services.

## Current State

- **2026-11-07: repo set up.**
  - `vibium@26.8.21` pinned exactly, plus `typescript`, `tsx` and
    `@types/node`.
  - Vibium's MCP server is configured for Claude Code (`.mcp.json`) and
    Codex (`.codex/config.toml`).
  - The local bank (`http://127.0.0.1:4173/app`) is the default target; see
    `.env.example`.
  - The plans in `obsidian-vault/Plans/` are private (gitignored).
  - Git flow: a branch for each change, a PR into `main`, merge, then delete
    the branch.
- **2026-11-08: the test suite (phase 1).**
  - **Layout:** `tests/` holds specs only (`tests/e2e/<area>/*.spec.ts`), run
    by Node's built-in runner through `tsx --test`. Everything they use is in
    `framework/`: `fixtures/` (`vibiumTest.ts`, the `test()` fixture, and
    `resultBlock.ts`), `pom/` (page objects), `helpers/`, `reporting/` and
    `config.ts`.
  - **Every new spec:**
    - imports `test` from `framework/fixtures/vibiumTest.ts`, so every test
      prints a `[RESULT]` block, with a `cause` on failure;
    - has a short note above each block of code.
  - **The suite:** 41 tests, all passing (`npm test`).
    `npm run reliability` runs the bank flow 20 times; it passed 20 of 20.
  - **Vibium 26.8.21: `element.find()` does not search inside that
    element.** Page objects find each part by its own page-wide test id
    instead.
  - A failure blamed on `vibium` is checked by hand before it counts against
    Vibium.
