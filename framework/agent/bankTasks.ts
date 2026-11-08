// The plain bank tasks an AI agent is given in Phase 2 (Q4). Each has a set-up
// done through the bank's API, the task in plain words, and a check of the
// end state through the API afterwards. The agent's word is never the check.
// The bank is clean: no planted bug is switched on.

import { assert, fact } from "../fixtures/resultBlock.js";
import { toDollars } from "../helpers/bank.js";
import type { ApiAccount, BankApi } from "../helpers/bankApi.js";
import type { AgentRun } from "./claudeAgent.js";

// What a task's set-up hands to its prompt and its check.
export interface TaskContext {
  checking: ApiAccount;
  savings: ApiAccount;
  [key: string]: unknown;
}

// One task.
export interface BankTask {
  id: string;
  title: string;
  setup(api: BankApi): Promise<TaskContext>;
  task(context: TaskContext): string;
  verify(api: BankApi, context: TaskContext, run: AgentRun): Promise<void>;
}

// The two starter accounts every new customer has.
async function starterAccounts(api: BankApi): Promise<TaskContext> {
  return {
    checking: await api.account("Checking"),
    savings: await api.account("Savings"),
  };
}

// "2026-11-08" plus `days`, as YYYY-MM-DD.
function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// Move $25.00 from Checking to Savings.
export const TRANSFER_OWN: BankTask = {
  id: "transfer-own",
  title: "agent: move $25.00 from Checking to Savings",
  setup: starterAccounts,
  task: () => "Move $25.00 from your Checking account to your Savings account.",
  async verify(api, context) {
    const checking = await api.account("Checking");
    const savings = await api.account("Savings");
    fact(
      "checking",
      `${toDollars(context.checking.balanceCents)} -> ${toDollars(checking.balanceCents)}`,
    );
    fact(
      "savings",
      `${toDollars(context.savings.balanceCents)} -> ${toDollars(savings.balanceCents)}`,
    );
    assert(
      checking.balanceCents === context.checking.balanceCents - 2500 &&
        savings.balanceCents === context.savings.balanceCents + 2500,
      "the balances did not move by exactly $25.00",
      "agent",
    );
  },
};

// Add a payee.
export const ADD_PAYEE: BankTask = {
  id: "add-payee",
  title: "agent: add the payee City Water (WTR-4471)",
  setup: starterAccounts,
  task: () =>
    'Add a new payee called "City Water" with the reference "WTR-4471".',
  async verify(api) {
    const payees = await api.payees();
    fact(
      "payees",
      payees.map((item) => `${item.name} (${item.reference})`).join(", ") ||
        "(none)",
    );
    assert(
      payees.some(
        (item) => item.name === "City Water" && item.reference === "WTR-4471",
      ),
      "no payee City Water with reference WTR-4471",
      "agent",
    );
  },
};

// Change the display currency.
export const CURRENCY_EUR: BankTask = {
  id: "currency-eur",
  title: "agent: change the display currency to EUR",
  setup: starterAccounts,
  task: () =>
    "In your settings, change your display currency to EUR (euro) and save it.",
  async verify(api) {
    const settings = await api.settings();
    fact("currency", String(settings.currency));
    assert(
      settings.currency === "EUR",
      `the currency is ${String(settings.currency)}`,
      "agent",
    );
  },
};

// Schedule a one-time bill payment to an existing payee.
export const SCHEDULE_BILL: BankTask = {
  id: "schedule-bill",
  title: "agent: schedule a one-time $40.00 bill to City Power",
  async setup(api) {
    const context = await starterAccounts(api);
    const payee = await api.addPayee("City Power", "PWR-1002");
    const due = addDays(await api.today(), 3);
    return { ...context, payeeId: payee.id, due };
  },
  task: (context) =>
    `Schedule a one-time bill payment of $40.00 to the payee "City Power" from your Checking account, due on ${String(context.due)} (YYYY-MM-DD).`,
  async verify(api, context) {
    const payments = await api.scheduledPayments();
    fact(
      "scheduled",
      payments
        .map(
          (item) =>
            `${toDollars(item.amountCents)} ${item.repeat} due ${item.nextDue}`,
        )
        .join(", ") || "(none)",
    );
    assert(
      payments.some(
        (item) =>
          item.payeeId === context.payeeId &&
          item.accountId === context.checking.id &&
          item.amountCents === 4000 &&
          item.repeat === "once" &&
          item.nextDue === context.due,
      ),
      `no one-time $40.00 payment to City Power from Checking due ${String(context.due)}`,
      "agent",
    );
  },
};

// Read the three newest transactions on Checking.
export const READ_TRANSACTIONS: BankTask = {
  id: "read-transactions",
  title: "agent: read the three newest Checking transactions",
  async setup(api) {
    const context = await starterAccounts(api);
    // Three moves to Savings, oldest first: 11.11, then 22.22, then 33.33.
    for (const cents of [1111, 2222, 3333]) {
      await api.transfer(
        context.checking,
        context.savings.number,
        cents,
        "Vibium seed",
      );
    }
    return context;
  },
  task: () =>
    "What are the amounts of the three most recent transactions on your Checking account, newest first? Give them after DONE:, for example DONE: $1.00, $2.00, $3.00.",
  async verify(_api, _context, run) {
    const order = ["33.33", "22.22", "11.11"].map((amount) =>
      run.answer.indexOf(amount),
    );
    fact("expected", "33.33, 22.22, 11.11");
    assert(
      order.every((index) => index >= 0) &&
        order[0] < order[1] &&
        order[1] < order[2],
      `the answer was "${run.answer}"`,
      "agent",
    );
  },
};
