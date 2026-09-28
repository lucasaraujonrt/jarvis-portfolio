import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { approvalDetail, executionInstructions, imageBlock, record, string, type TerminalAgent, type TurnInput, type TurnResult } from "./types.ts";
import { readSession, saveSession, spawnAgent, stopAgent, type AgentOptions } from "./process.ts";

export class ClaudeAgent implements TerminalAgent {
  readonly #options: AgentOptions;
  #child: ChildProcessWithoutNullStreams | undefined;
  #fail: ((error: Error) => void) | undefined;
  #busy = false;

  constructor(options: AgentOptions) { this.#options = options; }

  async sendTurn(input: TurnInput): Promise<TurnResult> {
    if (this.#busy) throw new Error("Claude already has an active turn");
    input.signal?.throwIfAborted();
    this.#busy = true;
    let stateWrite: Promise<void> | undefined;
    const abort = () => this.close();
    input.signal?.addEventListener("abort", abort, { once: true });
    try {
      const saved = await readSession(this.#options);
      input.signal?.throwIfAborted();
      const args = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose",
        "--include-partial-messages", "--permission-mode", "default", "--permission-prompt-tool", "stdio",
        "--append-system-prompt", executionInstructions, ...(saved ? [`--resume=${saved}`] : [])];
      const child = (this.#options.spawnProcess ?? spawnAgent)(this.#options.command, args, this.#options.cwd);
      this.#child = child;
      const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
      const initializeId = randomUUID();
      const cancelled = new Set<string>();
      let sessionId = saved ?? "";
      let text = "";
      let deltaCount = 0;
      let prompted = false;
      const result = await new Promise<TurnResult>((resolve, reject) => {
        this.#fail = reject;
        const send = (value: unknown) => child.stdin.write(JSON.stringify(value) + "\n");
        const permission = async (message: Record<string, unknown>) => {
          const requestId = string(message.request_id);
          const request = record(message.request);
          let response: Record<string, unknown> = { behavior: "deny", message: "Jarvis denied this request" };
          if (request.subtype === "can_use_tool" && !input.signal?.aborted) {
            const approved = await input.onApproval?.({ title: string(request.tool_name) || "Autorizar ação do Claude", detail: approvalDetail(request.input) }) ?? false;
            if (approved && !input.signal?.aborted) response = { behavior: "allow", updatedInput: record(request.input) };
          }
          if (!cancelled.has(requestId) && this.#child === child) {
            send({ type: "control_response", response: { subtype: "success", request_id: requestId, response } });
          }
        };
        child.once("error", () => reject(new Error("Claude CLI unavailable; check its executable path")));
        child.stdin.on("error", () => reject(new Error("Claude input closed")));
        lines.once("close", () => reject(new Error("Claude closed without a result")));
        lines.on("line", (line) => {
          try {
            const message = record(JSON.parse(line));
            if (message.type === "control_request") { void permission(message).catch(reject); return; }
            if (message.type === "control_cancel_request") { cancelled.add(string(message.request_id)); return; }
            if (message.type === "control_response" && record(message.response).request_id === initializeId) {
              if (record(message.response).subtype !== "success") throw new Error("Claude initialization failed");
              if (prompted) return;
              prompted = true;
              const content: unknown[] = [{ type: "text", text: input.message }];
              if (input.imageDataUrl) {
                const image = imageBlock(input.imageDataUrl);
                content.push({ type: "image", source: { type: "base64", media_type: image.mimeType, data: image.data } });
              }
              send({ type: "user", session_id: "", message: { role: "user", content }, parent_tool_use_id: null });
            } else if (message.type === "system" && message.subtype === "init") {
              sessionId = string(message.session_id);
              if (sessionId) {
                stateWrite = saveSession(this.#options, sessionId);
                void stateWrite.catch(reject);
              }
            } else if (message.type === "stream_event") {
              const event = record(message.event);
              const delta = record(event.delta);
              if (event.type === "content_block_delta" && delta.type === "text_delta") {
                const part = string(delta.text);
                text += part; deltaCount += 1; input.onDelta?.(part);
              } else if (event.type === "content_block_start" && record(event.content_block).type === "tool_use") {
                input.onActivity?.(string(record(event.content_block).name) || "Executando ferramenta");
              }
            } else if (message.type === "result") {
              if (message.subtype !== "success" || message.is_error === true) throw new Error("Claude turn failed");
              sessionId = string(message.session_id) || sessionId;
              if (!sessionId) throw new Error("Claude returned no session ID");
              resolve({ threadId: sessionId, turnId: randomUUID(), text: string(message.result) || text, deltaCount });
            }
          } catch (error) { reject(error); }
        });
        send({ type: "control_request", request_id: initializeId, request: { subtype: "initialize", hooks: null } });
      });
      await (stateWrite ?? saveSession(this.#options, result.threadId));
      return result;
    } finally {
      input.signal?.removeEventListener("abort", abort);
      this.close();
      this.#busy = false;
      await stateWrite;
    }
  }

  async interrupt(): Promise<void> { this.close(); }

  close(): void {
    this.#fail?.(new Error("Claude session closed"));
    this.#fail = undefined;
    if (this.#child) stopAgent(this.#child);
    this.#child = undefined;
  }
}
