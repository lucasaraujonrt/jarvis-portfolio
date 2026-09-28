import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import { resolve } from "node:path";
import { CodexAppServerAdapter } from "../../../packages/codex-adapter/src/codex-app-server.ts";
import { ClaudeAgent } from "../../../packages/terminal-agents/src/claude.ts";
import { GrokAgent } from "../../../packages/terminal-agents/src/grok.ts";
import { createGateway } from "./gateway.ts";

const config = parseArgs(process.argv.slice(2));
const token = process.env.JARVIS_GATEWAY_TOKEN ?? "";
if (!token.trim()) throw new Error("JARVIS_GATEWAY_TOKEN is required for terminal execution");
const cwd = await realpath(config.workspace);
const workspaceId = createHash("sha256").update(cwd).digest("hex").slice(0, 20);
const state = (agent: string) => resolve(config.stateDir, workspaceId, `${agent}.json`);
const gateway = createGateway({
  token,
  agents: {
    codex: new CodexAppServerAdapter({ cwd, stateFile: config.stateFile ? resolve(config.stateFile) : state("codex"), command: process.env.JARVIS_CODEX_COMMAND ?? "codex", execution: true, turnTimeoutMs: 600_000 }),
    claude: new ClaudeAgent({ cwd, stateFile: state("claude"), command: process.env.JARVIS_CLAUDE_COMMAND ?? "claude" }),
    grok: new GrokAgent({ cwd, stateFile: state("grok"), command: process.env.JARVIS_GROK_COMMAND ?? "grok" }),
  },
});
gateway.server.listen(config.port, config.host, () => {
  console.log(JSON.stringify({ event: "gateway.listening", host: config.host, port: config.port, workspace: cwd }));
});
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => gateway.close());

function parseArgs(values: string[]) {
  const result = { host: "127.0.0.1", port: 4317, workspace: process.cwd(), stateDir: ".jarvis/agents", stateFile: "" };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[++index];
    if (!next) throw new Error(`Missing value for ${value}`);
    if (value === "--host") result.host = next;
    else if (value === "--port") result.port = Number(next);
    else if (value === "--workspace") result.workspace = next;
    else if (value === "--state-dir") result.stateDir = next;
    else if (value === "--state") result.stateFile = next;
    else throw new Error(`Unknown option: ${value}`);
  }
  if (!Number.isInteger(result.port) || result.port < 1 || result.port > 65535) throw new Error("Invalid port");
  return result;
}
