// What every run writes next to its [RESULT] block: a run id, its folders,
// and run.json with the target, the versions, the times and how it ended.

import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { ARTIFACT_DIR, HEADLESS, REPORT_DIR, TARGET_URL } from "../config.js";

// A run's id and folders: the report in reports/, pictures in artifacts/.
export function newRun(kind: string): {
  runId: string;
  runDir: string;
  artifactDir: string;
  startedAt: Date;
} {
  const startedAt = new Date();
  const runId = `${kind}-${startedAt.toISOString().replace(/[:.]/g, "-")}`;
  return {
    runId,
    runDir: join(REPORT_DIR, runId),
    artifactDir: join(ARTIFACT_DIR, runId),
    startedAt,
  };
}

// The installed Vibium version, read from its own package.json.
export function vibiumVersion(): string {
  const entry = createRequire(import.meta.url).resolve("vibium");
  const pkg = JSON.parse(
    readFileSync(join(dirname(entry), "..", "package.json"), "utf8"),
  );
  return String(pkg.version);
}

// run.json: what was tested, with which versions, when, and how it ended.
// `extra` adds a run's own numbers, such as a reliability summary.
export async function writeRunJson(
  run: { runId: string; runDir: string; startedAt: Date },
  passed: boolean,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const info = {
    runId: run.runId,
    target: TARGET_URL,
    vibium: vibiumVersion(),
    node: process.version,
    headless: HEADLESS,
    startedAt: run.startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    status: passed ? "PASSED" : "FAILED",
    ...extra,
  };
  await mkdir(run.runDir, { recursive: true });
  await writeFile(
    join(run.runDir, "run.json"),
    `${JSON.stringify(info, null, 2)}\n`,
  );
}
