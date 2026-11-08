// Phase 2 (Q4): can an AI agent do real bank tasks with only Vibium's tools?
// Each test gives one plain task to a fresh Claude Code (Vibium MCP only, in
// an empty folder) and checks the end state through the bank's API.
// Run with `npm run agent`. It uses the Claude plan, so it is not part of
// `npm test`.

import {
  ADD_PAYEE,
  CURRENCY_EUR,
  READ_TRANSACTIONS,
  SCHEDULE_BILL,
  TRANSFER_OWN,
} from "../../framework/agent/bankTasks.js";
import { agentTest } from "../../framework/fixtures/agentTest.js";

agentTest(TRANSFER_OWN);
agentTest(ADD_PAYEE);
agentTest(CURRENCY_EUR);
agentTest(SCHEDULE_BILL);
agentTest(READ_TRANSACTIONS);
