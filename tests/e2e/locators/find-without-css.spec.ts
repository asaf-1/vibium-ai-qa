// Q3, finding elements without CSS: for each bank element, Vibium finds it by
// what a person sees (its label, text, placeholder or role) and the test
// checks that it landed on the same element as the bank's own data-testid.
// One test per element and locator, so the pass count is the Q3 score.

import type { Page } from "vibium";
import {
  assert,
  expected,
  fact,
  test,
} from "../../../framework/fixtures/vibiumTest.js";
import { tid } from "../../../framework/helpers/bank.js";
import { signedInCustomer } from "../../../framework/helpers/session.js";
import { LoginPage } from "../../../framework/pom/LoginPage.js";
import { SignUpPage } from "../../../framework/pom/SignUpPage.js";
import { TransferPage } from "../../../framework/pom/TransferPage.js";

// A way to find an element without CSS.
interface By {
  role?: string;
  text?: string;
  label?: string;
  placeholder?: string;
}

// One element to find: the page it is on, its test id, and how to find it.
interface Target {
  where: "login" | "signup" | "transfer";
  testId: string;
  by: By;
}

// The elements. Each description is unique on its page, so landing anywhere
// else is a miss.
const TARGETS: Target[] = [
  // The login page.
  { where: "login", testId: "login-email", by: { label: "Email" } },
  { where: "login", testId: "login-password", by: { label: "Password" } },
  // (Plain text "Log in" is not unique here: the page heading says it too,
  // and comes first. Role + text picks the button.)
  {
    where: "login",
    testId: "login-submit",
    by: { role: "button", text: "Log in" },
  },
  {
    where: "login",
    testId: "login-signup-link",
    by: { text: "Create an account" },
  },
  {
    where: "login",
    testId: "login-signup-link",
    by: { role: "link", text: "Create an account" },
  },
  {
    where: "login",
    testId: "account-menu-trigger",
    by: { label: "Account menu" },
  },
  // The sign-up page.
  { where: "signup", testId: "signup-fullName", by: { label: "Full name" } },
  { where: "signup", testId: "signup-email", by: { label: "Email" } },
  { where: "signup", testId: "signup-password", by: { label: "Password" } },
  {
    where: "signup",
    testId: "signup-confirmPassword",
    by: { label: "Confirm password" },
  },
  { where: "signup", testId: "signup-acceptTerms", by: { role: "checkbox" } },
  {
    where: "signup",
    testId: "signup-acceptTerms",
    by: { label: "I understand Playground Bank is a practice site" },
  },
  {
    where: "signup",
    testId: "signup-submit",
    by: { role: "button", text: "Create account" },
  },
  { where: "signup", testId: "signup-login-link", by: { text: "Log in" } },
  // The transfer form, for a signed-in customer.
  { where: "transfer", testId: "transfer-from", by: { label: "From" } },
  {
    where: "transfer",
    testId: "transfer-to-account",
    by: { label: "Account to send to" },
  },
  { where: "transfer", testId: "transfer-amount", by: { label: "Amount" } },
  {
    where: "transfer",
    testId: "transfer-amount",
    by: { placeholder: "250.00" },
  },
  {
    where: "transfer",
    testId: "transfer-memo",
    by: { label: "Memo (optional)" },
  },
  {
    where: "transfer",
    testId: "transfer-memo",
    by: { placeholder: "Rent, savings, a gift…" },
  },
  {
    where: "transfer",
    testId: "transfer-to-own",
    by: { role: "button", text: "My accounts" },
  },
  {
    where: "transfer",
    testId: "transfer-to-other",
    by: { text: "Another customer" },
  },
  {
    where: "transfer",
    testId: "transfer-review",
    by: { role: "button", text: "Review transfer" },
  },
];

// 'label "Email"', 'role button + text "Log in"': how a locator reads.
function describe(by: By): string {
  return Object.entries(by)
    .map(([kind, value]) =>
      kind === "role" ? `role ${value}` : `${kind} "${value}"`,
    )
    .join(" + ");
}

// Open the page a target is on; the transfer form needs a customer first.
async function openPage(page: Page, where: Target["where"]): Promise<void> {
  if (where === "login") return new LoginPage(page).open();
  if (where === "signup") return new SignUpPage(page).open();
  await signedInCustomer(page);
  await new TransferPage(page).open();
}

for (const target of TARGETS) {
  test(`locator: ${target.testId} by ${describe(target.by)}`, async ({
    page,
  }) => {
    expected(
      `${describe(target.by)} lands on [data-testid="${target.testId}"]`,
    );
    await openPage(page, target.where);

    // The element by its test id first, so a miss can't be a wrong page.
    await page.find(tid(target.testId));

    // The same element found without CSS, and where it really landed.
    const found = await page.find(target.by, { timeout: 5000 });
    const hit = await found.attr("data-testid");
    fact("landed on", hit ?? "an element with no test id");
    assert(
      hit === target.testId,
      `${describe(target.by)} landed on ${hit ?? "an element with no test id"}`,
      "vibium",
    );
  });
}
