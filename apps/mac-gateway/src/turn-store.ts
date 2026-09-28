import { randomUUID } from "node:crypto";
import type { AgentId, Approval, TerminalAgent } from "../../../packages/terminal-agents/src/types.ts";

type TurnEvent = Record<string, unknown>;
type TurnStatus = "running" | "completed" | "failed";
interface PendingApproval extends Approval { id: string; expiresAt: number; }
interface StoredTurn {
  id: string;
  fingerprint: string;
  agent: AgentId;
  status: TurnStatus;
  text: string;
  activity: string;
  error?: string;
  threadId?: string;
  finishedAt?: number;
  approvals: Map<string, { value: PendingApproval; settle(approved: boolean): void }>;
  controller: AbortController;
  listeners: Set<(event: TurnEvent) => void>;
}
interface Options {
  agents: Record<AgentId, TerminalAgent>;
  turnTimeoutMs?: number;
  approvalTimeoutMs?: number;
}

export class TurnStore {
  readonly #turns = new Map<string, StoredTurn>();
  readonly #options: Options;
  #active: StoredTurn | undefined;

  constructor(options: Options) { this.#options = options; }

  start(id: string, fingerprint: string, agent: AgentId, message: string, imageDataUrl?: string): StoredTurn {
    this.#prune();
    const existing = this.#turns.get(id);
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new Error("request_id_conflict");
      return existing;
    }
    if (this.#active) throw new Error("turn_in_progress");
    if (this.#turns.size >= 32) {
      const oldest = this.#turns.values().next().value;
      if (!oldest || oldest.finishedAt === undefined) throw new Error("turn_history_full");
      this.#turns.delete(oldest.id);
    }
    const turn: StoredTurn = { id, fingerprint, agent, status: "running", text: "", activity: "Executando no Mac",
      approvals: new Map(), controller: new AbortController(), listeners: new Set() };
    this.#turns.set(id, turn);
    this.#active = turn;
    queueMicrotask(() => { void this.#execute(turn, message, imageDataUrl); });
    return turn;
  }

  snapshot(id: string) {
    this.#prune();
    const turn = this.#turns.get(id);
    if (!turn) return undefined;
    return { requestId: turn.id, agent: turn.agent, status: turn.status, text: turn.text,
      activity: turn.activity, error: turn.error, threadId: turn.threadId,
      approvals: Array.from(turn.approvals.values(), entry => entry.value) };
  }

  subscribe(turn: StoredTurn, listener: (event: TurnEvent) => void): () => void {
    turn.listeners.add(listener);
    listener({ type: "started", agent: turn.agent });
    if (turn.text) listener({ type: "delta", delta: turn.text });
    for (const { value } of turn.approvals.values()) listener({ type: "approval", approvalId: value.id, title: value.title, detail: value.detail });
    if (turn.status === "completed") listener({ type: "completed", text: turn.text, threadId: turn.threadId });
    if (turn.status === "failed") listener({ type: "error", error: turn.error });
    return () => { turn.listeners.delete(listener); };
  }

  approve(id: string, approvalId: string, approved: boolean): boolean {
    const turn = this.#turns.get(id);
    const entry = turn?.approvals.get(approvalId);
    if (!entry || turn?.status !== "running" || turn.controller.signal.aborted) return false;
    if (entry.value.expiresAt <= Date.now()) { entry.settle(false); return false; }
    entry.settle(approved);
    return true;
  }

  cancel(id: string): boolean {
    const turn = this.#turns.get(id);
    if (!turn || turn.status !== "running") return false;
    turn.controller.abort();
    return true;
  }

  close(): void {
    this.#active?.controller.abort();
    for (const agent of Object.values(this.#options.agents)) agent.close();
  }

  #emit(turn: StoredTurn, event: TurnEvent): void {
    for (const listener of turn.listeners) listener(event);
  }

  async #execute(turn: StoredTurn, message: string, imageDataUrl?: string): Promise<void> {
    const agent = this.#options.agents[turn.agent];
    const abort = () => {
      for (const entry of turn.approvals.values()) entry.settle(false);
      agent.close();
    };
    turn.controller.signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => turn.controller.abort(), this.#options.turnTimeoutMs ?? 600_000);
    try {
      turn.controller.signal.throwIfAborted();
      const result = await agent.sendTurn({ message, signal: turn.controller.signal,
        ...(imageDataUrl ? { imageDataUrl } : {}),
        onDelta: delta => {
          if (turn.text.length + delta.length > 1_000_000) { turn.controller.abort(); return; }
          turn.text += delta;
          this.#emit(turn, { type: "delta", delta });
        },
        onActivity: text => { turn.activity = text.slice(0, 16000); this.#emit(turn, { type: "activity", text: turn.activity }); },
        onApproval: approval => new Promise<boolean>(resolve => {
          if (turn.controller.signal.aborted) { resolve(false); return; }
          const id = randomUUID();
          const duration = this.#options.approvalTimeoutMs ?? 120_000;
          const expiry = setTimeout(() => settle(false), duration);
          const settle = (approved: boolean) => {
            if (!turn.approvals.delete(id)) return;
            clearTimeout(expiry);
            this.#emit(turn, { type: "approval_resolved", approvalId: id });
            resolve(approved && !turn.controller.signal.aborted);
          };
          turn.approvals.set(id, { value: { id, ...approval, expiresAt: Date.now() + duration }, settle });
          this.#emit(turn, { type: "approval", approvalId: id, ...approval });
        }),
      });
      turn.controller.signal.throwIfAborted();
      if (result.text.length > 1_000_000) throw new Error("output_too_large");
      turn.text = result.text;
      turn.threadId = result.threadId;
      turn.status = "completed";
      turn.activity = "Concluído";
      this.#emit(turn, { type: "completed", threadId: result.threadId, text: result.text });
    } catch {
      turn.status = "failed";
      turn.error = turn.controller.signal.aborted ? "cancelled_or_timed_out" : "agent_failed";
      turn.activity = "Tarefa interrompida ou não concluída";
      this.#emit(turn, { type: "error", error: turn.error });
    } finally {
      clearTimeout(timer);
      turn.controller.signal.removeEventListener("abort", abort);
      for (const entry of turn.approvals.values()) entry.settle(false);
      turn.listeners.clear();
      turn.finishedAt = Date.now();
      if (this.#active === turn) this.#active = undefined;
    }
  }

  #prune(): void {
    for (const [id, turn] of this.#turns) {
      if (turn.finishedAt !== undefined && Date.now() - turn.finishedAt > 30 * 60_000) this.#turns.delete(id);
    }
  }
}
