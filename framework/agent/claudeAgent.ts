// Runs one task with a fresh Claude Code that has only Vibium's MCP tools.
// Each run gets an empty folder outside this repo, so the agent can't read
// the plan or the bank's code. Built-in tools are off, apart from ToolSearch,
// which loads Vibium's tools once the server is up. It runs on the user's
// Claude plan, not a paid API key.
//
// Every tool call the agent makes is written into the [RESULT] block (typed
// text shows only its length), and the full transcript is saved to
// <artifactDir>/agent.jsonl.

import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { note } from "../fixtures/resultBlock.js";

// What came back from one agent run.
export interface AgentRun {
  claim: "DONE" | "FAILED" | "NONE";
  answer: string;
  model: string;
  toolsOffered: number;
  vibiumCalls: number;
  otherCalls: number;
  toolErrors: number;
  turns: number;
  ms: number;
  timedOut: boolean;
}

// Tools whose typed text is never printed, only its length.
const TYPING_TOOL = /browser_(fill|type|keys)$/;

// Tools whose arguments are never printed at all.
const HIDDEN_TOOL = /cookie|storage/;

// Claude Code's own program: CLAUDE_BIN if set, else the global npm install.
function claudeBinary(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const root = execSync("npm root -g", { encoding: "utf8" }).trim();
  const exe = process.platform === "win32" ? "claude.exe" : "claude";
  return join(root, "@anthropic-ai", "claude-code", "bin", exe);
}

// The Vibium binary this repo installed, started directly: faster than npx,
// so its tools are ready when the agent starts.
function vibiumBinary(): string {
  const vibiumEntry = createRequire(import.meta.url).resolve("vibium");
  const exe = process.platform === "win32" ? "vibium.exe" : "vibium";
  const binary = join(
    dirname(vibiumEntry),
    "..",
    "..",
    "@vibium",
    `${process.platform}-${process.arch}`,
    "bin",
    exe,
  );
  if (!existsSync(binary)) throw new Error(`no Vibium binary at ${binary}`);
  return binary;
}

// A short, safe description of a tool call's input.
function describeInput(tool: string, input: Record<string, unknown>): string {
  if (HIDDEN_TOOL.test(tool)) return "<hidden>";
  const shown: Record<string, unknown> = { ...input };
  if (TYPING_TOOL.test(tool)) {
    for (const key of ["text", "value", "keys"]) {
      if (typeof shown[key] === "string") {
        shown[key] = `<${(shown[key] as string).length} chars>`;
      }
    }
  }
  const text = JSON.stringify(shown);
  return text.length > 90 ? `${text.slice(0, 89)}…` : text;
}

// Run the agent on one prompt. The empty working folder and the MCP config
// are made here; the transcript goes to `artifactDir`.
export async function runAgent(
  prompt: string,
  artifactDir: string,
  timeoutMs = 6 * 60_000,
): Promise<AgentRun> {
  // An empty folder for this run, outside the repo, with a Vibium-only MCP config.
  const workDir = join(
    tmpdir(),
    "vibium-agent",
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  await mkdir(join(workDir, "shots"), { recursive: true });
  const mcpConfig = join(workDir, "mcp.json");
  await writeFile(
    mcpConfig,
    JSON.stringify({
      mcpServers: {
        vibium: {
          command: vibiumBinary(),
          args: [
            "mcp",
            "--headless",
            "--screenshot-dir",
            join(workDir, "shots"),
          ],
        },
      },
    }),
  );

  // Claude Code in print mode: only ToolSearch and Vibium, no saved session,
  // no user settings, and nothing outside the allowed tools.
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--verbose",
    "--mcp-config",
    mcpConfig,
    "--strict-mcp-config",
    "--tools",
    "ToolSearch",
    "--allowedTools",
    "mcp__vibium",
    "ToolSearch",
    "--permission-mode",
    "dontAsk",
    "--no-session-persistence",
    "--setting-sources",
    "project",
  ];
  const child = spawn(claudeBinary(), args, { cwd: workDir });
  child.stdin.end(prompt);

  // Read the stream: every tool call, its result, and the final answer.
  const run: AgentRun = {
    claim: "NONE",
    answer: "",
    model: "",
    toolsOffered: 0,
    vibiumCalls: 0,
    otherCalls: 0,
    toolErrors: 0,
    turns: 0,
    ms: 0,
    timedOut: false,
  };
  const pending = new Map<string, string>();
  const transcript: string[] = [];
  let buffer = "";
  const started = Date.now();
  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) handleLine(line);
  });

  // One line of the stream.
  function handleLine(line: string): void {
    if (!line.trim()) return;
    transcript.push(line);
    let event: Record<string, any>;
    try {
      event = JSON.parse(line);
    } catch {
      return;
    }
    // The start: the model, and how many tools the agent was given.
    if (event.type === "system" && event.subtype === "init") {
      run.model = String(event.model ?? "");
      run.toolsOffered = (event.tools ?? []).length;
    }
    // A tool call: remember it until its result comes back.
    if (event.type === "assistant") {
      for (const part of event.message?.content ?? []) {
        if (part.type !== "tool_use") continue;
        const tool = String(part.name).replace(/^mcp__vibium__/, "");
        if (String(part.name).startsWith("mcp__vibium__")) run.vibiumCalls += 1;
        else run.otherCalls += 1;
        pending.set(
          part.id,
          `agent> ${tool}(${describeInput(tool, part.input ?? {})})`,
        );
      }
    }
    // A tool result: write the call and how it ended into the block.
    if (event.type === "user") {
      for (const part of event.message?.content ?? []) {
        if (part.type !== "tool_result") continue;
        const call = pending.get(part.tool_use_id) ?? "agent> (unknown tool)";
        pending.delete(part.tool_use_id);
        if (part.is_error) run.toolErrors += 1;
        note(`${call} -> ${part.is_error ? "ERROR" : "ok"}`);
      }
    }
    // The end: the agent's answer and its numbers.
    if (event.type === "result") {
      const text = String(event.result ?? "").trim();
      const done = text.match(/DONE:\s*([\s\S]*)/i);
      const failed = text.match(/FAILED:\s*([\s\S]*)/i);
      run.claim = done ? "DONE" : failed ? "FAILED" : "NONE";
      run.answer = (done?.[1] ?? failed?.[1] ?? text).trim();
      run.turns = Number(event.num_turns ?? 0);
    }
  }

  // Wait for the agent to finish, or stop it at the time limit.
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      run.timedOut = true;
      child.kill();
    }, timeoutMs);
    child.on("close", () => {
      clearTimeout(timer);
      if (buffer) handleLine(buffer);
      resolve();
    });
  });
  run.ms = Date.now() - started;

  // Keep the full transcript with the run's other files.
  await mkdir(artifactDir, { recursive: true });
  await writeFile(
    join(artifactDir, "agent.jsonl"),
    `${transcript.join("\n")}\n`,
  );
  return run;
}
