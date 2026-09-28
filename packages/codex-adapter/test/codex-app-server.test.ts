import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { PassThrough } from "node:stream";
import test from "node:test";
import {
  CodexAppServerAdapter,
  type AppServerProcess,
  type RpcMessage,
} from "../src/codex-app-server.ts";

class FakeProcess extends EventEmitter implements AppServerProcess {
  readonly stdin = new PassThrough();
  readonly stdout = new PassThrough();

  kill(): boolean {
    this.emit("exit", 0, null);
    this.stdout.end();
    return true;
  }
}

class FakeCodexServer {
  readonly threads = new Set<string>();
  readonly methods: string[] = [];
  lastTurnInput: unknown;

  createProcess(): AppServerProcess {
    const child = new FakeProcess();
    const lines = createInterface({ input: child.stdin, crlfDelay: Infinity });
    lines.on("line", (line) => this.#handle(child, JSON.parse(line) as RpcMessage));
    return child;
  }

  #handle(child: FakeProcess, message: RpcMessage): void {
    if (!message.method) return;
    this.methods.push(message.method);
    if (message.id === undefined) return;

    if (message.method === "initialize") {
      this.#send(child, { id: message.id, result: { userAgent: "fake" } });
    } else if (message.method === "thread/start") {
      const threadId = "thread-jarvis-1";
      this.threads.add(threadId);
      this.#send(child, { id: message.id, result: { thread: { id: threadId } } });
    } else if (message.method === "thread/resume") {
      const threadId = (message.params as { threadId: string }).threadId;
      if (this.threads.has(threadId)) {
        this.#send(child, { id: message.id, result: { thread: { id: threadId } } });
      } else {
        this.#send(child, { id: message.id, error: { code: -32000, message: "missing" } });
      }
    } else if (message.method === "thread/name/set") {
      this.#send(child, { id: message.id, result: {} });
    } else if (message.method === "turn/start") {
      this.lastTurnInput = (message.params as { input: unknown }).input;
      const turnId = `turn-${this.methods.filter((method) => method === "turn/start").length}`;
      const threadId = (message.params as { threadId: string }).threadId;
      this.#send(child, { id: message.id, result: { turn: { id: turnId, status: "inProgress" } } });
      queueMicrotask(() => {
        this.#send(child, {
          method: "item/agentMessage/delta",
          params: { threadId, turnId, itemId: "answer", delta: "JARVIS_" },
        });
        this.#send(child, {
          method: "item/agentMessage/delta",
          params: { threadId, turnId, itemId: "answer", delta: "OK" },
        });
        this.#send(child, {
          method: "item/completed",
          params: {
            threadId,
            turnId,
            item: { type: "agentMessage", phase: "final_answer", text: "JARVIS_OK" },
          },
        });
        this.#send(child, {
          method: "turn/completed",
          params: { threadId, turn: { id: turnId, status: "completed" } },
        });
      });
    }
  }

  #send(child: FakeProcess, message: RpcMessage): void {
    child.stdout.write(`${JSON.stringify(message)}\n`);
  }
}

test("creates, streams, persists, and resumes a dedicated Codex thread", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jarvis-adapter-"));
  const stateFile = join(directory, "thread.json");
  const fake = new FakeCodexServer();
  const deltas: string[] = [];
  const first = new CodexAppServerAdapter({
    cwd: directory,
    stateFile,
    processFactory: () => fake.createProcess(),
  });

  const pendingResult = first.sendTurn({
    message: "teste",
    imageDataUrl: "data:image/png;base64,AAAA",
    onDelta: (delta) => deltas.push(delta),
  });
  await assert.rejects(first.sendTurn({ message: "concorrente" }), /active turn/);
  const result = await pendingResult;
  first.close();

  assert.equal(result.threadId, "thread-jarvis-1");
  assert.equal(result.text, "JARVIS_OK");
  assert.equal(result.deltaCount, 2);
  assert.deepEqual(deltas, ["JARVIS_", "OK"]);
  assert.deepEqual(fake.lastTurnInput, [
    { type: "text", text: "teste", text_elements: [] },
    { type: "image", url: "data:image/png;base64,AAAA", detail: "auto" },
  ]);
  assert.deepEqual(JSON.parse(await readFile(stateFile, "utf8")), {
    version: 1,
    threadId: "thread-jarvis-1",
  });

  const second = new CodexAppServerAdapter({
    cwd: directory,
    stateFile,
    processFactory: () => fake.createProcess(),
  });
  const resumed = await second.sendTurn({ message: "continue" });
  second.close();

  assert.equal(resumed.threadId, result.threadId);
  assert.equal(fake.methods.filter((method) => method === "thread/start").length, 1);
  assert.equal(fake.methods.filter((method) => method === "thread/resume").length, 1);
});

for (const approved of [true, false]) {
  test(`execution mode uses workspace-write and ${approved ? "accepts once" : "declines"} native approvals`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "jarvis-codex-approval-"));
    const child = new FakeProcess();
    let decision: unknown;
    createInterface({ input: child.stdin }).on("line", line => {
      const message = JSON.parse(line);
      const send = (value: unknown) => child.stdout.write(JSON.stringify(value) + "\n");
      if (message.method === "initialize" || message.method === "thread/name/set") send({ id: message.id, result: {} });
      else if (message.method === "thread/start") {
        assert.equal(message.params.sandbox, "workspace-write");
        assert.equal(message.params.approvalPolicy, "untrusted");
        send({ id: message.id, result: { thread: { id: "exec-thread" } } });
      } else if (message.method === "turn/start") {
        send({ id: message.id, result: { turn: { id: "exec-turn" } } });
        queueMicrotask(() => send({ id: "permission", method: "item/commandExecution/requestApproval", params: { threadId: "exec-thread", turnId: "exec-turn", command: "pwd", cwd: directory } }));
      } else if (message.id === "permission") {
        decision = message.result;
        send({ method: "turn/completed", params: { threadId: "exec-thread", turn: { id: "exec-turn", status: "completed" } } });
      }
    });
    const adapter = new CodexAppServerAdapter({ cwd: directory, stateFile: join(directory, "state.json"), execution: true, processFactory: () => child });
    try {
      const signal = AbortSignal.abort();
      await assert.rejects(adapter.sendTurn({ message: "aborted", signal }));
      await adapter.sendTurn({ message: "test", onApproval: async approval => { assert.match(approval.detail, /pwd/); return approved; } });
      assert.deepEqual(decision, { decision: approved ? "accept" : "decline" });
    } finally { adapter.close(); }
  });
}
