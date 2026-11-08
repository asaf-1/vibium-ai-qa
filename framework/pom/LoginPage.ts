// The login page (/app/login): an existing customer signs in.

import type { Page } from "vibium";
import { appUrl, tid, type Customer } from "../helpers/bank.js";

export class LoginPage {
  constructor(private readonly page: Page) {}

  // Open the login form.
  async open(): Promise<void> {
    await this.page.go(appUrl("login"));
  }

  // Sign in with the customer's email and password. The bank opens the profile.
  async signIn(customer: Customer): Promise<void> {
    await this.submitWith(customer.email, customer.password);
    await this.page.waitForURL("/app/profile");
  }

  // Type an email and a password (either may be empty) and press "Log in".
  async submitWith(email: string, password: string): Promise<void> {
    if (email) await (await this.page.find(tid("login-email"))).fill(email);
    if (password) {
      await (await this.page.find(tid("login-password"))).fill(password);
    }
    await (await this.page.find(tid("login-submit"))).click();
  }

  // The bank's answer when it refuses the login, such as a wrong password.
  async error(): Promise<string> {
    return (await this.page.find(tid("login-error"))).text();
  }

  // The error shown under the email or the password field.
  async fieldError(field: "email" | "password"): Promise<string> {
    return (await this.page.find(tid(`login-${field}-error`))).text();
  }

  // Follow the "Create an account" link.
  async goToSignUp(): Promise<void> {
    await (await this.page.find(tid("login-signup-link"))).click();
    await this.page.waitForURL("/app/signup");
  }
}
