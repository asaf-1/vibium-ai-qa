// The bank's own API, as one customer, in a session of its own. The agent
// tests use it to set a task up and to check the result afterwards; it never
// touches the agent's browser. Every call goes through bankFetch, so it shows
// in the [RESULT] block as "METHOD /path -> status" and its cookie never does.

import { bankFetch, BlamedError } from "../fixtures/resultBlock.js";
import { apiUrl, type Customer } from "./bank.js";

// An account as the API returns it.
export interface ApiAccount {
  id: string;
  number: string;
  kind: string;
  name: string;
  balanceCents: number;
}

// A payee as the API returns it.
export interface ApiPayee {
  id: string;
  name: string;
  reference: string;
}

// A scheduled payment as the API returns it.
export interface ApiScheduledPayment {
  id: string;
  accountId: string;
  payeeId: string;
  amountCents: number;
  repeat: string;
  nextDue: string;
  status: string;
}

export class BankApi {
  // The session cookie, kept here and sent with every call.
  private cookie = "";

  // A new customer, registered (and so signed in) through the API.
  static async register(customer: Customer): Promise<BankApi> {
    const api = new BankApi();
    await api.send("POST", "/api/bank/register", {
      fullName: customer.fullName,
      email: customer.email,
      password: customer.password,
      acceptTerms: true,
    });
    return api;
  }

  // The customer's accounts.
  async accounts(): Promise<ApiAccount[]> {
    const body = await this.send("GET", "/api/bank/accounts");
    return body.accounts as ApiAccount[];
  }

  // The account whose name includes `name`, such as "Checking".
  async account(name: string): Promise<ApiAccount> {
    const account = (await this.accounts()).find((item) =>
      item.name.includes(name),
    );
    if (!account) throw new BlamedError(`no ${name} account`, "harness");
    return account;
  }

  // The customer's payees, and adding one.
  async payees(): Promise<ApiPayee[]> {
    return (await this.send("GET", "/api/bank/payees")).payees as ApiPayee[];
  }
  async addPayee(name: string, reference: string): Promise<ApiPayee> {
    return (await this.send("POST", "/api/bank/payees", { name, reference }))
      .payee as ApiPayee;
  }

  // The customer's settings (currency, locale, email choices).
  async settings(): Promise<Record<string, unknown>> {
    return (await this.send("GET", "/api/bank/me")).settings as Record<
      string,
      unknown
    >;
  }

  // The customer's own "today" on the bank's clock, as YYYY-MM-DD.
  async today(): Promise<string> {
    return String((await this.send("GET", "/api/bank/clock")).today);
  }

  // The customer's scheduled payments.
  async scheduledPayments(): Promise<ApiScheduledPayment[]> {
    return (await this.send("GET", "/api/bank/scheduled-payments"))
      .payments as ApiScheduledPayment[];
  }

  // Move money from one of the customer's accounts to an account number.
  async transfer(
    from: ApiAccount,
    toNumber: string,
    amountCents: number,
    memo: string,
  ): Promise<void> {
    await this.send("POST", "/api/bank/transfers", {
      fromAccountId: from.id,
      toAccountNumber: toNumber,
      amountCents,
      memo,
    });
  }

  // One API call with the session cookie. A refused call is blamed on this
  // repo's code: the harness asked for something the bank won't do.
  private async send(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    const response = await bankFetch(apiUrl(path), {
      method,
      headers: {
        "content-type": "application/json",
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    // Keep the session cookie the bank sets.
    const set = response.headers.getSetCookie();
    if (set.length > 0) {
      this.cookie = set.map((item) => item.split(";")[0]).join("; ");
    }
    if (!response.ok) {
      throw new BlamedError(
        `${method} ${path} answered ${response.status}`,
        "harness",
      );
    }
    return (await response.json()) as Record<string, unknown>;
  }
}
