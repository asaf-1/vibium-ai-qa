// Signing up: the form refuses what the bank's rules refuse (empty fields, a
// weak password, passwords that differ, an email already taken), and its
// "Log in" link leads to the login page.

import {
  assert,
  expected,
  fact,
  test,
} from "../../../framework/fixtures/vibiumTest.js";
import { newCustomer } from "../../../framework/helpers/bank.js";
import { signedInCustomer } from "../../../framework/helpers/session.js";
import { AccountMenu } from "../../../framework/pom/AccountMenu.js";
import { SignUpPage } from "../../../framework/pom/SignUpPage.js";

// The bank checks "the passwords match" only once the rest of the form is
// valid, so an empty form shows no error under Confirm password.
test("signup: an empty form shows an error on every required field", async ({
  page,
}) => {
  expected("an error under full name, email, password and the terms box");
  const signUp = new SignUpPage(page);
  await signUp.open();
  await signUp.submit();
  for (const field of [
    "fullName",
    "email",
    "password",
    "acceptTerms",
  ] as const) {
    fact(field, await signUp.fieldError(field));
  }
});

test("signup: a password without a number is refused", async ({ page }) => {
  expected("the password field shows the password rule");
  const customer = newCustomer();
  const signUp = new SignUpPage(page);
  await signUp.open();
  await signUp.fill({
    fullName: customer.fullName,
    email: customer.email,
    password: "only-letters",
    confirmPassword: "only-letters",
    acceptTerms: true,
  });
  await signUp.submit();
  fact("password error", await signUp.fieldError("password"));
});

test("signup: passwords that don't match are refused", async ({ page }) => {
  expected("the confirm field says the passwords don't match");
  const customer = newCustomer();
  const signUp = new SignUpPage(page);
  await signUp.open();
  await signUp.fill({
    fullName: customer.fullName,
    email: customer.email,
    password: customer.password,
    confirmPassword: `${customer.password}x`,
    acceptTerms: true,
  });
  await signUp.submit();
  const message = await signUp.fieldError("confirmPassword");
  fact("confirm error", message);
  assert(/match/i.test(message), `the message was "${message}"`, "bank");
});

test("signup: an email that already has an account is refused", async ({
  page,
}) => {
  expected(
    "the bank refuses a second account for the same email, and says why",
  );

  // The first account, then sign out.
  const customer = await signedInCustomer(page);
  await new AccountMenu(page).signOut();

  // The same email again.
  const signUp = new SignUpPage(page);
  await signUp.open();
  await signUp.fill({
    fullName: "Second Try",
    email: customer.email,
    password: customer.password,
    confirmPassword: customer.password,
    acceptTerms: true,
  });
  await signUp.submit();
  const message = await signUp.formError();
  fact("message", message);
  assert(/already/i.test(message), `the message was "${message}"`, "bank");
});

test("signup: the 'Log in' link opens the login page", async ({ page }) => {
  expected("the link leads to /app/login");
  const signUp = new SignUpPage(page);
  await signUp.open();
  await signUp.goToLogin();
  fact("now at", await page.url());
});
