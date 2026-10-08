// TikTok AI キャラクターライブ 試作サーバー
//   node server.js  →  http://localhost:8787/control.html（操作パネル）
//                      http://localhost:8787/overlay.html（OBS / LIVE Studio に取り込む 1080x1920 画面）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, ROOT } from './src/config.js';
import { normalizeEvent, pickReaction, createBoard } from './src/gifts.js';
import { createBrain, screenComment } from './src/brain.js';
import { startMockSource } from './src/sources/mock.js';
import { startTikfinitySource } from './src/sources/tikfinity.js';

const PUBLIC = path.join(ROOT, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webm': 'video/webm',
  '.mp4': 'video/mp4', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon',
};

export async function createApp(config, { quiet = false } = {}) {
  const clients = new Set();
  const logs = [];
  const log = (msg) => {
    const line = `[${new Date().toLocaleTimeString('ja-JP')}] ${msg}`;
    logs.push(line);
    if (logs.length > 200) logs.shift();
    if (!quiet) console.log(line);
    send('log', { line });
  };
  function send(type, data) {
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(payload);
  }

  const board = createBoard();
  const brain = await createBrain(config, { log });
  const status = { provider: brain.provider, model: brain.provider === 'claude' ? config.ai.model : null, mock: false, tikfinity: 'off' };
  log(`返信エンジン: ${brain.provider === 'claude' ? `Claude（${config.ai.model}）` : '模擬返信（APIキー未設定・無料）'}`);

  // ---- コメント → AI 返信のキュー ----
  const queue = [];
  const lastReplyAt = new Map();
  let busy = false;
  let lastDone = 0;
  let seq = 0;

  function enqueueComment(ev) {
    const id = ++seq;
    board.addComment();
    const reason = screenComment(ev.text, config)
      || (Date.now() - (lastReplyAt.get(ev.user.id) || 0) < config.ai.perUserCooldownMs ? 'cooldown' : null);
    send('comment', { id, user: ev.user.name, text: ev.text, status: reason ? 'skipped' : 'queued', reason });
    if (reason) return;
    const priority = (board.isTopGifter(ev.user.id) ? 2 : 0) + (/[?？]/.test(ev.text) ? 1 : 0);
    queue.push({ id, ev, priority, at: Date.now() });
    while (queue.length > config.ai.maxQueue) {
      // 優先度が低く古いものから捨てる（流れの速いコメント欄で返信が遅れすぎないように）
      let worst = 0;
      for (let i = 1; i < queue.length; i++) {
        if (queue[i].priority < queue[worst].priority) worst = i;
      }
      const [dropped] = queue.splice(worst, 1);
      send('comment', { id: dropped.id, user: dropped.ev.user.name, text: dropped.ev.text, status: 'skipped', reason: 'queue-full' });
    }
    pump();
  }

  async function pump() {
    if (busy || !queue.length) return;
    const wait = config.ai.minIntervalMs - (Date.now() - lastDone);
    if (wait > 0) {
      setTimeout(pump, wait);
      return;
    }
    busy = true;
    queue.sort((a, b) => b.priority - a.priority || b.at - a.at);
    const item = queue.shift();
    try {
      lastReplyAt.set(item.ev.user.id, Date.now());
      const r = await brain.reply(item.ev);
      send('reply', { id: item.id, user: item.ev.user.name, comment: item.ev.text, text: r.text, source: r.source, ms: r.ms });
      const tokens = r.usage ? ` 入力${r.usage.input_tokens}/出力${r.usage.output_tokens}トークン` : '';
      log(`返信(${r.source} ${r.ms}ms${tokens}) ${item.ev.user.name}「${item.ev.text}」→「${r.text}」`);
    } finally {
      busy = false;
      lastDone = Date.now();
      if (queue.length) setTimeout(pump, config.ai.minIntervalMs);
    }
  }

  // ---- イベントの入口（模擬・TikFinity・操作パネル共通） ----
  function handleRaw(raw, origin = 'panel') {
    const ev = normalizeEvent(raw);
    if (!ev) return null;
    if (ev.type === 'chat') enqueueComment(ev);
    else if (ev.type === 'gift') {
      board.addGift(ev);
      const reaction = pickReaction(config, ev);
      const r = config.reactions[reaction] || {};
      const speech = `${ev.user.name.slice(0, 10)}さん、ありがとう！${r.speech || ''}`;
      send('gift', { user: ev.user.name, giftName: ev.giftName, count: ev.count, coins: ev.coins, reaction, label: r.label, emoji: r.emoji, speech });
      log(`ギフト(${origin}) ${ev.user.name} ${ev.giftName}×${ev.count}（${ev.coins}コイン）→ ${r.label || reaction}`);
    } else if (ev.type === 'follow') {
      board.addFollow();
      const reaction = config.followReaction;
      send('gift', { user: ev.user.name, giftName: 'フォロー', count: 1, coins: 0, reaction, label: config.reactions[reaction]?.label, emoji: '➕', speech: `${ev.user.name.slice(0, 10)}さん、フォローありがとう！`, follow: true });
    } else if (ev.type === 'like') board.addLike(ev.count);
    else return ev;
    send('stats', board.snapshot());
    return ev;
  }

  // ---- 入力ソース ----
  let mock = null;
  function setMock(on) {
    if (on && !mock) mock = startMockSource({ intervalMs: config.sources.mock.intervalMs, onEvent: (e) => handleRaw(e, 'mock') });
    if (!on && mock) { mock.stop(); mock = null; }
    status.mock = !!mock;
    send('status', status);
  }
  setMock(!!config.sources.mock.enabled);
  let tik = null;
  if (config.sources.tikfinity.enabled) {
    tik = startTikfinitySource({
      url: config.sources.tikfinity.url, log,
      onEvent: (e) => handleRaw(e, 'tikfinity'),
      onStatus: (s) => { status.tikfinity = s; send('status', status); },
    });
    status.tikfinity = 'connecting';
  }

  // ---- 読み上げ（VOICEVOX をサーバー経由で呼ぶ。ブラウザから直接だと CORS で止まるため） ----
  async function voicevox(text) {
    const base = config.tts.voicevoxUrl.replace(/\/$/, '');
    const speaker = config.tts.speaker;
    const q = await fetch(`${base}/audio_query?speaker=${speaker}&text=${encodeURIComponent(text)}`, { method: 'POST', signal: AbortSignal.timeout(8000) });
    if (!q.ok) throw new Error(`audio_query ${q.status}`);
    const query = await q.json();
    const s = await fetch(`${base}/synthesis?speaker=${speaker}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(query), signal: AbortSignal.timeout(15000),
    });
    if (!s.ok) throw new Error(`synthesis ${s.status}`);
    return Buffer.from(await s.arrayBuffer());
  }

  function publicConfig() {
    return {
      character: { name: config.character.name },
      tts: { mode: config.tts.mode, credit: config.tts.credit, browserVoiceHint: config.tts.browserVoiceHint },
      video: config.video, reactions: config.reactions, disclosure: config.disclosure,
    };
  }

  async function readBody(req) {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 1e5) throw new Error('body too large');
    }
    return body ? JSON.parse(body) : {};
  }

  const json = (res, code, data) => {
    res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
        res.write(`event: hello\ndata: ${JSON.stringify({ config: publicConfig(), status, ...board.snapshot() })}\n\n`);
        clients.add(res);
        const ka = setInterval(() => res.write(': keepalive\n\n'), 15000);
        req.on('close', () => { clearInterval(ka); clients.delete(res); });
        return;
      }
      if (url.pathname === '/api/state') return json(res, 200, { status, ...board.snapshot(), queue: queue.length, logs: logs.slice(-50) });
      if (url.pathname === '/api/config') return json(res, 200, publicConfig());
      if (url.pathname === '/api/event' && req.method === 'POST') {
        const ev = handleRaw(await readBody(req), 'panel');
        return json(res, ev ? 200 : 400, { ok: !!ev, type: ev?.type });
      }
      if (url.pathname === '/api/mock' && req.method === 'POST') {
        setMock(!!(await readBody(req)).enabled);
        return json(res, 200, { ok: true, mock: status.mock });
      }
      if (url.pathname === '/api/reset' && req.method === 'POST') {
        board.reset();
        send('stats', board.snapshot());
        return json(res, 200, { ok: true });
      }
      if (url.pathname === '/api/tts/status') {
        try {
          const v = await fetch(`${config.tts.voicevoxUrl.replace(/\/$/, '')}/version`, { signal: AbortSignal.timeout(2000) });
          return json(res, 200, { voicevox: v.ok, version: v.ok ? await v.json() : null });
        } catch {
          return json(res, 200, { voicevox: false });
        }
      }
      if (url.pathname === '/api/tts') {
        const text = (url.searchParams.get('text') || '').slice(0, 100);
        if (!text) return json(res, 400, { error: 'text required' });
        try {
          const wav = await voicevox(text);
          res.writeHead(200, { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' });
          return res.end(wav);
        } catch (e) {
          return json(res, 503, { error: `VOICEVOX に接続できません: ${e.message}` });
        }
      }
      // 静的ファイル
      const rel = decodeURIComponent(url.pathname === '/' ? '/control.html' : url.pathname);
      const file = path.normalize(path.join(PUBLIC, rel));
      if (!file.startsWith(PUBLIC + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        return json(res, 404, { error: 'not found' });
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      fs.createReadStream(file).pipe(res);
    } catch (e) {
      log(`エラー: ${e.message}`);
      if (!res.headersSent) json(res, 500, { error: e.message });
    }
  });

  return {
    server,
    handleRaw,
    board,
    listen: (port = config.port, host = '127.0.0.1') => new Promise((ok) => server.listen(port, host, () => ok(server.address().port))),
    close: () => {
      setMock(false);
      if (tik) tik.stop();
      for (const res of clients) res.end();
      return new Promise((ok) => server.close(ok));
    },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  if (process.argv.includes('--mock')) config.sources.mock.enabled = true;
  if (process.argv.includes('--tikfinity')) config.sources.tikfinity.enabled = true;
  const app = await createApp(config);
  const port = await app.listen(Number(process.env.PORT) || config.port);
  console.log(`\n操作パネル : http://localhost:${port}/control.html`);
  console.log(`配信用画面 : http://localhost:${port}/overlay.html  （OBS ブラウザソース 1080x1920）\n`);
}
