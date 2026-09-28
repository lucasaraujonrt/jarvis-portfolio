import assert from "node:assert/strict";
import test from "node:test";
import { TurnStore } from "../src/turn-store.ts";
import type { TerminalAgent, TurnResult } from "../../../packages/terminal-agents/src/types.ts";

test("completed turns make room for new work while recent results remain recoverable", async () => {
  let executions = 0;
  const agent: TerminalAgent = {
    async sendTurn(): Promise<TurnResult> {
      executions += 1;
      return { threadId: "thread", turnId: "turn", text: "done", deltaCount: 1 };
    },
    close() {},
    async interrupt() {},
  };
  const store = new TurnStore({ agents: { codex: agent, claude: agent, grok: agent } });
  try {
    for (let index = 1; index <= 32; index += 1) {
      store.start(`request-${index}`, `fingerprint-${index}`, "codex", "test");
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.equal(store.snapshot(`request-${index}`)?.status, "completed");
    }

    const previous = store.start("request-32", "fingerprint-32", "codex", "test");
    assert.equal(previous.status, "completed");
    assert.equal(executions, 32);

    store.start("request-33", "fingerprint-33", "codex", "test");
    assert.equal(store.snapshot("request-1"), undefined);
    assert.equal(store.snapshot("request-2")?.status, "completed");
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(store.snapshot("request-33")?.status, "completed");
    assert.equal(executions, 33);
  } finally {
    store.close();
  }
});
