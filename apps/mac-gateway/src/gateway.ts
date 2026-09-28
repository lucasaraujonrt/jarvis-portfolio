import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { agentIds, imageBlock, record, type AgentId, type TerminalAgent } from "../../../packages/terminal-agents/src/types.ts";
import { TurnStore } from "./turn-store.ts";

import { XaiVoiceClientImpl, XaiVoiceError, XAI_TTS_MAX_TEXT_LENGTH, type XaiVoiceClient } from "./xai-voice.ts";
import { XaiSessionIssuer, type VoiceSessionIssuer } from "./xai-session.ts";

interface GatewayOptions {
  xaiVoice?: XaiVoiceClient;
  voiceSession?: VoiceSessionIssuer;
  token: string;
  agents: Record<AgentId, TerminalAgent>;
  turnTimeoutMs?: number;
  approvalTimeoutMs?: number;
}

export function createGateway(options: GatewayOptions) {
  if (!options.token.trim()) throw new Error("JARVIS_GATEWAY_TOKEN is required for terminal execution");
  const store = new TurnStore(options);
  const voice = options.xaiVoice ?? new XaiVoiceClientImpl();
  const issuer = options.voiceSession ?? new XaiSessionIssuer();
  let activeSpeak = false;
  const server = createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/healthz") return sendJson(response, 200, { status: "ok" });
      if (!authorize(request, options.token)) return sendJson(response, 401, { error: "unauthorized" });
      const url = new URL(request.url ?? "/", "http://gateway.local");
      if (request.method === "POST" && ["/v1/speak", "/v1/voice/session"].includes(url.pathname)) {
        const controller = new AbortController();
        response.once("close", () => { if (!response.writableEnded) controller.abort(); });
        try {
          const body = await readJsonBody(request, 128 * 1024);
          if (url.pathname === "/v1/voice/session") {
            const secret = await issuer.create(controller.signal);
            return sendJson(response, 200, { ...secret, voice: "zagan" });
          }
          const text = typeof body.text === "string" ? body.text.trim() : "";
          if (!text || text.length > XAI_TTS_MAX_TEXT_LENGTH) return sendJson(response, 400, { error: "invalid_text" });
          if (!voice.isConfigured) return sendJson(response, 503, { error: "xai_not_configured" });
          if (activeSpeak) return sendJson(response, 409, { error: "speak_in_progress" });
          activeSpeak = true;
          try {
            const audio = await voice.synthesize(text, controller.signal);
            if (response.destroyed) return;
            response.writeHead(200, {
              "Cache-Control": "no-store", "Content-Type": "audio/pcm", "Content-Length": audio.byteLength,
              "X-Audio-Format": "pcm_s16le", "X-Audio-Sample-Rate": "16000", "X-Audio-Channels": "1",
            });
            response.end(audio);
          } finally { activeSpeak = false; }
        } catch (error) {
          if (error instanceof BodyError) throw error;
          if (response.destroyed) return;
          const code = error instanceof XaiVoiceError ? error.code : "upstream";
          sendJson(response, code === "not_configured" ? 503 : 502, { error: `xai_${code}` });
        }
        return;
      }
      if (request.method === "GET" && url.pathname === "/v1/turn/status") {
        const snapshot = store.snapshot(url.searchParams.get("requestId") ?? "");
        return sendJson(response, snapshot ? 200 : 404, snapshot ?? { error: "unknown_turn" });
      }
      if (request.method !== "POST" || !["/v1/turn", "/v1/turn/start", "/v1/approval", "/v1/turn/cancel"].includes(url.pathname)) {
        return sendJson(response, 404, { error: "not_found" });
      }
      const starting = url.pathname === "/v1/turn" || url.pathname === "/v1/turn/start";
      const body = await readJsonBody(request, starting ? 5 * 1024 * 1024 : 4096);
      if (!starting) {
        if (typeof body.requestId !== "string") return sendJson(response, 400, { error: "invalid_request_id" });
        if (url.pathname === "/v1/turn/cancel") {
          const cancelled = store.cancel(body.requestId);
          return sendJson(response, cancelled ? 200 : 409, cancelled ? { status: "cancelling" } : { error: "inactive_turn" });
        }
        const accepted = typeof body.approvalId === "string" && typeof body.approved === "boolean" && store.approve(body.requestId, body.approvalId, body.approved);
        return sendJson(response, accepted ? 200 : 409, accepted ? { status: "accepted" } : { error: "invalid_approval" });
      }
      const agentId = body.agent ?? "codex";
      if (!agentIds.includes(agentId as AgentId)) return sendJson(response, 400, { error: "invalid_agent" });
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message || message.length > 8000) return sendJson(response, 400, { error: "invalid_message" });
      if (body.imageDataUrl !== undefined) {
        try { if (typeof body.imageDataUrl !== "string") throw new Error(); imageBlock(body.imageDataUrl); }
        catch { return sendJson(response, 400, { error: "invalid_image" }); }
      }
      const requestId = body.requestId ?? (url.pathname === "/v1/turn" ? randomUUID() : undefined);
      if (typeof requestId !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(requestId)) return sendJson(response, 400, { error: "invalid_request_id" });
      const image = typeof body.imageDataUrl === "string" ? body.imageDataUrl : undefined;
      const fingerprint = createHash("sha256").update(JSON.stringify([agentId, message, image])).digest("hex");
      let turn;
      try { turn = store.start(requestId, fingerprint, agentId as AgentId, message, image); }
      catch (error) { return sendJson(response, 409, { error: error instanceof Error ? error.message : "turn_in_progress" }); }
      if (url.pathname === "/v1/turn/start") return sendJson(response, 200, { requestId });
      response.writeHead(200, { "Cache-Control": "no-store", "Content-Type": "application/x-ndjson; charset=utf-8", "X-Content-Type-Options": "nosniff" });
      const unsubscribe = store.subscribe(turn, event => {
        if (response.destroyed || response.writableEnded) return;
        if (response.writableLength > 1024 * 1024) { response.destroy(); return; }
        response.write(JSON.stringify({ ...event, requestId }) + "\n");
        if (event.type === "completed" || event.type === "error") response.end();
      });
      response.on("close", unsubscribe);
    } catch (error) {
      if (!response.headersSent) sendJson(response, error instanceof BodyError ? error.status : 500, { error: error instanceof BodyError ? error.code : "request_failed" });
      else response.destroy();
    }
  });
  return {
    server,
    close() {
      store.close();
      server.close();
      server.closeAllConnections();
    },
  };
}

function authorize(request: IncomingMessage, expected: string): boolean {
  const supplied = Buffer.from(request.headers.authorization?.replace(/^Bearer /, "") ?? "");
  const target = Buffer.from(expected);
  return supplied.length === target.length && timingSafeEqual(supplied, target);
}
class BodyError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}
async function readJsonBody(request: IncomingMessage, limit: number): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new BodyError(413, "body_too_large");
    chunks.push(buffer);
  }
  try {
    const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return record(value);
  } catch { throw new BodyError(400, "invalid_json"); }
}
function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Cache-Control": "no-store", "Content-Type": "application/json" });
  response.end(JSON.stringify(value) + "\n");
}
