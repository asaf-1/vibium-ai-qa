// The bank overview: a signed-out visitor is asked to log in, and a new
// customer starts with a Checking and a Savings account whose balances add up
// to the total shown.

import {
  assert,
  expected,
  fact,
  test,
} from "../../../framework/fixtures/vibiumTest.js";
import { accountNamed, toDollars } from "../../../framework/helpers/bank.js";
import { signedInCustomer } from "../../../framework/helpers/session.js";
import { BankPage } from "../../../framework/pom/BankPage.js";

test("bank: a signed-out visitor is asked to log in", async ({ page }) => {
  expected("the sign-in prompt instead of any accounts");
  const bank = new BankPage(page);
  await bank.open();
  await bank.expectSignedOut();
});

test("bank: a new customer has Checking and Savings, and the total is their sum", async ({
  page,
}) => {
  expected(
    "two accounts, Checking and Savings, both funded, adding up to the total",
  );
  await signedInCustomer(page);
  const bank = new BankPage(page);
  await bank.open();

  // The accounts and the total, as the page shows them.
  const accounts = await bank.accounts();
  const checking = accountNamed(accounts, "Checking");
  const savings = accountNamed(accounts, "Savings");
  const total = await bank.totalCents();
  fact("accounts", accounts.length);
  fact("checking", toDollars(checking.balanceCents));
  fact("savings", toDollars(savings.balanceCents));
  fact("total", toDollars(total));

  // Exactly the two starter accounts, both with money, summing to the total.
  assert(
    accounts.length === 2,
    `the page showed ${accounts.length} accounts`,
    "bank",
  );
  assert(
    checking.balanceCents > 0 && savings.balanceCents > 0,
    "a starter account was empty",
    "bank",
  );
  assert(
    checking.balanceCents + savings.balanceCents === total,
    `Checking + Savings = ${toDollars(checking.balanceCents + savings.balanceCents)}, but the total said ${toDollars(total)}`,
    "bank",
  );
});
