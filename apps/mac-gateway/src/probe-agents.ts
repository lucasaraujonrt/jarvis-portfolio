import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { RpcPeer } from "../../../packages/codex-adapter/src/rpc-peer.ts";
import { spawnAgent, stopAgent } from "../../../packages/terminal-agents/src/process.ts";
import { record } from "../../../packages/terminal-agents/src/types.ts";

for (const id of ["codex", "claude", "grok"] as const) {
  const command = process.env[`JARVIS_${id.toUpperCase()}_COMMAND`] ?? id;
  const args = id === "codex" ? ["app-server", "--stdio"] : id === "grok" ? ["agent", "--no-leader", "stdio"] :
    ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--include-partial-messages", "--permission-mode", "default", "--permission-prompt-tool", "stdio"];
  const child = spawnAgent(command, args, process.cwd());
  const timer = setTimeout(() => stopAgent(child), 30_000);
  try {
    if (id === "claude") {
      await new Promise<void>((resolve, reject) => {
        const requestId = randomUUID();
        const lines = createInterface({ input: child.stdout });
        child.once("error", reject);
        child.stdin.once("error", reject);
        lines.once("close", () => reject(new Error("output closed before initialization")));
        lines.on("line", line => {
          try {
            const message = record(JSON.parse(line));
            if (message.type === "control_response" && record(message.response).request_id === requestId) {
              if (record(message.response).subtype === "success") resolve();
              else reject(new Error("initialization rejected"));
            }
          } catch { reject(new Error("invalid JSON")); }
        });
        child.stdin.write(JSON.stringify({ type: "control_request", request_id: requestId, request: { subtype: "initialize", hooks: null } }) + "\n");
      });
    } else {
      const peer = new RpcPeer(child.stdout, child.stdin, id === "grok");
      child.once("error", () => peer.close(new Error("executable unavailable")));
      await peer.request("initialize", id === "codex" ? { clientInfo: { name: "jarvis_probe", version: "0.2.0" } } :
        { protocolVersion: 1, clientCapabilities: {}, clientInfo: { name: "jarvis_probe", version: "0.2.0" } });
      if (id === "codex") await peer.notify("initialized", {});
      peer.close();
    }
    console.log(JSON.stringify({ agent: id, initialized: true, promptSent: false }));
  } catch (error) {
    console.log(JSON.stringify({ agent: id, initialized: false, reason: error instanceof Error ? error.message : "failed" }));
    process.exitCode = 1;
  } finally { clearTimeout(timer); stopAgent(child); }
}
