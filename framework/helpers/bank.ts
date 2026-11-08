// Shared bank helpers: test customers, the app's addresses, money as text
// and as cents, and picking an account by name. No browser work here; the
// page objects in framework/pom do that.

import { TARGET_URL } from "../config.js";
import { assert } from "../fixtures/resultBlock.js";

// A test customer, with an address no other run has used.
export interface Customer {
  fullName: string;
  email: string;
  password: string;
}

// One of the customer's accounts, as the bank page shows it.
export interface Account {
  id: string;
  name: string;
  balanceCents: number;
}

// Every test customer's password. It only ever exists in the local bank.
const PASSWORD = "Vibium-flow-2026";

// A new customer on the @example.test domain, unique to this run.
export function newCustomer(): Customer {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    fullName: "Vibium Flow",
    email: `vibium-${stamp}@example.test`,
    password: PASSWORD,
  };
}

// A page of the bank's app: "signup" → http://127.0.0.1:4173/app/signup.
export function appUrl(path = ""): string {
  const base = TARGET_URL.endsWith("/") ? TARGET_URL : `${TARGET_URL}/`;
  return new URL(path, base).href;
}

// The bank's own address for an API path: "/api/health".
export function apiUrl(path: string): string {
  return new URL(path, TARGET_URL).href;
}

// The CSS selector for one of the bank's data-testid hooks.
export function tid(id: string): string {
  return `[data-testid="${id}"]`;
}

// "$12,345.67" → 1234567.
export function toCents(text: string): number {
  const amount = Number(text.replace(/[^0-9.-]/g, ""));
  assert(Number.isFinite(amount), `not an amount: "${text}"`, "harness");
  return Math.round(amount * 100);
}

// 1234 → "12.34", the way the transfer form takes an amount.
export function toDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

// A random amount between $1.00 and $99.99, in cents.
export function smallAmountCents(): number {
  return 100 + Math.floor(Math.random() * 9900);
}

// The account whose name includes `name`, such as "Checking".
export function accountNamed(accounts: Account[], name: string): Account {
  const account = accounts.find((item) => item.name.includes(name));
  assert(account, `no ${name} account on the bank page`, "bank");
  return account;
}
