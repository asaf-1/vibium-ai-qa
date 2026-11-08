// The transfer page (/app/bank/transfer): fill the form, check the summary,
// confirm, and read the receipt.

import type { Page } from "vibium";
import { assert } from "../fixtures/resultBlock.js";
import {
  appUrl,
  tid,
  toCents,
  toDollars,
  type Account,
} from "../helpers/bank.js";

// The form's fields that can show an error.
export type TransferField = "amount" | "to-account" | "memo";

export class TransferPage {
  constructor(private readonly page: Page) {}

  // Open the transfer form.
  async open(): Promise<void> {
    await this.page.go(appUrl("bank/transfer"));
  }

  // Move money between two of the customer's own accounts. The summary and
  // the receipt must both show the amount; returns the receipt's id.
  async moveBetweenOwn(
    from: Account,
    to: Account,
    amountCents: number,
    memo: string,
  ): Promise<string> {
    await this.fillOwn(from, to, toDollars(amountCents), memo);
    await this.review();

    // The summary must show the right amount before anything is confirmed.
    const summary = await this.text("summary-amount");
    assert(
      toCents(summary) === amountCents,
      `the summary showed ${summary}`,
      "bank",
    );
    await this.confirm();

    // The receipt: the amount moved, and its id.
    const moved = await this.text("receipt-amount");
    assert(
      toCents(moved) === amountCents,
      `the receipt showed ${moved}`,
      "bank",
    );
    return (await this.text("receipt-id")).trim();
  }

  // Fill the form for a move between own accounts. The amount is typed as
  // given ("12.34", or "" to leave it empty).
  async fillOwn(
    from: Account,
    to: Account,
    amount: string,
    memo = "",
  ): Promise<void> {
    await (await this.page.find(tid("transfer-from"))).selectOption(from.id);
    await (await this.page.find(tid("transfer-to-own"))).click();
    await (
      await this.page.find(tid("transfer-to-account"))
    ).selectOption(to.id);
    if (amount) {
      await (await this.page.find(tid("transfer-amount"))).fill(amount);
    }
    if (memo) await (await this.page.find(tid("transfer-memo"))).fill(memo);
  }

  // Pick the account to send from, and "My accounts" as the destination.
  async chooseFrom(from: Account): Promise<void> {
    await (await this.page.find(tid("transfer-from"))).selectOption(from.id);
    await (await this.page.find(tid("transfer-to-own"))).click();
  }

  // The account ids the "Account to send to" list offers, without its empty
  // "Choose an account" line. Read page-wide: Vibium 26.8.21's find() inside
  // an element doesn't search that element.
  async toAccountChoices(): Promise<string[]> {
    const options = await this.page.findAll(
      `${tid("transfer-to-account")} option`,
    );
    const values: string[] = [];
    for (const option of options) {
      const value = await option.attr("value");
      if (value) values.push(value);
    }
    return values;
  }

  // Press "Review transfer".
  async review(): Promise<void> {
    await (await this.page.find(tid("transfer-review"))).click();
  }

  // The amount the summary shows, in cents. Waits for the summary.
  async summaryAmountCents(): Promise<number> {
    return toCents(await this.text("summary-amount"));
  }

  // Go back from the summary to the form.
  async back(): Promise<void> {
    await (await this.page.find(tid("transfer-back"))).click();
    await this.page.find(tid("transfer-form"));
  }

  // Press "Confirm transfer".
  async confirm(): Promise<void> {
    await (await this.page.find(tid("transfer-confirm"))).click();
  }

  // From the receipt, start another transfer on a fresh form.
  async again(): Promise<void> {
    await (await this.page.find(tid("transfer-again"))).click();
    await this.page.find(tid("transfer-form"));
  }

  // What the amount field holds now.
  async amountValue(): Promise<string> {
    return (await this.page.find(tid("transfer-amount"))).value();
  }

  // The error shown under a field. Waits for it to appear.
  async fieldError(field: TransferField): Promise<string> {
    return this.text(`transfer-${field}-error`);
  }

  // The text of the element with this test id.
  private async text(testId: string): Promise<string> {
    return (await this.page.find(tid(testId))).text();
  }
}
