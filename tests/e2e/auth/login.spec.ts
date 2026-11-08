// Logging in: a wrong password is refused, an empty form shows its field
// errors, and the "Create an account" link leads to sign-up.

import {
  assert,
  expected,
  fact,
  test,
} from "../../../framework/fixtures/vibiumTest.js";
import { newCustomer } from "../../../framework/helpers/bank.js";
import { signedInCustomer } from "../../../framework/helpers/session.js";
import { AccountMenu } from "../../../framework/pom/AccountMenu.js";
import { LoginPage } from "../../../framework/pom/LoginPage.js";

test("login: a wrong password is refused with a message", async ({ page }) => {
  expected("the bank refuses the login, says why, and stays on the login page");

  // A real customer, signed out again.
  const customer = await signedInCustomer(page);
  await new AccountMenu(page).signOut();

  // The right email with the wrong password.
  const login = new LoginPage(page);
  await login.open();
  await login.submitWith(customer.email, "Wrong-password-1");
  const message = await login.error();
  fact("message", message);
  assert(message.trim().length > 0, "the error message was empty", "bank");
  const url = await page.url();
  assert(url.includes("/app/login"), `the page moved to ${url}`, "bank");
});

test("login: an unknown email is refused with a message", async ({ page }) => {
  expected("the bank refuses an email it has never seen, and says why");
  const login = new LoginPage(page);
  await login.open();
  await login.submitWith(newCustomer().email, "Vibium-flow-2026");
  const message = await login.error();
  fact("message", message);
  assert(message.trim().length > 0, "the error message was empty", "bank");
});

test("login: an empty form shows an error under both fields", async ({
  page,
}) => {
  expected("an error under the email field and under the password field");
  const login = new LoginPage(page);
  await login.open();
  await login.submitWith("", "");
  fact("email error", await login.fieldError("email"));
  fact("password error", await login.fieldError("password"));
});

test("login: the 'Create an account' link opens sign-up", async ({ page }) => {
  expected("the link leads to /app/signup");
  const login = new LoginPage(page);
  await login.open();
  await login.goToSignUp();
  fact("now at", await page.url());
});
