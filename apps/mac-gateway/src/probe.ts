import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { CodexAppServerAdapter, type AdapterLog } from "../../../packages/codex-adapter/src/codex-app-server.ts";

const args = parseArgs(process.argv.slice(2));
if (!args.message) {
  console.error("Usage: npm run probe:codex -- --message <text> [--image <path>]");
  process.exitCode = 2;
} else {
  const root = process.cwd();
  const adapter = new CodexAppServerAdapter({
    cwd: root,
    stateFile: resolve(root, ".jarvis/thread.json"),
    log: writeLog,
  });
  try {
    const imageDataUrl = args.image ? await loadImageDataUrl(args.image) : undefined;
    let streamed = "";
    const result = await adapter.sendTurn({
      message: args.message,
      ...(imageDataUrl ? { imageDataUrl } : {}),
      onDelta: (delta) => {
        streamed += delta;
        process.stdout.write(delta);
      },
    });
    if (streamed && !streamed.endsWith("\n")) process.stdout.write("\n");
    if (!streamed && result.text) process.stdout.write(`${result.text}\n`);
    console.error(JSON.stringify({ event: "probe.completed", threadId: result.threadId, deltas: result.deltaCount }));
  } finally {
    adapter.close();
  }
}

function parseArgs(values: string[]): { message?: string; image?: string } {
  const result: { message?: string; image?: string } = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];
    if (value === "--message" && next !== undefined) {
      result.message = next;
      index += 1;
    } else if (value === "--image" && next !== undefined) {
      result.image = next;
      index += 1;
    }
  }
  return result;
}

async function loadImageDataUrl(path: string): Promise<string> {
  const absolute = resolve(path);
  const data = await readFile(absolute);
  const mime = new Map([
    [".png", "image/png"],
    [".jpg", "image/jpeg"],
    [".jpeg", "image/jpeg"],
    [".webp", "image/webp"],
  ]).get(extname(absolute).toLowerCase());
  if (!mime) throw new Error("image must be PNG, JPEG, or WebP");
  return `data:${mime};base64,${data.toString("base64")}`;
}

function writeLog(entry: AdapterLog): void {
  console.error(JSON.stringify(entry));
}
