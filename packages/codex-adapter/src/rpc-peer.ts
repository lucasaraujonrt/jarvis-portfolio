import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

type RequestId = number | string;

interface RpcError {
  code: number;
  message: string;
}

interface RpcMessage {
  jsonrpc?: "2.0";
  id?: RequestId;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: RpcError;
}

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

export class RpcPeer {
  readonly #events = new EventEmitter();
  readonly #pending = new Map<RequestId, PendingRequest>();
  readonly #writer: Writable;
  #nextId = 1;
  #closed = false;
  #requestHandler: ((message: RpcMessage) => Promise<unknown>) | undefined;
  readonly #jsonrpc: boolean;

  constructor(reader: Readable, writer: Writable, jsonrpc = false) {
    this.#jsonrpc = jsonrpc;
    this.#writer = writer;
    const lines = createInterface({ input: reader, crlfDelay: Infinity });
    lines.on("line", (line) => this.#handleLine(line));
    lines.on("close", () => this.close(new Error("Codex App Server closed its output")));
    writer.on("error", (error) => this.close(error));
  }

  onNotification(listener: (message: RpcMessage) => void): () => void {
    this.#events.on("notification", listener);
    return () => this.#events.off("notification", listener);
  }

  onRequest(handler: (message: RpcMessage) => Promise<unknown>): () => void {
    this.#requestHandler = handler;
    return () => { if (this.#requestHandler === handler) this.#requestHandler = undefined; };
  }

  onClose(listener: (reason: Error) => void): () => void {
    this.#events.on("closed", listener);
    return () => this.#events.off("closed", listener);
  }

  async request<T>(method: string, params: unknown): Promise<T> {
    if (this.#closed) {
      throw new Error("Codex App Server transport is closed");
    }

    const id = this.#nextId++;
    const result = new Promise<unknown>((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
    });
    void result.catch(() => undefined);
    try {
      await this.#send({ id, method, params });
    } catch (error) {
      this.#pending.delete(id);
      throw error;
    }
    return (await result) as T;
  }

  async notify(method: string, params: unknown): Promise<void> {
    await this.#send({ method, params });
  }

  close(reason = new Error("Codex App Server transport closed")): void {
    if (this.#closed) return;
    this.#closed = true;
    for (const pending of this.#pending.values()) pending.reject(reason);
    this.#pending.clear();
    this.#events.emit("closed", reason);
  }

  async #send(message: RpcMessage): Promise<void> {
    if (this.#closed) throw new Error("Agent transport is closed");
    const line = `${JSON.stringify(this.#jsonrpc ? { jsonrpc: "2.0", ...message } : message)}\n`;
    if (this.#writer.write(line)) return;
    await new Promise<void>((resolve, reject) => {
      this.#writer.once("drain", resolve);
      this.#writer.once("error", reject);
    });
  }

  #handleLine(line: string): void {
    let message: RpcMessage;
    try {
      message = JSON.parse(line) as RpcMessage;
      if (!message || typeof message !== "object" || Array.isArray(message)) throw new Error("Invalid message");
    } catch {
      this.close(new Error("Codex App Server emitted invalid JSON"));
      return;
    }

    if (message.id !== undefined && message.method === undefined) {
      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(`Codex RPC ${message.error.code}: ${message.error.message}`));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.id !== undefined && message.method !== undefined) {
      void this.#handleRequest(message);
      return;
    }

    if (message.method) {
      try { this.#events.emit("notification", message); }
      catch { this.close(new Error("Invalid agent notification")); }
    }
  }

  async #handleRequest(message: RpcMessage): Promise<void> {
    const id = message.id!;
    try {
      if (!this.#requestHandler) throw new Error("Unsupported agent request");
      const result = await this.#requestHandler(message);
      if (!this.#closed) await this.#send({ id, result });
    } catch {
      if (!this.#closed) {
        try { await this.#send({ id, error: { code: -32601, message: "Jarvis denied this request" } }); }
        catch { this.close(new Error("Agent transport failed")); }
      }
    }
  }
}

export type { RpcMessage };
