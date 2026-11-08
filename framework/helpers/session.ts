// A brand-new customer, signed up through the form and signed in: the start
// of every test that needs a customer of its own.

import type { Page } from "vibium";
import { fact } from "../fixtures/resultBlock.js";
import { SignUpPage } from "../pom/SignUpPage.js";
import { newCustomer, type Customer } from "./bank.js";

// Sign up a new customer and leave them signed in, on their profile.
export async function signedInCustomer(page: Page): Promise<Customer> {
  const customer = newCustomer();
  fact("customer", customer.email);
  const signUp = new SignUpPage(page);
  await signUp.open();
  await signUp.signUp(customer);
  return customer;
}
