# vibium-ai-qa

**What is [Vibium](https://github.com/VibiumDev/vibium) worth for AI-driven QA?**
This repo measures it on a real site instead of assuming.

The test ground is **Playground Bank**, a practice bank from
[Agents-Playground](https://github.com/asaf-1/Agents-Playground). This repo
only runs that site and tests it like any visitor. It never changes it.

## Ground rules

- **Vibium only.** No Playwright and no other browser tool in this repo.
- **Free only.** No paid APIs or services.
- **Agents-Playground is never changed.** It is started and tested over HTTP,
  nothing more.

## What you need

- Windows, macOS or Linux, with **Node.js 22 or newer**.
- **Agents-Playground**, cloned next to this repo, to run the bank locally.

## Setup

Clone both repos side by side, then install each one:

```powershell
git clone https://github.com/asaf-1/Agents-Playground.git
git clone https://github.com/asaf-1/vibium-ai-qa.git
cd Agents-Playground; npm install; cd ..
cd vibium-ai-qa; npm install
```

`npm install` also downloads Vibium's own Chrome for Testing. Settings come
from `.env` if you create one; copy `.env.example` to start. Without it, the
defaults point at the local bank.

## Run the smoke test

1. Start the bank in its own terminal and leave it running:

   ```powershell
   cd Agents-Playground
   npm start
   ```

2. In this repo, run:

   ```powershell
   npm run smoke
   ```

The smoke test checks that the bank answers, opens it with Vibium, checks the
page title and takes a screenshot. It takes about 2 seconds, and exits with 0
when it passes or 1 when it fails.

## The bank flow

```powershell
npm run flow
```

A new customer signs up, signs out, signs back in, and moves a random amount
($1.00–$99.99) from Checking to Savings. The balances are then checked on a
fresh bank page and again after a reload. It takes about 4.5 seconds.

`npm run reliability` runs the same flow 20 times in a row, each run in its
own process, and prints the pass rate, the median and slowest times, and what
each failure was blamed on. `npm run reliability -- 5` runs it five times.

## All the tests

`npm test` runs every spec once: **41 tests, about 75 seconds**, one at a time.

| Area     | Spec                                           | Tests | What they check                                                                                                            |
| -------- | ---------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------- |
| Smoke    | `tests/e2e/sanity/smoke.spec.ts`               | 1     | The bank answers and Vibium opens it                                                                                       |
| Login    | `tests/e2e/auth/login.spec.ts`                 | 4     | Wrong password, unknown email, empty form, the link to sign-up                                                             |
| Sign-up  | `tests/e2e/auth/signup.spec.ts`                | 5     | Empty form, weak password, passwords that differ, an email already taken, the link to login                                |
| Bank     | `tests/e2e/bank/overview.spec.ts`              | 2     | Signed-out visitors are asked to log in; a new customer's two accounts add up to the total                                 |
| Transfer | `tests/e2e/bank/transfer-form.spec.ts`         | 5     | Empty amount, more than the balance, the sending account isn't offered as the destination, Back, "Make another transfer"   |
| Flow     | `tests/e2e/bank/transfer-own-accounts.spec.ts` | 1     | The whole journey, with the balances re-checked after a reload                                                             |
| Locators | `tests/e2e/locators/find-without-css.spec.ts`  | 23    | Each finds a bank element by its label, text, placeholder or role, and checks it landed on the same element as its test id |

## The [RESULT] block

Every test and script prints one block when it finishes: what it expected,
every Vibium action and bank call it made, and the result.

```text
================ [RESULT] ================
  test      : smoke: the bank opens in Vibium and shows its title
  spec      : tests/e2e/sanity/smoke.spec.ts:14
  status    : PASSED
  expected  : health 200, a page title with "Playground Bank", a screenshot saved
  calls     : 8
     1. GET /api/health -> 200
     2. vibium.start({"headless":true}) -> browser
     3. browser.page() -> page
     4. page.setViewport({"width":1280,"height":900}) -> ok
     5. page.go("http://127.0.0.1:4173/app/") -> ok
     6. page.title() -> "Playground Bank · Agents Playground"
     7. page.screenshot() -> <154433 bytes>
     8. browser.stop() -> ok
  title     : Playground Bank · Agents Playground
  screenshot: artifacts/smoke-the-bank-opens-in-vibium-and-shows-2026-11-08T09-10-02-739Z/home.png
==========================================
```

When a run fails, the block adds a `cause` row saying what to blame:
`vibium`, `bank`, `agent` or `harness` (this repo's own code). A bank that is
down is never counted as a Vibium failure. A Vibium call that times out
waiting for an element is blamed on `vibium` by default, so each one is
checked by hand before it counts against Vibium. The block never prints
headers, cookies, request bodies or anything typed into a field.

Each run also saves files under its own run id:

| Where                        | What                                                |
| ---------------------------- | --------------------------------------------------- |
| `reports/<runId>/result.txt` | The block                                           |
| `reports/<runId>/run.json`   | Test, spec, Vibium and Node versions, times, status |
| `reports/reliability-*/`     | `summary.md`: the reliability numbers and every run |
| `artifacts/<runId>/`         | Screenshots                                         |

Both folders are gitignored.

## Vibium with an AI agent (MCP)

`.mcp.json` gives Claude Code Vibium's browser tools (`vibium mcp`, pinned to
26.8.21). Start Claude Code in this folder and it can open the bank, click
and read pages through Vibium. `.codex/config.toml` does the same for Codex.

### The agent tests

```powershell
npm run agent
```

Each test gives one plain bank task to a **fresh Claude Code** and checks the
result itself:

1. **The agent gets nothing else.** It starts in an empty folder outside this
   repo, with only Vibium's MCP tools: built-in tools are off, apart from
   ToolSearch, which loads Vibium's tools.
2. **It works from the task alone.** It gets the bank's address, a test
   customer to sign in with, and the task in plain words, such as "Move
   $25.00 from your Checking account to your Savings account".
3. **The result is checked independently.** The bank's API, in a session of
   its own, confirms the end state. The agent's own "DONE" is never the
   check.

The `[RESULT]` block lists every tool call the agent made (typed text shows
only its length), plus its model, Vibium calls, tool errors, turns and
minutes. The full transcript is saved as `artifacts/<runId>/agent.jsonl`.
These tests run on your Claude plan, not a paid API key, so they are not
part of `npm test`.

## What's in the repo

`tests/` holds specs only. Everything they use lives in `framework/`.

| Path                                | What                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `tests/e2e/`                        | The specs, by area (see "All the tests")                                                      |
| `tests/agent/bank-tasks.spec.ts`    | The agent tests: 5 bank tasks for Claude Code with Vibium's tools                             |
| `framework/fixtures/vibiumTest.ts`  | `test()`: checks the bank, gives the spec a recorded Vibium page, closes it, writes the block |
| `framework/fixtures/agentTest.ts`   | `agentTest(task)`: sets a task up, runs the agent, checks the result through the API          |
| `framework/agent/claudeAgent.ts`    | Runs a fresh Claude Code with only Vibium's MCP tools, and records its tool calls             |
| `framework/agent/bankTasks.ts`      | The 5 tasks: set-up, the task in plain words, and the check                                   |
| `framework/helpers/bankApi.ts`      | The bank's API as one customer, used to set up and check                                      |
| `framework/fixtures/resultBlock.ts` | The `[RESULT]` block: records every Vibium and bank call                                      |
| `framework/pom/`                    | Page objects: `SignUpPage`, `LoginPage`, `AccountMenu`, `BankPage`, `TransferPage`            |
| `framework/helpers/bank.ts`         | Test customers, addresses, money as text and cents                                            |
| `framework/helpers/session.ts`      | A brand-new customer, signed up and signed in                                                 |
| `framework/reporting/runInfo.ts`    | Run ids, folders and `run.json`                                                               |
| `framework/config.ts`               | Settings from `.env`, with the defaults from `.env.example`                                   |
| `scripts/reliability.ts`            | Runs the bank flow 20 times and sums it up                                                    |
| `obsidian-vault/AGENT_MEMORY.md`    | The project's long-term notes                                                                 |

Specs run on Node's built-in test runner (`node:test`, through `tsx`). Every
spec imports `test` from `framework/fixtures/vibiumTest.ts`, so none can skip
the `[RESULT]` block.

## Commands

| Command               | What                                         |
| --------------------- | -------------------------------------------- |
| `npm test`            | Run every spec once (41 tests)               |
| `npm run smoke`       | Run the smoke test                           |
| `npm run flow`        | Run the bank flow                            |
| `npm run reliability` | Run the bank flow 20 times (`-- 5` for five) |
| `npm run agent`       | The 5 agent tests (uses your Claude plan)    |
| `npm run typecheck`   | Check the TypeScript                         |
| `npx vibium --help`   | Vibium's own CLI (68 commands in 26.8.21)    |

## Findings so far

| What                                            | Result                                                                                                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Setup on Windows                                | Vibium and its Chrome installed first time                                                                                                                                                                               |
| The bank flow, 20 runs in a row                 | **20 of 20 passed**, median 4.4 s, slowest 5.2 s                                                                                                                                                                         |
| `find()` inside an element (26.8.21)            | **Broken.** On a page with two cards, `cards[1].find("span")` returned the first card's text, and even `page.find(cardB).find("span")` did. The page objects avoid it by finding each part by its own page-wide test id. |
| Finding an element from a plain description     | Not in 26.8.21. Exact finds by text, role, label, placeholder and test id are there.                                                                                                                                     |
| Finding elements without CSS (23 bank elements) | **23 of 23 landed on the right element**, as long as the description was unique on the page. Plain text "Log in" first matched the page heading, not the button; role + text picked the button.                          |
| How Vibium matches                              | `text` and `placeholder`: exact. `label`: part of the label, case-sensitive (lowercase "password" found "Confirm password"). `role` + `text` together work. A label wrapped around its input with no `for` isn't found.  |
| Blame checks                                    | Five failures on the way were blamed on `vibium` but were this repo's own mistakes, so every Vibium-blamed failure is checked by hand.                                                                                   |
| `find --help`                                   | Lists `--all`, but `find role button --all` is refused. `--all` works only with CSS.                                                                                                                                     |
| Default window                                  | Small, about 780×485. The fixture sets 1280×900.                                                                                                                                                                         |

## Agent results (Claude Code with only Vibium's tools)

Three runs of the 5 agent tests on 2026-11-08, with `claude-sonnet-5`. Two
failures in the second run are left out, because the test's own prompt was at
fault: a full stop after the password was typed as part of it. That is fixed.

| Task                                 | Passed     | Minutes (each pass)              | Vibium calls |
| ------------------------------------ | ---------- | -------------------------------- | ------------ |
| Move $25.00 from Checking to Savings | 1 of 2     | 2.7 (one ran out of time at 6.0) | 55–56        |
| Add the payee City Water             | 1 of 1     | 3.5                              | 39           |
| Change the display currency to EUR   | 2 of 2     | 2.2, 1.9                         | 28–35        |
| Schedule a one-time $40.00 bill      | 2 of 2     | 3.9, 2.3                         | 46–63        |
| Read the three newest transactions   | 2 of 2     | 2.7, 1.1                         | 20–47        |
| **All**                              | **8 of 9** | median 2.5                       |              |

- **No false "done".** Every time the agent said DONE, the bank's API
  confirmed it.
- **How the miss happened:** the one miss was a timeout, after the agent
  guessed a wrong page address and spent time on screenshots and pauses.
- **Failed tool calls:** 41 of 470 (9%), and the agent recovered from them.
  The common ones:
  - looking for a "Log in" button the home page doesn't show (14);
  - Playwright-style selectors that Vibium's `selector` doesn't accept
    (`:has-text()`, `text=`, `>>`), about 8;
  - small input slips, such as a ref without its `@`.
- **How long it takes depends on the run:** the same transfer took 2.7
  minutes once and timed out the next time.

## Status

Done: phase 1 (the setup, 41 tests, the 20-run reliability count) and
phase 2 (Claude Code doing 5 bank tasks with only Vibium's MCP tools: 8 of 9
fair attempts passed). Next: a blind bug hunt, where the agent looks for
planted bugs without being told about them, scored against clean control
runs. It all ends in a written verdict on what Vibium is worth.
