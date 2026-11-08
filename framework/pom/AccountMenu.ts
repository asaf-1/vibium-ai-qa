// The account menu in the top bar, on every page of the app.

import type { Page } from "vibium";
import { tid } from "../helpers/bank.js";

export class AccountMenu {
  constructor(private readonly page: Page) {}

  // Open the menu and log out, from a page that needs a signed-in customer
  // (such as the profile). Done once that page shows its sign-in prompt, so
  // the next step never races the logout call.
  async signOut(): Promise<void> {
    await (await this.page.find(tid("account-menu-trigger"))).click();
    await (await this.page.find(tid("account-menu-logout"))).click();
    await this.page.find(tid("signin-prompt"));
  }
}
