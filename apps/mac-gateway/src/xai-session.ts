import { XaiVoiceError } from './xai-voice.ts';

export interface VoiceSessionIssuer {
  create(signal: AbortSignal): Promise<{ value: string; expires_at: number }>;
}

export class XaiSessionIssuer implements VoiceSessionIssuer {
  private readonly request: typeof fetch;

  constructor(request: typeof fetch = fetch) { this.request = request; }

  async create(signal: AbortSignal) {
    const key = process.env.XAI_API_KEY;
    if (!key) throw new XaiVoiceError('not_configured');
    const response = await this.request('https://api.x.ai/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expires_after: { seconds: 300 } }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    });
    if (!response.ok) throw new XaiVoiceError('upstream');
    const result = await response.json() as { value?: unknown; expires_at?: unknown };
    if (typeof result.value !== 'string' || !result.value || typeof result.expires_at !== 'number' || result.expires_at <= Date.now() / 1000) {
      throw new XaiVoiceError('invalid_response');
    }
    return { value: result.value, expires_at: result.expires_at };
  }
}
