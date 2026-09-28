const XAI_TTS_ENDPOINT = "https://api.x.ai/v1/tts";
const XAI_TTS_TIMEOUT_MS = 30_000;
const XAI_TTS_DEFAULT_VOICE_ID = "zagan";

export const XAI_TTS_SAMPLE_RATE = 16_000;
export const XAI_TTS_MAX_TEXT_LENGTH = 15_000;
export const XAI_TTS_MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export interface XaiVoiceClient {
  readonly isConfigured: boolean;
  synthesize(text: string, signal?: AbortSignal): Promise<Uint8Array>;
}

type FetchLike = typeof fetch;

export class XaiVoiceError extends Error {
  readonly code: "not_configured" | "timeout" | "aborted" | "upstream" | "network" | "invalid_response";

  constructor(code: XaiVoiceError["code"]) {
    super(code);
    this.name = "XaiVoiceError";
    this.code = code;
  }
}

export class XaiVoiceClientImpl implements XaiVoiceClient {
  readonly #apiKey = process.env.XAI_API_KEY;
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;
  readonly #voiceId: string;

  constructor(
    fetchImplementation: FetchLike = fetch,
    timeoutMs = XAI_TTS_TIMEOUT_MS,
    voiceId = process.env.XAI_VOICE_ID?.trim() || XAI_TTS_DEFAULT_VOICE_ID,
  ) {
    this.#fetch = fetchImplementation;
    this.#timeoutMs = timeoutMs;
    this.#voiceId = voiceId;
  }

  get isConfigured(): boolean {
    return Boolean(this.#apiKey);
  }

  async synthesize(text: string, externalSignal?: AbortSignal): Promise<Uint8Array> {
    const apiKey = this.#apiKey;
    if (!apiKey) throw new XaiVoiceError("not_configured");
    if (externalSignal?.aborted) throw new XaiVoiceError("aborted");

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort();
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      let response: Response;
      try {
        response = await this.#fetch(XAI_TTS_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text,
            voice_id: this.#voiceId,
            language: "pt-BR",
            output_format: { codec: "pcm", sample_rate: XAI_TTS_SAMPLE_RATE },
            speed: 1.0,
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if (externalSignal?.aborted) throw new XaiVoiceError("aborted");
        if (controller.signal.aborted) throw new XaiVoiceError("timeout");
        throw new XaiVoiceError("network");
      }

      if (!response.ok) throw new XaiVoiceError("upstream");
      const contentType = response.headers.get("content-type") ?? "";
      if (!/^audio\/pcm(?:;|$)/i.test(contentType.trim())) throw new XaiVoiceError("invalid_response");
      const contentLength = response.headers.get("content-length");
      if (contentLength !== null) {
        const parsedLength = Number(contentLength);
        if (!Number.isSafeInteger(parsedLength) || parsedLength < 1 || parsedLength > XAI_TTS_MAX_AUDIO_BYTES) {
          throw new XaiVoiceError("invalid_response");
        }
      }
      let audio: Uint8Array;
      try {
        audio = await readBoundedBody(response);
      } catch (error) {
        if (error instanceof XaiVoiceError) throw error;
        if (externalSignal?.aborted) throw new XaiVoiceError("aborted");
        if (controller.signal.aborted) throw new XaiVoiceError("timeout");
        throw new XaiVoiceError("network");
      }
      if (audio.byteLength === 0 || !Number.isInteger(audio.byteLength / 2)) {
        throw new XaiVoiceError("invalid_response");
      }
      return audio;
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromCaller);
    }
  }
}

async function readBoundedBody(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) throw new XaiVoiceError("invalid_response");

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      size += value.byteLength;
      if (size > XAI_TTS_MAX_AUDIO_BYTES) {
        await reader.cancel();
        throw new XaiVoiceError("invalid_response");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const audio = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return audio;
}
