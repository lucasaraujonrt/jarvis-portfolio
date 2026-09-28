import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { createGateway } from "../src/gateway.ts";
import type { TerminalAgent, TurnInput, TurnResult } from "../../../packages/terminal-agents/src/types.ts";

const result: TurnResult = { threadId: "thread", turnId: "turn", text: "done", deltaCount: 1 };
function fake(sendTurn: (input: TurnInput) => Promise<TurnResult>): TerminalAgent {
  return { sendTurn, close() {}, async interrupt() {} };
}

test("gateway authenticates, routes selection, resolves approvals once and rejects overlapping turns", async t => {
  let decision: boolean | undefined;
  const agent = fake(async input => {
    decision = await input.onApproval!({ title: "pwd", detail: "execute pwd" });
    input.onDelta?.("done"); return result;
  });
  const unexpected = fake(async () => { throw new Error("wrong agent"); });
  const gateway = createGateway({ token: "test-secret", agents: { codex: unexpected, claude: agent, grok: unexpected } });
  t.after(() => gateway.close());
  await new Promise<void>(resolve => gateway.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(gateway.server.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown, token = "test-secret") => fetch(base + path, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await post("/v1/turn", { message: "test" }, "wrong")).status, 401);
  assert.equal((await post("/v1/turn", { message: "test", agent: "unknown" })).status, 400);
  const response = await post("/v1/turn", { message: "test", agent: "claude", requestId: "req-1" });
  assert.equal(response.status, 200);
  const reader = response.body!.getReader();
  let text = "";
  while (!text.includes('"type":"approval"')) text += new TextDecoder().decode((await reader.read()).value);
  const approval = text.trim().split("\n").map(line => JSON.parse(line)).find(event => event.type === "approval");
  assert.equal((await post("/v1/turn", { message: "overlap" })).status, 409);
  assert.equal((await post("/v1/approval", { requestId: "wrong", approvalId: approval.approvalId, approved: true })).status, 409);
  assert.equal((await post("/v1/approval", { requestId: "req-1", approvalId: approval.approvalId, approved: true })).status, 200);
  assert.equal((await post("/v1/approval", { requestId: "req-1", approvalId: approval.approvalId, approved: true })).status, 409);
  while (true) { const chunk = await reader.read(); if (chunk.done) break; text += new TextDecoder().decode(chunk.value); }
  assert.equal(decision, true);
  assert.match(text, /"type":"completed"/);
});

test("gateway cancellation and approval expiry deny actions; malformed body is rejected", async t => {
  let decision: boolean | undefined;
  const agent = fake(async input => { decision = await input.onApproval!({ title: "write", detail: "file" }); return result; });
  const gateway = createGateway({ token: "secret", agents: { codex: agent, claude: agent, grok: agent }, approvalTimeoutMs: 40 });
  t.after(() => gateway.close());
  await new Promise<void>(resolve => gateway.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(gateway.server.address() as AddressInfo).port}`;
  const post = (path: string, body: string) => fetch(base + path, { method: "POST", headers: { Authorization: "Bearer secret" }, body });
  assert.equal((await post("/v1/turn", "null")).status, 400);
  assert.equal((await post("/v1/turn", "{")).status, 400);
  const expired = await post("/v1/turn", '{"message":"test"}');
  assert.match(await expired.text(), /completed/);
  assert.equal(decision, false);
  const pending = await post("/v1/turn", '{"message":"test","requestId":"cancel-me"}');
  assert.equal((await post("/v1/turn/cancel", '{"requestId":"cancel-me"}')).status, 200);
  const output = await pending.text();
  assert.match(output, /cancelled_or_timed_out/);
  assert.doesNotMatch(output, /"type":"completed"/);
  assert.equal(decision, false);
});

test("execution gateway requires a token even on loopback", () => {
  const agent = fake(async () => result);
  assert.throws(() => createGateway({ token: "", agents: { codex: agent, claude: agent, grok: agent } }), /TOKEN/);
});

test("disconnected iPhone can recover approval and final result without executing twice", async t => {
  let executions = 0;
  let approvals = 0;
  const agent = fake(async input => {
    executions += 1;
    const approved = await input.onApproval!({ title: "write", detail: "briefing.md" });
    if (approved) approvals += 1;
    return result;
  });
  const gateway = createGateway({ token: "secret", agents: { codex: agent, claude: agent, grok: agent } });
  t.after(() => gateway.close());
  await new Promise<void>(resolve => gateway.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(gateway.server.address() as AddressInfo).port}`;
  const headers = { Authorization: "Bearer secret", "Content-Type": "application/json" };
  const post = (path: string, body: unknown) => fetch(base + path, { method: "POST", headers, body: JSON.stringify(body) });
  const snapshot = () => fetch(base + "/v1/turn/status?requestId=recover", { headers }).then(r => r.json());
  const stream = await post("/v1/turn", { requestId: "recover", message: "test" });
  await stream.body!.cancel();
  const pending = await snapshot();
  assert.equal(pending.status, "running");
  assert.equal(pending.approvals.length, 1);
  assert.equal((await post("/v1/turn/start", { requestId: "recover", message: "test" })).status, 200);
  assert.equal((await post("/v1/turn/start", { requestId: "recover", message: "changed" })).status, 409);
  assert.equal((await fetch(base + "/v1/turn/status?requestId=recover")).status, 401);
  assert.equal((await post("/v1/approval", { requestId: "recover", approvalId: pending.approvals[0].id, approved: true })).status, 200);
  const complete = await snapshot();
  assert.equal(complete.status, "completed");
  assert.equal(complete.text, "done");
  assert.deepEqual(complete.approvals, []);
  await post("/v1/turn/start", { requestId: "recover", message: "test" });
  assert.equal(executions, 1);
  assert.equal(approvals, 1);
});

test("async task retains failure after cancellation and never restores expired approvals", async t => {
  let decision: boolean | undefined;
  const agent = fake(async input => { decision = await input.onApproval!({ title: "write", detail: "file" }); return result; });
  const gateway = createGateway({ token: "secret", agents: { codex: agent, claude: agent, grok: agent }, approvalTimeoutMs: 30 });
  t.after(() => gateway.close());
  await new Promise<void>(resolve => gateway.server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(gateway.server.address() as AddressInfo).port}`;
  const headers = { Authorization: "Bearer secret", "Content-Type": "application/json" };
  const post = (path: string, body: unknown) => fetch(base + path, { method: "POST", headers, body: JSON.stringify(body) });
  await post("/v1/turn/start", { requestId: "expire", message: "test" });
  await new Promise(resolve => setTimeout(resolve, 60));
  const snapshot = await fetch(base + "/v1/turn/status?requestId=expire", { headers }).then(r => r.json());
  assert.equal(snapshot.status, "completed");
  assert.deepEqual(snapshot.approvals, []);
  assert.equal(decision, false);
  await post("/v1/turn/start", { requestId: "cancel", message: "test" });
  await post("/v1/turn/cancel", { requestId: "cancel" });
  const cancelled = await fetch(base + "/v1/turn/status?requestId=cancel", { headers }).then(r => r.json());
  assert.equal(cancelled.status, "failed");
  assert.equal(cancelled.error, "cancelled_or_timed_out");
  assert.deepEqual(cancelled.approvals, []);
});
