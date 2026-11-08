// Smoke: the bank answers, Vibium opens it, and the page really is
// Playground Bank. A screenshot of what Vibium saw is saved with the run.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  assert,
  expected,
  fact,
  test,
} from "../../../framework/fixtures/vibiumTest.js";
import { appUrl } from "../../../framework/helpers/bank.js";

test("smoke: the bank opens in Vibium and shows its title", async ({
  page,
  artifactDir,
}) => {
  expected(
    'health 200, a page title with "Playground Bank", a screenshot saved',
  );

  // Open the bank and read the page title.
  await page.go(appUrl());
  const title = await page.title();
  fact("title", title);
  assert(
    title.includes("Playground Bank"),
    `the page title was "${title}"`,
    "bank",
  );

  // Keep a picture of what Vibium saw.
  const png = await page.screenshot();
  await mkdir(artifactDir, { recursive: true });
  const shot = join(artifactDir, "home.png");
  await writeFile(shot, png);
  fact("screenshot", shot.replaceAll("\\", "/"));
});
