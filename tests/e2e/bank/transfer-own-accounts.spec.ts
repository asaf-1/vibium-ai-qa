// The scripted bank flow: a new customer signs up, signs out, signs back in,
// and moves money from Checking to Savings. The balances are checked on a
// fresh bank page and again after a reload.

import {
  assert,
  expected,
  fact,
  test,
} from "../../../framework/fixtures/vibiumTest.js";
import {
  accountNamed,
  newCustomer,
  smallAmountCents,
  toDollars,
  type Account,
} from "../../../framework/helpers/bank.js";
import { AccountMenu } from "../../../framework/pom/AccountMenu.js";
import { BankPage } from "../../../framework/pom/BankPage.js";
import { LoginPage } from "../../../framework/pom/LoginPage.js";
import { SignUpPage } from "../../../framework/pom/SignUpPage.js";
import { TransferPage } from "../../../framework/pom/TransferPage.js";

// Checking is down and Savings is up by exactly the amount moved.
function expectMoved(
  now: Account[],
  checking: Account,
  savings: Account,
  amountCents: number,
  where: string,
): void {
  const checkingNow = accountNamed(now, "Checking").balanceCents;
  const savingsNow = accountNamed(now, "Savings").balanceCents;
  assert(
    checkingNow === checking.balanceCents - amountCents,
    `Checking ${where} was ${toDollars(checkingNow)}, expected ${toDollars(checking.balanceCents - amountCents)}`,
    "bank",
  );
  assert(
    savingsNow === savings.balanceCents + amountCents,
    `Savings ${where} was ${toDollars(savingsNow)}, expected ${toDollars(savings.balanceCents + amountCents)}`,
    "bank",
  );
}

test("flow: sign up, sign in, move money between own accounts, re-check after reload", async ({
  page,
}) => {
  // A fresh customer and an amount between $1.00 and $99.99.
  const customer = newCustomer();
  const amountCents = smallAmountCents();
  expected(
    `Checking down and Savings up by ${toDollars(amountCents)}, on the bank page and after a reload`,
  );
  fact("customer", customer.email);
  fact("amount", toDollars(amountCents));

  // The pages this flow uses.
  const signUp = new SignUpPage(page);
  const menu = new AccountMenu(page);
  const login = new LoginPage(page);
  const bank = new BankPage(page);
  const transfer = new TransferPage(page);

  // Sign up, sign out (and see the signed-out bank), sign back in.
  await signUp.open();
  await signUp.signUp(customer);
  await menu.signOut();
  await bank.open();
  await bank.expectSignedOut();
  await login.open();
  await login.signIn(customer);

  // The balances before the move.
  await bank.open();
  const before = await bank.accounts();
  const checking = accountNamed(before, "Checking");
  const savings = accountNamed(before, "Savings");
  fact("checking", checking.id);
  fact("savings", savings.id);
  fact(
    "before",
    `Checking ${toDollars(checking.balanceCents)}, Savings ${toDollars(savings.balanceCents)}`,
  );

  // Move the money and keep the receipt's id.
  await transfer.open();
  const receipt = await transfer.moveBetweenOwn(
    checking,
    savings,
    amountCents,
    "Vibium flow",
  );
  fact("receipt", receipt);

  // The balances on a fresh bank page, then again after a reload.
  await bank.open();
  expectMoved(
    await bank.accounts(),
    checking,
    savings,
    amountCents,
    "on the bank page",
  );
  await page.reload();
  const after = await bank.accounts();
  expectMoved(after, checking, savings, amountCents, "after a reload");
  fact(
    "after",
    `Checking ${toDollars(accountNamed(after, "Checking").balanceCents)}, Savings ${toDollars(accountNamed(after, "Savings").balanceCents)}`,
  );
});
