// The fixture for agent specs (Phase 2, Q4). `agentTest(task)` declares a Node
// test that:
//   1. checks the bank answers;
//   2. registers a fresh customer through the API and sets the task up;
//   3. gives the task, in plain words, to a fresh Claude Code that has only
//      Vibium's tools (framework/agent/claudeAgent.ts);
//   4. checks the end state through the bank's API, never the agent's word;
//   5. prints the [RESULT] block, writes run.json, and adds a line to the
//      run's summary.md.

import { after, test as nodeTest } from "node:test";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { runAgent } from "../agent/claudeAgent.js";
import type { BankTask } from "../agent/bankTasks.js";
import { appUrl, apiUrl, newCustomer } from "../helpers/bank.js";
import { BankApi } from "../helpers/bankApi.js";
import { newRun, writeRunJson } from "../reporting/runInfo.js";
import {
  assert,
  bankFetch,
  callerLocation,
  expected,
  fact,
  runTest,
} from "./resultBlock.js";

// The rules every task prompt carries.
const RULES = [
  "Use only the Vibium browser tools and only the website above.",
  "Do not open any page under /app/practice, and do not switch on practice mode.",
  "Work the way a customer would, through the website's pages.",
  'When you are finished, reply with exactly one line: "DONE: <what you did, or the answer>" or "FAILED: <why>".',
].join("\n- ");

// One line per task for this run's summary, written when the spec ends.
const summary: string[] = [];
const summaryRun = newRun("agent");
after(async () => {
  if (summary.length === 0) return;
  await mkdir(summaryRun.runDir, { recursive: true });
  const table = [
    "| Task | Verified | Agent said | Vibium calls | Tool errors | Turns | Minutes | Model |",
    "|---|---|---|---|---|---|---|---|",
    ...summary,
  ].join("\n");
  await appendFile(
    join(summaryRun.runDir, "summary.md"),
    `# Agent tasks (Q4): ${summaryRun.runId}\n\n${table}\n`,
  );
  console.log(`\n${table}\n`);
});

// Declares one agent test. The spec's line is taken here.
export function agentTest(task: BankTask): void {
  const spec = callerLocation();
  nodeTest(task.title, async () => {
    const run = newRun(`agent-${task.id}`);
    let agentLine = "";
    const outcome = await runTest(
      task.title,
      async () => {
        expected(
          "the agent finishes the task, and the bank's API shows the result",
        );

        // The bank must answer first, so a bank that is down is never blamed on the agent.
        const health = await bankFetch(apiUrl("/api/health"));
        assert(
          health.ok,
          `the bank's health check answered ${health.status}`,
          "bank",
        );

        // A fresh customer, and the task's own set-up, through the API.
        const customer = newCustomer();
        fact("customer", customer.email);
        const api = await BankApi.register(customer);
        const context = await task.setup(api);

        // The task in plain words, for a fresh agent with only Vibium's tools.
        const prompt = [
          "You are using a bank website through the Vibium browser tools.",
          `Website: ${appUrl()}`,
          // Each on its own line, with nothing after it: a full stop after the
          // password was once typed as part of it.
          "Sign in with this test account.",
          `Email: ${customer.email}`,
          `Password: ${customer.password}`,
          `Your task: ${task.task(context)}`,
          `Rules:\n- ${RULES}`,
        ].join("\n");
        const agent = await runAgent(prompt, run.artifactDir);
        const minutes = (agent.ms / 60_000).toFixed(1);
        fact("model", agent.model || "unknown");
        // The agent may repeat the password in its answer: star it out.
        const said = agent.answer.split(customer.password).join("***");
        fact("agent said", `${agent.claim}: ${said.slice(0, 120)}`);
        fact("vibium calls", agent.vibiumCalls);
        fact("tool errors", agent.toolErrors);
        fact("turns", agent.turns);
        fact("minutes", minutes);
        agentLine = `| ${task.id} | %VERIFIED% | ${agent.claim} | ${agent.vibiumCalls} | ${agent.toolErrors} | ${agent.turns} | ${minutes} | ${agent.model} |`;
        assert(!agent.timedOut, "the agent ran out of time", "agent");
        assert(
          agent.toolsOffered > 0,
          "the agent was given no tools",
          "harness",
        );

        // The end state, through the API: this is the check, not the agent's word.
        await task.verify(api, context, agent);
      },
      { runDir: run.runDir, spec },
    );

    // run.json with the facts; a line for the summary; a failure fails the test.
    await writeRunJson(run, outcome.passed, {
      test: task.title,
      spec,
      ...(outcome.cause ? { cause: outcome.cause } : {}),
      facts: outcome.facts,
    });
    summary.push(
      (
        agentLine || `| ${task.id} | %VERIFIED% | - | - | - | - | - | - |`
      ).replace("%VERIFIED%", outcome.passed ? "yes" : `no (${outcome.cause})`),
    );
    if (!outcome.passed) {
      throw new Error(
        `FAILED, blamed on ${outcome.cause}: see the [RESULT] block above`,
      );
    }
  });
}
