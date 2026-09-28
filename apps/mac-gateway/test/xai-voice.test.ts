import assert from 'node:assert/strict';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createGateway } from '../src/gateway.ts';
import { XaiSessionIssuer } from '../src/xai-session.ts';
import { XaiVoiceClientImpl, XaiVoiceError } from '../src/xai-voice.ts';
import type { TerminalAgent } from '../../../packages/terminal-agents/src/types.ts';

const agent: TerminalAgent = { async sendTurn() { throw new Error('Must not run agents for voice'); }, async interrupt() {}, close() {} };

test('voice endpoints authenticate, keep PCM contract, and expose only ephemeral credentials', async t => {
  let requests = 0;
  const gateway = createGateway({
    token: 'test-token', agents: { codex: agent, claude: agent, grok: agent },
    xaiVoice: { isConfigured: true, async synthesize(text) { requests++; assert.equal(text, 'Olá'); return new Uint8Array([0, 1, 2, 3]); } },
    voiceSession: { async create() { requests++; return { value: 'ephemeral-only', expires_at: Math.floor(Date.now() / 1000) + 300 }; } },
  });
  t.after(() => gateway.close());
  await new Promise<void>(r => gateway.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(gateway.server.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown, token = 'test-token') => fetch(base + path, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  for (const path of ['/v1/speak', '/v1/voice/session']) assert.equal((await post(path, {}, 'wrong')).status, 401);
  assert.equal(requests, 0);
  assert.equal((await post('/v1/speak', { text: ' ' })).status, 400);
  assert.equal((await post('/v1/speak', { text: 'a'.repeat(15001) })).status, 400);
  const audio = await post('/v1/speak', { text: 'Olá' });
  assert.equal(audio.status, 200);
  assert.equal(audio.headers.get('x-audio-format'), 'pcm_s16le');
  assert.equal(audio.headers.get('x-audio-sample-rate'), '16000');
  assert.equal(audio.headers.get('x-audio-channels'), '1');
  assert.equal((await audio.arrayBuffer()).byteLength, 4);
  const response = await post('/v1/voice/session', {});
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const secret = await response.json();
  assert.equal(secret.value, 'ephemeral-only');
  assert.equal(secret.voice, 'zagan');
  assert.deepEqual(Object.keys(secret).sort(), ['expires_at', 'value', 'voice']);
  assert.equal(requests, 2);
});

test('xAI synthesis uses Zagan and rejects malformed PCM without leaking upstream errors', async t => {
  const originalKey = process.env.XAI_API_KEY;
  const originalVoice = process.env.XAI_VOICE_ID;
  process.env.XAI_API_KEY = 'fake-key';
  delete process.env.XAI_VOICE_ID;
  t.after(() => {
    if (originalKey === undefined) delete process.env.XAI_API_KEY; else process.env.XAI_API_KEY = originalKey;
    if (originalVoice === undefined) delete process.env.XAI_VOICE_ID; else process.env.XAI_VOICE_ID = originalVoice;
  });
  let captured: Record<string, unknown> = {};
  const client = new XaiVoiceClientImpl(async (_url, init) => {
    captured = JSON.parse(String(init?.body));
    return new Response(new Uint8Array([0, 1]), { headers: { 'Content-Type': 'audio/pcm' } });
  });
  assert.equal((await client.synthesize('Olá')).byteLength, 2);
  assert.equal(captured.voice_id, 'zagan');
  assert.deepEqual(captured.output_format, { codec: 'pcm', sample_rate: 16000 });
  for (const response of [
    new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'audio/pcm' } }),
    new Response('secret upstream detail', { status: 500 }),
    new Response('not audio', { headers: { 'Content-Type': 'application/json' } }),
  ]) {
    const invalid = new XaiVoiceClientImpl(async () => response);
    await assert.rejects(invalid.synthesize('Olá'), error => error instanceof XaiVoiceError && !error.message.includes('secret'));
  }
  const issuer = new XaiSessionIssuer(async (_url, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), { expires_after: { seconds: 300 } });
    return Response.json({ value: 'ephemeral', expires_at: Math.floor(Date.now() / 1000) + 300 });
  });
  assert.equal((await issuer.create(new AbortController().signal)).value, 'ephemeral');
  const invalidIssuer = new XaiSessionIssuer(async () => Response.json({ value: 'expired', expires_at: 1 }));
  await assert.rejects(invalidIssuer.create(new AbortController().signal), XaiVoiceError);
});

test('voice handles missing credentials and concurrent synthesis without blocking task endpoints', async t => {
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>(r => entered = r);
  const gateway = createGateway({
    token: 'test-token', agents: { codex: agent, claude: agent, grok: agent },
    xaiVoice: { isConfigured: true, async synthesize() { entered(); await new Promise<void>(r => release = r); return new Uint8Array([0, 0]); } },
    voiceSession: { async create() { throw new XaiVoiceError('not_configured'); } },
  });
  t.after(() => gateway.close());
  await new Promise<void>(r => gateway.server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(gateway.server.address() as AddressInfo).port}`;
  const post = (path: string) => fetch(base + path, { method: 'POST', headers: { Authorization: 'Bearer test-token' }, body: '{"text":"Olá"}' });
  assert.equal((await post('/v1/voice/session')).status, 503);
  const pending = post('/v1/speak');
  await started;
  assert.equal((await post('/v1/speak')).status, 409);
  assert.equal((await fetch(base + '/healthz')).status, 200);
  release();
  assert.equal((await pending).status, 200);
});
