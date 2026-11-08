// The transfer form's rules and buttons: an empty amount and more than the
// account holds are refused before any money moves; the sending account is
// never offered as the destination; Back keeps what was typed; "Make another
// transfer" starts over.

import type { Page } from "vibium";
import {
  assert,
  expected,
  fact,
  test,
} from "../../../framework/fixtures/vibiumTest.js";
import {
  accountNamed,
  toDollars,
  type Account,
} from "../../../framework/helpers/bank.js";
import { signedInCustomer } from "../../../framework/helpers/session.js";
import { BankPage } from "../../../framework/pom/BankPage.js";
import { TransferPage } from "../../../framework/pom/TransferPage.js";

// A new customer on the transfer form, with their Checking and Savings.
async function readyToTransfer(
  page: Page,
): Promise<{ transfer: TransferPage; checking: Account; savings: Account }> {
  await signedInCustomer(page);
  const bank = new BankPage(page);
  await bank.open();
  const accounts = await bank.accounts();
  const transfer = new TransferPage(page);
  await transfer.open();
  return {
    transfer,
    checking: accountNamed(accounts, "Checking"),
    savings: accountNamed(accounts, "Savings"),
  };
}

test("transfer: an empty amount is refused", async ({ page }) => {
  expected("an error under the amount, and no summary");
  const { transfer, checking, savings } = await readyToTransfer(page);
  await transfer.fillOwn(checking, savings, "");
  await transfer.review();
  fact("amount error", await transfer.fieldError("amount"));
});

test("transfer: more than the account holds is refused", async ({ page }) => {
  expected("an error under the amount naming what Checking holds");
  const { transfer, checking, savings } = await readyToTransfer(page);
  const tooMuch = toDollars(checking.balanceCents + 100);
  fact("checking holds", toDollars(checking.balanceCents));
  fact("tried", tooMuch);
  await transfer.fillOwn(checking, savings, tooMuch);
  await transfer.review();
  const message = await transfer.fieldError("amount");
  fact("amount error", message);
  assert(/holds/i.test(message), `the message was "${message}"`, "bank");
});

test("transfer: the account sending is not offered as the account to send to", async ({
  page,
}) => {
  expected("with Checking as From, the To list has Savings and not Checking");
  const { transfer, checking, savings } = await readyToTransfer(page);
  await transfer.chooseFrom(checking);
  const offered = await transfer.toAccountChoices();
  fact("offered", offered.join(", ") || "(none)");
  assert(
    !offered.includes(checking.id),
    "Checking was offered as its own destination",
    "bank",
  );
  assert(offered.includes(savings.id), "Savings was not offered", "bank");
});

test("transfer: Back from the summary keeps the amount typed", async ({
  page,
}) => {
  expected(
    "the summary shows the amount, and after Back the form still holds it",
  );
  const { transfer, checking, savings } = await readyToTransfer(page);
  await transfer.fillOwn(checking, savings, "12.34");
  await transfer.review();
  const summary = await transfer.summaryAmountCents();
  fact("summary", toDollars(summary));
  assert(summary === 1234, `the summary showed ${toDollars(summary)}`, "bank");
  await transfer.back();
  const kept = await transfer.amountValue();
  fact("amount after Back", kept);
  assert(kept === "12.34", `the amount field held "${kept}"`, "bank");
});

test("transfer: 'Make another transfer' after a receipt starts an empty form", async ({
  page,
}) => {
  expected("after a completed transfer, the next form has an empty amount");
  const { transfer, checking, savings } = await readyToTransfer(page);
  fact(
    "receipt",
    await transfer.moveBetweenOwn(checking, savings, 500, "first one"),
  );
  await transfer.again();
  const amount = await transfer.amountValue();
  fact("amount on the new form", amount || "(empty)");
  assert(amount === "", `the amount field held "${amount}"`, "bank");
});
