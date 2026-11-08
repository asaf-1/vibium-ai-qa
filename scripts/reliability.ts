// Q2, reliability: runs the transfer spec several times in a row (20 unless a
// number is given), each in its own process exactly as `npm run flow` does,
// then reports the pass rate, the median and slowest test times, and what
// each failure was blamed on. Every run prints its own [RESULT] block; the
// summary is printed last and saved as summary.md.
// Exit code 0 when every run passed, 1 otherwise.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FailureCause } from "../framework/fixtures/resultBlock.js";
import {
  newRun,
  vibiumVersion,
  writeRunJson,
} from "../framework/reporting/runInfo.js";

// The spec under test, and how many runs: `npm run reliability -- 5` runs five.
const SPEC = "tests/e2e/bank/transfer-own-accounts.spec.ts";
const runs = Number(process.argv[2] ?? 20);
if (!Number.isInteger(runs) || runs < 1) {
  throw new Error(
    `the number of runs must be a whole number, got "${process.argv[2]}"`,
  );
}

// One run of the spec: each gets its own report folder inside this run's.
interface RunResult {
  run: number;
  passed: boolean;
  cause?: FailureCause;
  ms: number;
}
const run = newRun("reliability");
const results: RunResult[] = [];
for (let index = 1; index <= runs; index += 1) {
  const folder = join(run.runDir, `run-${String(index).padStart(2, "0")}`);
  console.log(`\n--- run ${index} of ${runs} ---`);
  spawnSync(`npx tsx --test "${SPEC}"`, {
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      REPORT_DIR: folder,
      ARTIFACT_DIR: join(run.artifactDir, `run-${index}`),
    },
  });
  results.push({ run: index, ...readOutcome(folder) });
}

// How a spec run ended, read from the run.json its fixture wrote. No run.json
// means the run broke before the test finished: blamed on this repo's code.
function readOutcome(folder: string): Omit<RunResult, "run"> {
  const testDir = existsSync(folder) ? readdirSync(folder)[0] : undefined;
  const file = testDir ? join(folder, testDir, "run.json") : "";
  if (!file || !existsSync(file))
    return { passed: false, cause: "harness", ms: 0 };
  const info = JSON.parse(readFileSync(file, "utf8"));
  return {
    passed: info.status === "PASSED",
    ...(info.cause ? { cause: info.cause } : {}),
    ms: Date.parse(info.finishedAt) - Date.parse(info.startedAt),
  };
}

// The numbers: passes, pass rate, median and slowest time, causes of failure.
const passedRuns = results.filter((result) => result.passed).length;
const times = results.map((result) => result.ms).sort((a, b) => a - b);
const middle = Math.floor(times.length / 2);
const medianMs =
  times.length % 2
    ? times[middle]
    : Math.round((times[middle - 1] + times[middle]) / 2);
const slowestMs = times[times.length - 1];
const causes: Partial<Record<FailureCause, number>> = {};
for (const result of results) {
  if (result.cause) causes[result.cause] = (causes[result.cause] ?? 0) + 1;
}
const passRate = Math.round((passedRuns / runs) * 1000) / 10;
const causeText =
  Object.entries(causes)
    .map(([cause, count]) => `${cause} ${count}`)
    .join(", ") || "none";

// The summary, printed and saved as summary.md with a line per run.
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const summary = [
  "============== [RELIABILITY] =============",
  `  spec      : ${SPEC}`,
  `  runs      : ${runs}`,
  `  passed    : ${passedRuns} (${passRate}%)`,
  `  median    : ${seconds(medianMs)}`,
  `  slowest   : ${seconds(slowestMs)}`,
  `  failures  : ${causeText}`,
  `  vibium    : ${vibiumVersion()}`,
  "==========================================",
].join("\n");
console.log(`\n${summary}`);
const table = results
  .map(
    (result) =>
      `| ${result.run} | ${result.passed ? "PASSED" : "FAILED"} | ${seconds(result.ms)} | ${result.cause ?? "-"} |`,
  )
  .join("\n");
await writeFile(
  join(run.runDir, "summary.md"),
  `# Reliability: ${run.runId}\n\n\`\`\`text\n${summary}\n\`\`\`\n\n| Run | Status | Time | Cause |\n|---|---|---|---|\n${table}\n`,
);
await writeRunJson(run, passedRuns === runs, {
  spec: SPEC,
  runs,
  passedRuns,
  passRate,
  medianMs,
  slowestMs,
  causes,
});

// 0 when every run passed, 1 otherwise.
process.exitCode = passedRuns === runs ? 0 : 1;
