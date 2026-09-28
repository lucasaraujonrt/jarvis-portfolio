import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createInterface } from "node:readline";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ClaudeAgent } from "../src/claude.ts";
import { GrokAgent } from "../src/grok.ts";
import { record } from "../src/types.ts";

class FakeChild extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  stderr = new PassThrough();
  stopped = false;
  kill() {
    if (!this.stopped) { this.stopped = true; this.stdout.end(); this.emit("exit", 0, null); this.emit("close"); }
    return true;
  }
  send(value: unknown) { this.stdout.write(JSON.stringify(value) + "\n"); }
  receive(handler: (message: Record<string, unknown>) => void) {
    createInterface({ input: this.stdin }).on("line", line => handler(record(JSON.parse(line))));
  }
  process() { return this as unknown as ChildProcessWithoutNullStreams; }
}

for (const approved of [true, false]) {
  test(`Claude streams, ${approved ? "allows once" : "denies"}, and resumes its own session`, async t => {
    const cwd = await mkdtemp(join(tmpdir(), "jarvis-claude-test-"));
    t.after(() => rm(cwd, { recursive: true, force: true }));
    const argsSeen: string[][] = [];
    const decisions: unknown[] = [];
    const agent = new ClaudeAgent({ cwd, stateFile: join(cwd, "session.json"), command: "fake", spawnProcess: (_, args) => {
      argsSeen.push(args);
      const child = new FakeChild();
      child.receive(message => {
        if (message.type === "control_request") child.send({ type: "control_response", response: { subtype: "success", request_id: message.request_id } });
        else if (message.type === "user") {
          child.send({ type: "system", subtype: "init", session_id: "session-claude" });
          child.send({ type: "control_request", request_id: "permission", request: { subtype: "can_use_tool", tool_name: "Bash", input: { command: "pwd" } } });
        } else if (message.type === "control_response") {
          decisions.push(record(message.response).response);
          child.send({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "partial" } } });
          child.send({ type: "result", subtype: "success", is_error: false, session_id: "session-claude", result: "final" });
        }
      });
      return child.process();
    } });
    const deltas: string[] = [];
    const result = await agent.sendTurn({ message: "test", onDelta: d => deltas.push(d), onApproval: async approval => {
      assert.match(approval.detail, /pwd/); return approved;
    } });
    assert.equal(result.text, "final");
    assert.deepEqual(deltas, ["partial"]);
    assert.equal(record(decisions[0]).behavior, approved ? "allow" : "deny");
    assert.equal(record(decisions[0]).updatedPermissions, undefined);
    await agent.sendTurn({ message: "continue" });
    assert.ok(argsSeen[1]?.includes("--resume=session-claude"));
    assert.ok(argsSeen[0]?.includes("--permission-prompt-tool"));
    assert.ok(!argsSeen[0]?.includes("--dangerously-skip-permissions"));
  });
}

test("Claude rejects missing result, model failure, and aborts a blocked process", async t => {
  const cwd = await mkdtemp(join(tmpdir(), "jarvis-claude-fail-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  for (const mode of ["eof", "failed", "abort"]) {
    let child: FakeChild | undefined;
    const abort = new AbortController();
    const agent = new ClaudeAgent({ cwd, stateFile: join(cwd, mode), command: "fake", spawnProcess: () => {
      child = new FakeChild();
      child.receive(message => {
        if (message.type === "control_request") child!.send({ type: "control_response", response: { subtype: "success", request_id: message.request_id } });
        else if (message.type === "user") {
          if (mode === "eof") child!.stdout.end();
          if (mode === "failed") child!.send({ type: "result", subtype: "success", is_error: true });
          if (mode === "abort") abort.abort();
        }
      });
      return child.process();
    } });
    await assert.rejects(agent.sendTurn({ message: "test", signal: abort.signal }));
    assert.equal(child?.stopped, true);
  }
});

for (const approved of [true, false]) {
  test(`Grok ACP streams, ${approved ? "allows once" : "denies"} and loads its session`, async t => {
    const cwd = await mkdtemp(join(tmpdir(), "jarvis-grok-test-"));
    t.after(() => rm(cwd, { recursive: true, force: true }));
    const methods: string[] = [];
    let decision: unknown;
    const agent = new GrokAgent({ cwd, stateFile: join(cwd, "session.json"), command: "fake", spawnProcess: (_, args) => {
      assert.deepEqual(args, ["agent", "--no-leader", "stdio"]);
      const child = new FakeChild();
      let promptId: unknown;
      child.receive(message => {
        assert.equal(message.jsonrpc, "2.0");
        methods.push(String(message.method));
        if (message.method === "initialize") child.send({ id: message.id, result: { agentCapabilities: { loadSession: true, promptCapabilities: { image: true } } } });
        else if (message.method === "session/new" || message.method === "session/load") {
          assert.equal(record(record(message.params)._meta).yoloMode, false);
          child.send({ id: message.id, result: { sessionId: "session-grok" } });
        } else if (message.method === "session/prompt") {
          promptId = message.id;
          child.send({ id: "permission", method: "session/request_permission", params: { sessionId: "session-grok", toolCall: { title: "pwd" }, options: [{ kind: "allow_always", optionId: "always" }, { kind: "allow_once", optionId: "once" }] } });
        } else if (message.id === "permission") {
          decision = record(message.result).outcome;
          child.send({ method: "session/update", params: { sessionId: "session-grok", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "done" } } } });
          child.send({ id: promptId, result: { stopReason: "end_turn" } });
        }
      });
      return child.process();
    } });
    const result = await agent.sendTurn({ message: "test", imageDataUrl: "data:image/jpeg;base64,AAAA", onApproval: async () => approved });
    assert.equal(result.text, "done");
    assert.deepEqual(decision, approved ? { outcome: "selected", optionId: "once" } : { outcome: "cancelled" });
    await agent.sendTurn({ message: "continue" });
    assert.ok(methods.includes("session/load"));
  });
}

test("Grok abort closes a waiting ACP request without reporting completion", async t => {
  const cwd = await mkdtemp(join(tmpdir(), "jarvis-grok-abort-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const abort = new AbortController();
  let child: FakeChild | undefined;
  const agent = new GrokAgent({ cwd, stateFile: join(cwd, "session"), command: "fake", spawnProcess: () => {
    child = new FakeChild();
    child.receive(() => abort.abort());
    return child.process();
  } });
  await assert.rejects(agent.sendTurn({ message: "test", signal: abort.signal }));
  assert.equal(child?.stopped, true);
});
