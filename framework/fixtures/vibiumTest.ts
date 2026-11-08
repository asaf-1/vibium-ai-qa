// The test fixture every spec uses. `test(name, body)` declares a Node test
// whose body gets a recorded Vibium page. Around each test it:
//   1. checks the bank answers, so a bank that is down is blamed on the bank;
//   2. starts Vibium's browser at desktop size;
//   3. runs the body, and always closes the browser afterwards;
//   4. prints the [RESULT] block and writes run.json next to it.
// A failed block fails the Node test too. Specs import `test`, `expected`,
// `fact` and `assert` from here, so no spec can skip the block.

import { test as nodeTest } from "node:test";
import { browser, type Page } from "vibium";
import { HEADLESS } from "../config.js";
import { apiUrl } from "../helpers/bank.js";
import { newRun, writeRunJson } from "../reporting/runInfo.js";
import {
  assert,
  bankFetch,
  callerLocation,
  recorded,
  runTest,
} from "./resultBlock.js";

export { assert, expected, fact } from "./resultBlock.js";

// What each test body gets: the page, and a folder for its pictures.
export interface TestContext {
  page: Page;
  artifactDir: string;
}

// Extra settings for one test. `todo` marks a known Vibium limitation: the
// test still runs and prints its block, but a failure doesn't fail the run.
export interface TestOptions {
  todo?: string;
}

// Declares one test. The spec's line is taken here, where it is declared.
export function test(
  name: string,
  body: (context: TestContext) => Promise<void>,
  options: TestOptions = {},
): void {
  const spec = callerLocation();
  nodeTest(name, { todo: options.todo }, async () => {
    // This test's report folder (reports/) and picture folder (artifacts/).
    const run = newRun(slug(name));
    const outcome = await runTest(
      name,
      async () => {
        // The bank must answer first, so a bank that is down is never blamed on Vibium.
        const health = await bankFetch(apiUrl("/api/health"));
        assert(
          health.ok,
          `the bank's health check answered ${health.status}`,
          "bank",
        );

        // Vibium's browser, recorded so every step shows in the block.
        const bro = await recorded(browser, "vibium").start({
          headless: HEADLESS,
        });
        try {
          // A desktop-sized window, so the bank's top bar fits.
          const page = await bro.page();
          await page.setViewport({ width: 1280, height: 900 });
          await body({ page, artifactDir: run.artifactDir });
        } finally {
          // Always close the browser, pass or fail.
          await bro.stop();
        }
      },
      { runDir: run.runDir, spec },
    );

    // run.json next to the block; a failed block fails the Node test too.
    await writeRunJson(run, outcome.passed, {
      test: name,
      spec,
      ...(outcome.cause ? { cause: outcome.cause } : {}),
    });
    if (!outcome.passed) {
      throw new Error(
        `FAILED, blamed on ${outcome.cause}: see the [RESULT] block above`,
      );
    }
  });
}

// "smoke: the bank opens…" → "smoke-the-bank-opens", for folder names.
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-$/, "");
}
