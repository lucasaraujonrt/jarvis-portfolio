import { randomUUID } from "node:crypto";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { RpcPeer } from "../../codex-adapter/src/rpc-peer.ts";
import { approvalDetail, executionInstructions, imageBlock, record, string, type TerminalAgent, type TurnInput, type TurnResult } from "./types.ts";
import { readSession, saveSession, spawnAgent, stopAgent, type AgentOptions } from "./process.ts";

export class GrokAgent implements TerminalAgent {
  readonly #options: AgentOptions;
  #child: ChildProcessWithoutNullStreams | undefined;
  #peer: RpcPeer | undefined;
  #busy = false;

  constructor(options: AgentOptions) { this.#options = options; }

  async sendTurn(input: TurnInput): Promise<TurnResult> {
    if (this.#busy) throw new Error("Grok already has an active turn");
    input.signal?.throwIfAborted();
    this.#busy = true;
    const abort = () => this.close();
    input.signal?.addEventListener("abort", abort, { once: true });
    try {
      const saved = await readSession(this.#options);
      input.signal?.throwIfAborted();
      const child = (this.#options.spawnProcess ?? spawnAgent)(this.#options.command, ["agent", "--no-leader", "stdio"], this.#options.cwd);
      this.#child = child;
      const peer = new RpcPeer(child.stdout, child.stdin, true);
      this.#peer = peer;
      child.once("error", () => peer.close(new Error("Grok CLI unavailable; check its executable path")));
      child.once("exit", () => peer.close(new Error("Grok CLI exited")));
      const initialized = record(await peer.request("initialize", {
        protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: "jarvis", version: "0.2.0" },
      }));
      if (saved && !record(initialized.agentCapabilities).loadSession) throw new Error("Grok CLI does not support resuming this session");
      const session = record(await peer.request(saved ? "session/load" : "session/new", {
        ...(saved ? { sessionId: saved } : {}), cwd: this.#options.cwd, mcpServers: [],
        _meta: { yoloMode: false, autoMode: false, rules: executionInstructions },
      }));
      const sessionId = saved ?? string(session.sessionId);
      if (!sessionId) throw new Error("Grok did not return a session ID");
      await saveSession(this.#options, sessionId);
      input.signal?.throwIfAborted();
      let text = "";
      let deltaCount = 0;
      peer.onNotification((message) => {
        const params = record(message.params);
        if (message.method !== "session/update" || params.sessionId !== sessionId) return;
        const update = record(params.update);
        if (update.sessionUpdate === "agent_message_chunk") {
          const delta = string(record(update.content).text);
          text += delta;
          deltaCount += 1;
          input.onDelta?.(delta);
        } else if (update.sessionUpdate === "tool_call" || update.sessionUpdate === "tool_call_update") {
          input.onActivity?.(string(update.title) || `Ferramenta: ${string(update.status)}`);
        }
      });
      peer.onRequest(async (message) => {
        const params = record(message.params);
        if (message.method !== "session/request_permission" || params.sessionId !== sessionId) throw new Error("Unsupported request");
        const options = Array.isArray(params.options) ? params.options.map(record) : [];
        const allow = options.find((option) => option.kind === "allow_once" && typeof option.optionId === "string");
        if (!allow || input.signal?.aborted) return { outcome: { outcome: "cancelled" } };
        const approved = await input.onApproval?.({
          title: string(record(params.toolCall).title) || "Autorizar ação do Grok",
          detail: approvalDetail(params.toolCall),
        }) ?? false;
        return { outcome: approved && !input.signal?.aborted
          ? { outcome: "selected", optionId: allow.optionId }
          : { outcome: "cancelled" } };
      });
      const prompt: unknown[] = [{ type: "text", text: input.message }];
      if (input.imageDataUrl) {
        if (!record(record(initialized.agentCapabilities).promptCapabilities).image) throw new Error("Grok CLI does not support image prompts");
        prompt.push({ type: "image", ...imageBlock(input.imageDataUrl) });
      }
      const result = record(await peer.request("session/prompt", { sessionId, prompt }));
      if (result.stopReason !== "end_turn") throw new Error(`Grok stopped: ${string(result.stopReason) || "unknown"}`);
      return { threadId: sessionId, turnId: randomUUID(), text, deltaCount };
    } finally {
      input.signal?.removeEventListener("abort", abort);
      this.close();
      this.#busy = false;
    }
  }

  async interrupt(): Promise<void> { this.close(); }

  close(): void {
    this.#peer?.close(new Error("Grok session closed"));
    if (this.#child) stopAgent(this.#child);
    this.#peer = undefined;
    this.#child = undefined;
  }
}
