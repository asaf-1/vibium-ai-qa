// The bank overview (/app/bank): the customer's accounts and balances, or a
// sign-in prompt for a visitor who is signed out.

import type { Page } from "vibium";
import { appUrl, tid, toCents, type Account } from "../helpers/bank.js";

// Every account card's data-testid starts with this.
const CARD = "bank-account-card-";

export class BankPage {
  constructor(private readonly page: Page) {}

  // Open the overview.
  async open(): Promise<void> {
    await this.page.go(appUrl("bank"));
  }

  // Wait for the signed-out view: the bank asks the visitor to log in.
  async expectSignedOut(): Promise<void> {
    await this.page.find(tid("signin-prompt"));
  }

  // Read every account card: its id, name and balance. Waits for the cards,
  // which appear once the bank has loaded the accounts.
  async accounts(): Promise<Account[]> {
    await this.page.find(`[data-testid^="${CARD}"]`);
    const cards = await this.page.findAll(`[data-testid^="${CARD}"]`);
    const accounts: Account[] = [];
    for (const card of cards) {
      const id = String(await card.attr("data-testid")).slice(CARD.length);
      // Each part by its own page-wide test id. Vibium 26.8.21's find() inside
      // an element does not search that element (card 2 got card 1's text),
      // so card.find() is not used.
      const name = await this.text(`account-name-${id}`);
      const balance = await this.text(`account-balance-${id}`);
      accounts.push({ id, name: name.trim(), balanceCents: toCents(balance) });
    }
    return accounts;
  }

  // The total balance across all accounts, in cents.
  async totalCents(): Promise<number> {
    return toCents(await this.text("bank-total"));
  }

  // The text of the element with this test id.
  private async text(testId: string): Promise<string> {
    return (await this.page.find(tid(testId))).text();
  }
}
