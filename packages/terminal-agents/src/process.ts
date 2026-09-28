import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export interface AgentOptions {
  cwd: string;
  stateFile: string;
  command: string;
  spawnProcess?: (command: string, args: string[], cwd: string) => ChildProcessWithoutNullStreams;
}

export function spawnAgent(command: string, args: string[], cwd: string): ChildProcessWithoutNullStreams {
  const child = spawn(command, args, { cwd, stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32" });
  child.stderr.resume();
  return child;
}

export function stopAgent(child: ChildProcessWithoutNullStreams): void {
  const kill = (signal: NodeJS.Signals) => {
    try {
      if (child.pid && process.platform !== "win32") process.kill(-child.pid, signal);
      else child.kill(signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") child.kill(signal);
    }
  };
  kill("SIGTERM");
  const timer = setTimeout(() => kill("SIGKILL"), 1500);
  timer.unref();
  if (!child.pid || process.platform === "win32") child.once("close", () => clearTimeout(timer));
}

export async function readSession(options: AgentOptions): Promise<string | undefined> {
  try {
    const saved = JSON.parse(await readFile(options.stateFile, "utf8"));
    if (saved.version !== 1 || saved.cwd !== resolve(options.cwd) || typeof saved.sessionId !== "string") {
      throw new Error("Estado de sessão incompatível com o workspace; use outro arquivo de estado.");
    }
    return saved.sessionId;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function saveSession(options: AgentOptions, sessionId: string): Promise<void> {
  await mkdir(dirname(options.stateFile), { recursive: true, mode: 0o700 });
  const temporary = `${options.stateFile}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify({ version: 1, cwd: resolve(options.cwd), sessionId }) + "\n", { mode: 0o600 });
  await rename(temporary, options.stateFile);
}
