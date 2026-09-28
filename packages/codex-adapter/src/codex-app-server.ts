import { spawn } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { RpcPeer, type RpcMessage } from "./rpc-peer.ts";
import { executionInstructions, record, string, approvalDetail, type TurnInput } from "../../terminal-agents/src/types.ts";
import { stopAgent } from "../../terminal-agents/src/process.ts";

interface AppServerProcess {
  stdin: Writable;
  stdout: Readable;
  once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
  kill(signal?: NodeJS.Signals): boolean;
}

interface ThreadResult {
  thread: { id: string };
}

interface TurnStartResult {
  turn: { id: string };
}

interface TurnCompletedParams {
  threadId: string;
  turn: { id: string; status: "completed" | "interrupted" | "failed"; error?: { message?: string } | null };
}

interface AgentDeltaParams {
  threadId: string;
  turnId: string;
  delta: string;
}

interface ItemCompletedParams {
  threadId: string;
  turnId: string;
  item: { type: string; text?: string; phase?: string };
}

interface PersistedState {
  version: 1;
  threadId: string;
  cwd?: string;
}

export interface AdapterLog {
  event: string;
  thread?: string;
  turn?: string;
  deltas?: number;
  durationMs?: number;
  reason?: string;
}

export interface SendTurnInput extends TurnInput {}

export interface SendTurnResult {
  threadId: string;
  turnId: string;
  text: string;
  deltaCount: number;
}

interface AdapterOptions {
  cwd: string;
  stateFile: string;
  command?: string;
  turnTimeoutMs?: number;
  execution?: boolean;
  processFactory?: () => AppServerProcess;
  log?: (entry: AdapterLog) => void;
}

const developerInstructions = [
  "You are Jarvis, a concise Portuguese conversational assistant.",
  "Answer the user's question directly using the supplied image when present.",
  "Do not call tools, run commands, edit files, or take external actions.",
  "Return conversational text suitable for text-to-speech.",
].join(" ");

export class CodexAppServerAdapter {
  readonly #options: Required<Pick<AdapterOptions, "cwd" | "stateFile" | "command" | "turnTimeoutMs">> &
    Pick<AdapterOptions, "processFactory" | "log" | "execution">;
  #process: AppServerProcess | undefined;
  #peer: RpcPeer | undefined;
  #threadId: string | undefined;
  #activeTurnId: string | undefined;
  #turnInFlight = false;
  #starting: Promise<void> | undefined;

  constructor(options: AdapterOptions) {
    this.#options = {
      ...options,
      command: options.command ?? "codex",
      turnTimeoutMs: options.turnTimeoutMs ?? 120_000,
    };
  }

  async start(): Promise<void> {
    if (this.#peer) return;
    if (this.#starting) return this.#starting;
    this.#starting = this.#startProcess();
    try {
      await this.#starting;
    } finally {
      this.#starting = undefined;
    }
  }

  async sendTurn(input: SendTurnInput): Promise<SendTurnResult> {
    if (this.#turnInFlight) throw new Error("Jarvis already has an active turn");
    if (!input.message.trim()) throw new Error("message must not be empty");
    input.signal?.throwIfAborted();
    this.#turnInFlight = true;
    const abort = () => this.close();
    input.signal?.addEventListener("abort", abort, { once: true });
    try {
      return await this.#performTurn(input);
    } finally {
      input.signal?.removeEventListener("abort", abort);
      this.#turnInFlight = false;
    }
  }

  async #performTurn(input: SendTurnInput): Promise<SendTurnResult> {
    await this.start();
    input.signal?.throwIfAborted();
    const peer = this.#requirePeer();
    const threadId = await this.#ensureThread();
    input.signal?.throwIfAborted();
    const startedAt = performance.now();
    let targetTurnId: string | undefined;
    let bufferedCompletion: TurnCompletedParams | undefined;
    let deltaText = "";
    let finalText = "";
    let deltaCount = 0;

    let complete: (params: TurnCompletedParams) => void = () => undefined;
    let fail: (error: Error) => void = () => undefined;
    const completion = new Promise<TurnCompletedParams>((resolve, reject) => {
      complete = resolve;
      fail = reject;
    });
    void completion.catch(() => undefined);
    const removeClose = peer.onClose(fail);
    const removeRequests = peer.onRequest(async (message) => {
      const params = record(message.params);
      if (!this.#options.execution || params.threadId !== threadId || input.signal?.aborted) {
        throw new Error("Inactive turn");
      }
      if (targetTurnId && params.turnId !== targetTurnId) throw new Error("Wrong turn");
      if (message.method !== "item/commandExecution/requestApproval" && message.method !== "item/fileChange/requestApproval") {
        throw new Error("Unsupported permission request");
      }
      const approved = await input.onApproval?.({
        title: message.method === "item/fileChange/requestApproval" ? "Alterar arquivos" : "Executar comando",
        detail: approvalDetail(params),
      }) ?? false;
      return { decision: approved && !input.signal?.aborted ? "accept" : "decline" };
    });

    const removeListener = peer.onNotification((notification) => {
      if (notification.method === "item/agentMessage/delta") {
        const params = notification.params as AgentDeltaParams;
        if (params.threadId !== threadId || (targetTurnId && params.turnId !== targetTurnId)) return;
        deltaCount += 1;
        deltaText += params.delta;
        input.onDelta?.(params.delta);
      } else if (notification.method === "item/started") {
        const params = record(notification.params);
        if (params.threadId !== threadId || (targetTurnId && params.turnId !== targetTurnId)) return;
        const item = record(params.item);
        if (item.type === "commandExecution") input.onActivity?.(string(item.command) || "Executando comando");
        else if (item.type === "fileChange") input.onActivity?.("Alterando arquivos");
        else if (item.type === "mcpToolCall") input.onActivity?.("Executando ferramenta");
      } else if (notification.method === "item/completed") {
        const params = notification.params as ItemCompletedParams;
        if (params.threadId !== threadId || (targetTurnId && params.turnId !== targetTurnId)) return;
        if (params.item.type === "agentMessage" && params.item.phase === "final_answer" && params.item.text) {
          finalText = params.item.text;
        }
      } else if (notification.method === "turn/completed") {
        const params = notification.params as TurnCompletedParams;
        if (params.threadId !== threadId) return;
        if (!targetTurnId) bufferedCompletion = params;
        else if (params.turn.id === targetTurnId) complete(params);
      } else if (notification.method === "error") {
        fail(new Error("Codex App Server reported an error during the turn"));
      }
    });

    const timeout = setTimeout(() => {
      fail(new Error("Codex turn timed out"));
      this.close();
    }, this.#options.turnTimeoutMs);
    try {
      const turn = await peer.request<TurnStartResult>("turn/start", {
        threadId,
        input: [
          { type: "text", text: input.message.trim(), text_elements: [] },
          ...(input.imageDataUrl ? [{ type: "image", url: input.imageDataUrl, detail: "auto" }] : []),
        ],
      });
      targetTurnId = turn.turn.id;
      this.#activeTurnId = targetTurnId;
      this.#log({ event: "turn.started", thread: shortId(threadId), turn: shortId(targetTurnId) });
      if (bufferedCompletion?.turn.id === targetTurnId) complete(bufferedCompletion);
      const completed = await completion;
      if (completed.turn.status !== "completed") {
        throw new Error(completed.turn.error?.message ?? `Codex turn ${completed.turn.status}`);
      }

      const text = finalText || deltaText;
      this.#log({
        event: "turn.completed",
        thread: shortId(threadId),
        turn: shortId(targetTurnId),
        deltas: deltaCount,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return { threadId, turnId: targetTurnId, text, deltaCount };
    } finally {
      clearTimeout(timeout);
      removeListener();
      removeClose();
      removeRequests();
      this.#activeTurnId = undefined;
    }
  }

  async interrupt(): Promise<void> {
    if (!this.#activeTurnId || !this.#threadId || !this.#peer) return;
    await this.#peer.request("turn/interrupt", { threadId: this.#threadId, turnId: this.#activeTurnId });
  }

  close(): void {
    this.#peer?.close();
    if (this.#process) {
      if (this.#options.processFactory) this.#process.kill("SIGTERM");
      else stopAgent(this.#process as ChildProcessWithoutNullStreams);
    }
    this.#peer = undefined;
    this.#process = undefined;
    this.#threadId = undefined;
  }

  async #startProcess(): Promise<void> {
    const process = this.#options.processFactory?.() ?? this.#spawnCodex();
    this.#process = process;
    const peer = new RpcPeer(process.stdout, process.stdin);
    this.#peer = peer;
    process.once("exit", (code, signal) => {
      peer.close(new Error(`Codex App Server exited (${code ?? signal ?? "unknown"})`));
      if (this.#process === process) {
        this.#peer = undefined;
        this.#process = undefined;
        this.#threadId = undefined;
      }
    });
    await peer.request("initialize", {
      clientInfo: { name: "jarvis_local", title: "Jarvis Local", version: "0.1.0" },
    });
    await peer.notify("initialized", {});
    this.#log({ event: "app_server.ready" });
  }

  #spawnCodex(): ChildProcessWithoutNullStreams {
    const child = spawn(this.#options.command, ["app-server", "--stdio"], {
      cwd: this.#options.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    child.once("error", () => this.#peer?.close(new Error("Codex CLI unavailable; check its executable path")));
    child.stderr.resume();
    return child;
  }

  async #ensureThread(): Promise<string> {
    if (this.#threadId) return this.#threadId;
    const peer = this.#requirePeer();
    const savedThreadId = await this.#readThreadId();
    const common = {
      cwd: this.#options.cwd,
      approvalPolicy: this.#options.execution ? "untrusted" : "never",
      sandbox: this.#options.execution ? "workspace-write" : "read-only",
      developerInstructions: this.#options.execution ? executionInstructions : developerInstructions,
    };

    if (savedThreadId) {
      try {
        const resumed = await peer.request<ThreadResult>("thread/resume", {
          threadId: savedThreadId,
          ...common,
        });
        this.#threadId = resumed.thread.id;
        this.#log({ event: "thread.resumed", thread: shortId(this.#threadId) });
        return this.#threadId;
      } catch (error) {
        if (this.#options.execution) throw error;
        this.#log({ event: "thread.resume_failed", reason: safeReason(error) });
      }
    }

    const started = await peer.request<ThreadResult>("thread/start", {
      ...common,
      serviceName: "jarvis_phase1",
    });
    this.#threadId = started.thread.id;
    await this.#writeThreadId(this.#threadId);
    await peer.request("thread/name/set", { threadId: this.#threadId, name: "Jarvis" });
    this.#log({ event: "thread.created", thread: shortId(this.#threadId) });
    return this.#threadId;
  }

  #requirePeer(): RpcPeer {
    if (!this.#peer) throw new Error("Codex App Server is not started");
    return this.#peer;
  }

  async #readThreadId(): Promise<string | undefined> {
    try {
      const state = JSON.parse(await readFile(this.#options.stateFile, "utf8")) as PersistedState;
      if (this.#options.execution && (state.version !== 1 || typeof state.threadId !== "string" || state.cwd !== this.#options.cwd)) {
        throw new Error("Execution session does not match this workspace; use a new state file");
      }
      return state.version === 1 && typeof state.threadId === "string" ? state.threadId : undefined;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      if (this.#options.execution) throw error;
      this.#log({ event: "state.read_failed", reason: safeReason(error) });
      return undefined;
    }
  }

  async #writeThreadId(threadId: string): Promise<void> {
    await mkdir(dirname(this.#options.stateFile), { recursive: true, mode: 0o700 });
    const temporary = `${this.#options.stateFile}.${process.pid}.tmp`;
    await writeFile(temporary, `${JSON.stringify({ version: 1, threadId, ...(this.#options.execution ? { cwd: this.#options.cwd } : {}) })}\n`, { mode: 0o600 });
    await rename(temporary, this.#options.stateFile);
  }

  #log(entry: AdapterLog): void {
    this.#options.log?.(entry);
  }
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function safeReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown";
  return message.replace(/[\r\n]+/g, " ").slice(0, 160);
}

export type { AppServerProcess, RpcMessage };
