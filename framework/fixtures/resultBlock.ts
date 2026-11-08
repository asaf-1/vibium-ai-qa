// The [RESULT] block: one plain-text summary printed after every test or script
// run, in the same shape as Agents-Playground's. It lists each Vibium action and
// each bank API call the run made, the facts the test added, and on a failure
// what to blame. Headers, cookies, bodies and typed text are never printed.
//
// Runs one test at a time: the record below belongs to the test running now.

import { appendFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// What a failed run is blamed on.
export type FailureCause = "vibium" | "agent" | "bank" | "harness";

// An error that carries what to blame.
export class BlamedError extends Error {
  constructor(
    message: string,
    readonly blame: FailureCause,
  ) {
    super(message);
    this.name = "BlamedError";
  }
}

// The record of the test running now.
interface RunRecord {
  test: string;
  spec: string;
  expected: string;
  calls: string[];
  facts: Array<[string, string]>;
}

let current: RunRecord | null = null;

// Query parameters with names like these print as stars.
const SECRET_NAME = /token|key|secret|pass|session|auth|cookie|sig|code/i;

// Vibium methods whose arguments are never printed.
const HIDDEN_ARGS = /cookie|storage|header/i;

// What the test expects, in one line.
export function expected(text: string): void {
  if (current) current.expected = text;
}

// A business fact for the block: an ID, an amount, a customer, a file.
export function fact(label: string, value: string | number): void {
  current?.facts.push([label, String(value)]);
}

// Fails the run, blaming `cause`, when the condition is false.
export function assert(
  condition: unknown,
  message: string,
  cause: FailureCause,
): asserts condition {
  if (!condition) throw new BlamedError(message, cause);
}

// Wraps a Vibium object so every method call is recorded. Objects it returns
// (a browser, a page, an element) are wrapped too. Always `await` a call:
// the wrapped methods return plain promises, not Vibium's chainable ones.
export function recorded<T extends object>(
  target: T,
  label = labelOf(target),
): T {
  return new Proxy(target, {
    get(obj, prop) {
      const value: unknown = Reflect.get(obj, prop, obj);
      // Properties and symbol keys pass through untouched.
      if (typeof value !== "function" || typeof prop === "symbol") return value;
      return (...args: unknown[]) => {
        const what = `${label}.${prop}(${describeArgs(prop, args)})`;
        // Call the real method on the real object.
        let result: unknown;
        try {
          result = value.apply(obj, args);
        } catch (error) {
          throw failed(what, error);
        }
        // Async methods are recorded when they settle; sync ones straight away.
        if (isThenable(result)) {
          return Promise.resolve(result).then(
            (settled) => done(what, settled),
            (error: unknown) => {
              throw failed(what, error);
            },
          );
        }
        return done(what, result);
      };
    },
  });
}

// A fetch to the bank, recorded as "METHOD /path -> status". Only the method,
// the path and the status are kept: never headers or bodies.
export async function bankFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const safe = new URL(safeUrl(url));
  const what = `${method} ${safe.pathname}${safe.search}`;
  try {
    const response = await fetch(url, init);
    record(`${what} -> ${response.status}`);
    return response;
  } catch (error) {
    // No answer at all: the bank is down or unreachable.
    record(`${what} -> ERROR ${clip(errorMessage(error))}`);
    throw new BlamedError(
      `the bank did not answer ${what}: ${errorMessage(error)}`,
      "bank",
    );
  }
}

// How a test ended: passed or not, on a failure what it was blamed on, and
// the facts it recorded (for run.json and summaries).
export interface Outcome {
  passed: boolean;
  cause?: FailureCause;
  facts: Record<string, string>;
}

// Adds a line to the calls list from outside Vibium, such as a tool call an
// AI agent made. The caller must already have removed anything secret.
export function note(line: string): void {
  record(line);
}

// Runs one test: starts its record, runs it, prints the block, and appends the
// block to <runDir>/result.txt. `spec` is the spec's file:line; without it,
// the caller's line is used.
export async function runTest(
  name: string,
  body: () => Promise<void>,
  options: { runDir: string; spec?: string },
): Promise<Outcome> {
  const run: RunRecord = {
    test: name,
    spec: options.spec ?? callerLocation(),
    expected: "",
    calls: [],
    facts: [],
  };
  current = run;

  // Run the test; a failure keeps its message and what to blame.
  let status: "PASSED" | "FAILED" = "PASSED";
  let cause: FailureCause | undefined;
  let error: string | undefined;
  try {
    await body();
  } catch (thrown) {
    status = "FAILED";
    cause = thrown instanceof BlamedError ? thrown.blame : "harness";
    error = errorMessage(thrown);
  } finally {
    current = null;
  }

  // Print the block, and keep a copy with the run's other files.
  const block = render(run, status, cause, error);
  console.log(block);
  await mkdir(options.runDir, { recursive: true });
  await appendFile(join(options.runDir, "result.txt"), `${block}\n`);
  return {
    passed: status === "PASSED",
    cause,
    facts: Object.fromEntries(run.facts),
  };
}

// The block itself, row by row.
function render(
  run: RunRecord,
  status: string,
  cause: FailureCause | undefined,
  error: string | undefined,
): string {
  const row = (label: string, value: string) =>
    `  ${label.padEnd(10)}: ${value}`;
  const lines = [
    "================ [RESULT] ================",
    row("test", run.test),
    row("spec", run.spec),
    row("status", status),
  ];
  if (cause) lines.push(row("cause", cause));
  if (error) lines.push(row("error", clip(error, 160)));
  lines.push(
    row("expected", run.expected || "-"),
    row("calls", String(run.calls.length)),
  );
  run.calls.forEach((call, index) => lines.push(`     ${index + 1}. ${call}`));
  for (const [label, value] of run.facts) lines.push(row(label, value));
  lines.push("==========================================");
  return lines.join("\n");
}

// Adds one line to the calls list of the test running now.
function record(line: string): void {
  current?.calls.push(line);
}

// Records a call that finished, and wraps the Vibium objects it returned,
// including each element in a list from findAll.
function done(what: string, result: unknown): unknown {
  record(`${what} -> ${describe(result)}`);
  if (Array.isArray(result)) {
    return result.map((item) => (isApiObject(item) ? recorded(item) : item));
  }
  return isApiObject(result) ? recorded(result) : result;
}

// Records a call that failed. An error from Vibium is blamed on Vibium,
// unless it already says what to blame.
function failed(what: string, error: unknown): BlamedError {
  record(`${what} -> ERROR ${clip(errorMessage(error))}`);
  return error instanceof BlamedError
    ? error
    : new BlamedError(errorMessage(error), "vibium");
}

// A short, safe description of what a call returned.
function describe(value: unknown): string {
  if (value === undefined) return "ok";
  if (value instanceof Uint8Array) return `<${value.byteLength} bytes>`;
  if (typeof value === "string") return JSON.stringify(clip(value));
  if (Array.isArray(value)) return `<${value.length} items>`;
  if (isApiObject(value)) return labelOf(value);
  return clip(JSON.stringify(value) ?? String(value));
}

// A short, safe description of a call's arguments. Typed text shows only its
// length; cookie, storage and header arguments are hidden.
function describeArgs(method: string, args: unknown[]): string {
  if (method === "fill" || method === "type") {
    return args.length > 0 ? `<${String(args[0]).length} chars>` : "";
  }
  if (HIDDEN_ARGS.test(method)) return "<hidden>";
  return args
    .map((arg) =>
      typeof arg === "string"
        ? JSON.stringify(clip(safeUrl(arg)))
        : clip(JSON.stringify(arg) ?? String(arg)),
    )
    .join(", ");
}

// A URL with secret-looking query values replaced by stars. Text that is not
// a URL comes back unchanged.
function safeUrl(text: string): string {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return text;
  }
  for (const name of [...url.searchParams.keys()]) {
    if (SECRET_NAME.test(name)) url.searchParams.set(name, "***");
  }
  return url.href;
}

// The first line outside the fixtures that led here, as a repo-relative
// file:line: the spec line that declared the test.
export function callerLocation(): string {
  for (const line of (new Error().stack ?? "").split("\n").slice(1)) {
    const match = line.match(/\(?((?:file:\/\/\/)?[^()\s]+?):(\d+):\d+\)?$/);
    if (!match) continue;
    const file = match[1].startsWith("file:")
      ? fileURLToPath(match[1])
      : match[1];
    // Skip the fixtures themselves and Node's own frames.
    if (
      /[\\/]framework[\\/]fixtures[\\/]/.test(file) ||
      file.startsWith("node:")
    ) {
      continue;
    }
    return `${relative(process.cwd(), file).replaceAll("\\", "/")}:${match[2]}`;
  }
  return "unknown";
}

// Vibium's classes (Browser, Page, Element…) get recorded; plain data does not.
function isApiObject(value: unknown): value is object {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Uint8Array) &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype
  );
}

// True for promises and Vibium's chainable promise-like objects.
function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

// "browser", "page", "element": the lower-cased class name, without the
// leading underscore Vibium's bundled classes carry (_Page → page).
function labelOf(value: object): string {
  return (value.constructor?.name ?? "object").replace(/^_+/, "").toLowerCase();
}

// An error's message, with the network code when Node gives one.
function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error.cause as { code?: string } | undefined)?.code;
  return code ? `${error.message} (${code})` : error.message;
}

// Text cut to `max` characters.
function clip(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
