// Settings for every script and test: read from .env when there is one, with
// the same defaults as .env.example, so nothing needs setting to run locally.

// Load .env if it exists; without one, the defaults below apply.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: nothing to load.
}

// The bank to test: the local copy unless .env says otherwise.
export const TARGET_URL = process.env.TARGET_URL ?? "http://127.0.0.1:4173/app";

// The browser runs without a window unless HEADLESS=false.
export const HEADLESS = process.env.HEADLESS !== "false";

// Where reports (run.json, result.txt) and pictures go. Both are gitignored.
export const REPORT_DIR = process.env.REPORT_DIR ?? "reports";
export const ARTIFACT_DIR = process.env.ARTIFACT_DIR ?? "artifacts";
