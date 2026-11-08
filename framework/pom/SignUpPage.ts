// The sign-up page (/app/signup): the form a new customer fills in.

import type { Page } from "vibium";
import { appUrl, tid, type Customer } from "../helpers/bank.js";

// The form's fields, by the name the bank gives them.
export type SignUpField =
  "fullName" | "email" | "password" | "confirmPassword" | "acceptTerms";

// What to type into the form. Fields left out stay empty; the terms box is
// ticked only when `acceptTerms` is true.
export interface SignUpForm {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  acceptTerms?: boolean;
}

export class SignUpPage {
  constructor(private readonly page: Page) {}

  // Open the form.
  async open(): Promise<void> {
    await this.page.go(appUrl("signup"));
  }

  // Sign up a customer: fill everything in, accept the terms and send it. The
  // bank signs the new customer in and opens their profile.
  async signUp(customer: Customer): Promise<void> {
    await this.fill({
      fullName: customer.fullName,
      email: customer.email,
      password: customer.password,
      confirmPassword: customer.password,
      acceptTerms: true,
    });
    await this.submit();
    await this.page.waitForURL("/app/profile");
  }

  // Type into the fields given, and tick the terms box if asked.
  async fill(form: SignUpForm): Promise<void> {
    const texts: Array<[SignUpField, string | undefined]> = [
      ["fullName", form.fullName],
      ["email", form.email],
      ["password", form.password],
      ["confirmPassword", form.confirmPassword],
    ];
    for (const [field, text] of texts) {
      if (text !== undefined) {
        await (await this.page.find(tid(`signup-${field}`))).fill(text);
      }
    }
    if (form.acceptTerms) {
      await (await this.page.find(tid("signup-acceptTerms"))).check();
    }
  }

  // Press "Create account".
  async submit(): Promise<void> {
    await (await this.page.find(tid("signup-submit"))).click();
  }

  // The error shown under one field. Waits for it to appear.
  async fieldError(field: SignUpField): Promise<string> {
    return (await this.page.find(tid(`signup-${field}-error`))).text();
  }

  // The error from the bank itself, such as an email that is taken.
  async formError(): Promise<string> {
    return (await this.page.find(tid("signup-error"))).text();
  }

  // Follow the "Log in" link under the form.
  async goToLogin(): Promise<void> {
    await (await this.page.find(tid("signup-login-link"))).click();
    await this.page.waitForURL("/app/login");
  }
}
