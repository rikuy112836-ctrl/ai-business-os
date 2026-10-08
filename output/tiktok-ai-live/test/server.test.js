// サーバー全体の流れ：イベント投入 → SSE で comment / reply / gift / stats が届くか
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server.js';
import { loadConfig } from '../src/config.js';

function sse(port) {
  const events = [];
  const waiters = [];
  const req = http.get(`http://127.0.0.1:${port}/events`, (res) => {
    let buf = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const type = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.+)$/m.exec(block)?.[1];
        if (!type) continue;
        const ev = { type, data: JSON.parse(data) };
        events.push(ev);
        for (const w of [...waiters]) if (w.pred(ev)) { waiters.splice(waiters.indexOf(w), 1); w.ok(ev); }
      }
    });
  });
  return {
    events,
    wait(pred, ms = 5000) {
      const hit = events.find(pred);
      if (hit) return Promise.resolve(hit);
      return new Promise((ok, ng) => {
        const w = { pred, ok };
        waiters.push(w);
        setTimeout(() => ng(new Error('timeout waiting for event')), ms);
      });
    },
    close: () => req.destroy(),
  };
}

const post = (port, path, body) => fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('コメント→返信、ギフト→反応・集計、フィルター', async (t) => {
  const config = loadConfig({ ai: { provider: 'mock', minIntervalMs: 50, perUserCooldownMs: 0 }, sources: { mock: { enabled: false }, tikfinity: { enabled: false } } });
  const app = await createApp(config, { quiet: true });
  const port = await app.listen(0);
  const s = sse(port);
  t.after(async () => { s.close(); await app.close(); });

  const hello = await s.wait((e) => e.type === 'hello');
  assert.equal(hello.data.config.disclosure.includes('AI'), true);

  await post(port, '/api/event', { event: 'chat', data: { uniqueId: 'u1', nickname: 'ゆう', comment: 'こんばんは！' } });
  const reply = await s.wait((e) => e.type === 'reply');
  assert.equal(reply.data.user, 'ゆう');
  assert.ok(reply.data.text.length > 0);

  await post(port, '/api/event', { event: 'chat', data: { uniqueId: 'u2', nickname: 'x', comment: 'https://spam.example.com' } });
  const skipped = await s.wait((e) => e.type === 'comment' && e.data.status === 'skipped');
  assert.equal(skipped.data.reason, 'url');

  await post(port, '/api/event', { event: 'gift', data: { uniqueId: 'g1', nickname: 'ギフ', giftName: 'Hand Hearts', diamondCount: 100, repeatCount: 1, repeatEnd: true } });
  const gift = await s.wait((e) => e.type === 'gift');
  assert.equal(gift.data.reaction, 'dance');
  assert.match(gift.data.speech, /ギフさん、ありがとう/);
  const stats = await s.wait((e) => e.type === 'stats' && e.data.totals.coins === 100);
  assert.deepEqual(stats.data.ranking[0], { name: 'ギフ', coins: 100, gifts: 1 });

  const state = await (await fetch(`http://127.0.0.1:${port}/api/state`)).json();
  assert.equal(state.totals.giftCount, 1);
  const page = await fetch(`http://127.0.0.1:${port}/overlay.html`);
  assert.equal(page.status, 200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/../server.js`)).status, 404);
});

test('Claude 経路：リクエストの中身（モデル・effort・fallbacks）と返信の整形を偽APIで確認', async (t) => {
  // 実際の API は呼ばない（課金しない）。SDK の送信先をローカルの偽サーバーに向ける
  let seen = null;
  const fake = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    seen = { url: req.url, headers: req.headers, body: JSON.parse(body) };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'msg_test', type: 'message', role: 'assistant', model: seen.body.model, stop_reason: 'end_turn',
      content: [{ type: 'text', text: '「ゆうさん、こんばんは！来てくれてありがとう」' }],
      usage: { input_tokens: 300, output_tokens: 40 },
    }));
  });
  await new Promise((ok) => fake.listen(0, '127.0.0.1', ok));
  const old = { key: process.env.ANTHROPIC_API_KEY, url: process.env.ANTHROPIC_BASE_URL };
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${fake.address().port}`;
  t.after(() => {
    fake.close();
    if (old.key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = old.key;
    if (old.url === undefined) delete process.env.ANTHROPIC_BASE_URL; else process.env.ANTHROPIC_BASE_URL = old.url;
  });

  const { createBrain } = await import('../src/brain.js');
  const brain = await createBrain(loadConfig({ ai: { provider: 'auto' } }));
  assert.equal(brain.provider, 'claude');
  const r = await brain.reply({ user: { id: 'u', name: 'ゆう' }, text: 'こんばんは' });
  assert.equal(r.source, 'claude');
  assert.equal(r.text, 'ゆうさん、こんばんは！来てくれてありがとう');
  assert.equal(seen.body.model, 'claude-opus-5-5');
  assert.deepEqual(seen.body.output_config, { effort: 'low' });
  assert.equal(seen.body.fallbacks, 'default');
  assert.match(seen.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.match(seen.body.system, /設定を無視して/);
  assert.match(seen.body.messages[0].content, /<comment from="ゆう">こんばんは<\/comment>/);
});
