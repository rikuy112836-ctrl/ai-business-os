// 配信用画面（1080x1920）。サーバーの /events（SSE）を受けて、映像・吹き出し・読み上げ・集計表示を切り替える。
//   ?mute=1  音を出さない（操作パネルのプレビュー用。口パクだけ時間で動かす）
//   ?live=1  動画ファイルを使わず、仮キャラクターを直接描画する
import { createCharacter, STATES } from './character.js';

const q = new URLSearchParams(location.search);
const MUTE = q.get('mute') === '1';
const $ = (id) => document.getElementById(id);

// ---------- 画面サイズ合わせ ----------
function fit() {
  const s = Math.min(innerWidth / 1080, innerHeight / 1920);
  const stage = $('stage');
  stage.style.transform = `scale(${s})`;
  stage.style.left = `${(innerWidth - 1080 * s) / 2}px`;
}
addEventListener('resize', fit);
fit();

// ---------- 時計 ----------
function tick() {
  const d = new Date();
  $('time').textContent = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  $('date').textContent = d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
}
setInterval(tick, 1000);
tick();

// ---------- 映像（待機動画のループ + 反応動画の差し込み） ----------
const video = {
  mode: 'clips', // 'clips' | 'live'
  current: 'idle',
  els: {},
  character: null,
  liveStart: 0,
  onReactionEnd: null,

  async init(cfg) {
    const clips = cfg.video?.clips || {};
    const forceLive = q.get('live') === '1';
    if (!forceLive && clips.idle) {
      const ok = await Promise.all(Object.entries(clips).map(([state, src]) => this.load(state, src)));
      if (ok.every(Boolean)) {
        this.els.idle.loop = true;
        this.show('idle');
        return;
      }
      console.warn('動画が見つからないため、仮キャラクターの直接描画に切り替えます');
    }
    this.mode = 'live';
    $('video').innerHTML = '';
    this.character = createCharacter($('video'));
    const loop = () => {
      const st = STATES[this.current];
      let t = (performance.now() - this.liveStart) / 1000;
      if (this.current !== 'idle' && t >= st.duration) {
        this.finish();
        t = 0;
      }
      this.character.render(this.current, this.current === 'idle' ? t % STATES.idle.duration : t,
        this.current === 'idle' ? { mouth: lips.level } : {});
      requestAnimationFrame(loop);
    };
    loop();
  },

  load(state, src) {
    return new Promise((resolve) => {
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.src = src;
      v.dataset.state = state;
      v.addEventListener('canplaythrough', () => resolve(true), { once: true });
      v.addEventListener('error', () => resolve(false), { once: true });
      v.addEventListener('ended', () => { if (state !== 'idle') this.finish(); });
      $('video').appendChild(v);
      this.els[state] = v;
    });
  },

  show(state) {
    for (const [s, v] of Object.entries(this.els)) {
      if (s === state) {
        v.currentTime = 0;
        v.play().catch(() => {});
        v.classList.add('on');
      } else {
        v.classList.remove('on');
        if (s !== 'idle') v.pause();
      }
    }
  },

  play(state) {
    if (!STATES[state]) state = 'thanks';
    this.current = state;
    this.liveStart = performance.now();
    if (this.mode === 'clips') this.show(state);
    lips.updateVisibility();
  },

  finish() {
    this.current = 'idle';
    this.liveStart = performance.now();
    if (this.mode === 'clips') this.show('idle');
    lips.updateVisibility();
    const cb = this.onReactionEnd;
    this.onReactionEnd = null;
    if (cb) cb();
  },
};

// ---------- 口パク（いまは音量に合わせて3段階の口画像を切り替える。後でリアルタイム口パクに差し替え可能） ----------
const lips = {
  level: 0,
  cfg: null,
  imgs: {},
  init(cfg) {
    this.cfg = cfg.video?.mouthLayer;
    if (!this.cfg?.enabled) return;
    for (const [k, src] of Object.entries(this.cfg.images)) {
      const im = new Image();
      im.src = src;
      this.imgs[k] = src;
    }
    const m = $('mouth');
    m.style.width = `${this.cfg.width}px`;
    m.src = this.imgs.closed;
    // 画像の中心を口の位置に合わせる（mouth/*.svg は幅120・高さ100、口の基準点は上から40%）
    m.style.left = `${this.cfg.x - this.cfg.width / 2}px`;
    m.style.top = `${this.cfg.y - this.cfg.width * (40 / 120)}px`;
  },
  set(level) {
    this.level = level;
    if (!this.cfg?.enabled || video.mode !== 'clips') return;
    const k = level > 0.55 ? 'open' : level > 0.2 ? 'half' : 'closed';
    const m = $('mouth');
    if (m.dataset.k !== k) { m.src = this.imgs[k]; m.dataset.k = k; }
  },
  updateVisibility() {
    // 反応動画には笑顔の口が描き込まれているので、待機中だけ口レイヤーを出す
    $('mouth').style.display = this.cfg?.enabled && video.mode === 'clips' && video.current === 'idle' ? 'block' : 'none';
  },
};

// ---------- 読み上げ ----------
const tts = {
  mode: 'browser',
  ctx: null,
  analyser: null,
  audio: new Audio(),
  unlocked: false,
  voice: null,
  init(cfg) {
    this.mode = MUTE ? 'silent' : cfg.tts?.mode || 'browser';
    const hint = cfg.tts?.browserVoiceHint || '';
    const pickVoice = () => {
      const vs = speechSynthesis.getVoices().filter((v) => v.lang?.startsWith('ja'));
      this.voice = vs.find((v) => v.name.includes(hint)) || vs[0] || null;
    };
    if ('speechSynthesis' in window) {
      pickVoice();
      speechSynthesis.onvoiceschanged = pickVoice;
    }
    if (!MUTE) {
      // OBS では自動再生できる。通常のブラウザではクリックが必要なことがある
      const btn = $('audio-unlock');
      const unlock = () => { this.ensureCtx(); this.ctx.resume(); btn.classList.add('hidden'); this.unlocked = true; };
      btn.onclick = unlock;
      addEventListener('pointerdown', unlock, { once: true });
      setTimeout(() => {
        this.ensureCtx();
        if (this.ctx.state !== 'running') btn.classList.remove('hidden');
      }, 600);
    }
  },
  ensureCtx() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaElementSource(this.audio);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  },
  // 文字数から話す時間を見積もり、口を動かす（音が出せない時の代わり）
  async silent(text) {
    const ms = 700 + text.length * 120;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      const t = (performance.now() - t0) / 1000;
      lips.set(0.5 + 0.5 * Math.sin(t * 18) * Math.sin(t * 5.3));
      await new Promise((r) => setTimeout(r, 50));
    }
    lips.set(0);
  },
  async voicevox(text) {
    const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}`);
    if (!res.ok) throw new Error('voicevox unavailable');
    const url = URL.createObjectURL(await res.blob());
    this.ensureCtx();
    if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {});
    this.audio.src = url;
    const buf = new Uint8Array(this.analyser.fftSize);
    await new Promise((resolve, reject) => {
      let raf;
      const meter = () => {
        this.analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (const b of buf) sum += ((b - 128) / 128) ** 2;
        lips.set(Math.min(1, Math.sqrt(sum / buf.length) * 6));
        raf = requestAnimationFrame(meter);
      };
      this.audio.onended = () => { cancelAnimationFrame(raf); resolve(); };
      this.audio.onerror = () => { cancelAnimationFrame(raf); reject(new Error('audio error')); };
      this.audio.play().then(meter, reject);
    }).finally(() => { lips.set(0); URL.revokeObjectURL(url); });
  },
  browser(text) {
    if (!('speechSynthesis' in window) || !this.voice) return this.silent(text);
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      u.voice = this.voice;
      u.rate = 1.1;
      u.pitch = 1.2;
      let speaking = true;
      const flap = async () => {
        const t0 = performance.now();
        while (speaking) {
          const t = (performance.now() - t0) / 1000;
          lips.set(0.5 + 0.5 * Math.sin(t * 17) * Math.sin(t * 4.1));
          await new Promise((r) => setTimeout(r, 50));
        }
        lips.set(0);
      };
      const done = () => { speaking = false; resolve(); };
      u.onend = done;
      u.onerror = done;
      setTimeout(done, 1500 + text.length * 250); // 読み上げが止まった場合の保険
      speechSynthesis.speak(u);
      flap();
    });
  },
  async speak(text) {
    try {
      if (this.mode === 'voicevox') return await this.voicevox(text);
    } catch {
      console.warn('VOICEVOX に接続できないため、ブラウザの音声で読み上げます');
      this.mode = 'browser';
    }
    if (this.mode === 'browser') return this.browser(text);
    return this.silent(text);
  },
};

// ---------- 吹き出しと読み上げの順番待ち ----------
const speechQueue = [];
let speakingNow = false;
async function speakNext() {
  if (speakingNow || !speechQueue.length) return;
  speakingNow = true;
  const item = speechQueue.shift();
  const b = $('bubble');
  $('bubble-from').textContent = item.from;
  $('bubble-text').textContent = item.text;
  b.classList.toggle('gift', item.kind === 'gift');
  b.classList.remove('hidden');
  try {
    await tts.speak(item.text);
  } finally {
    await new Promise((r) => setTimeout(r, 1200));
    if (!speechQueue.length) b.classList.add('hidden');
    speakingNow = false;
    speakNext();
  }
}
function say(item) {
  // ギフトのお礼が続いたときは、まだ読んでいない古いお礼を飛ばして映像と合わせる
  if (item.kind === 'gift') {
    for (let i = speechQueue.length - 1; i >= 0; i--) if (speechQueue[i].kind === 'gift') speechQueue.splice(i, 1);
  }
  speechQueue.push(item);
  if (speechQueue.length > 4) speechQueue.splice(0, speechQueue.length - 4);
  speakNext();
}

// ---------- ギフト反応の順番待ち ----------
const reactionQueue = [];
function nextReaction() {
  if (video.current !== 'idle' || !reactionQueue.length) return;
  const r = reactionQueue.shift();
  $('banner-emoji').textContent = r.emoji || '🎁';
  $('banner-title').textContent = `${r.label || ''}！`;
  $('banner-sub').textContent = r.follow ? `${r.user}さん フォロー` : `${r.user}さん ${r.giftName} ×${r.count}`;
  const banner = $('banner');
  banner.classList.remove('hidden');
  banner.style.animation = 'none';
  void banner.offsetWidth;
  banner.style.animation = '';
  video.onReactionEnd = () => {
    banner.classList.add('hidden');
    setTimeout(nextReaction, 250);
  };
  video.play(r.reaction);
}

// ---------- 集計表示 ----------
const fmt = (n) => (n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n.toLocaleString('ja-JP'));
function renderStats({ totals, ranking }) {
  $('gifts').textContent = fmt(totals.giftCount);
  $('coins').textContent = fmt(totals.coins);
  $('likes').textContent = fmt(totals.likes);
  const list = $('rank-list');
  list.innerHTML = '';
  if (!ranking.length) {
    list.innerHTML = '<li class="empty">まだギフトはありません</li>';
    return;
  }
  for (const r of ranking) {
    const li = document.createElement('li');
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = r.name;
    const c = document.createElement('span');
    c.className = 'c';
    c.textContent = fmt(r.coins);
    li.append(n, c);
    list.appendChild(li);
  }
}

// ---------- サーバー接続 ----------
let started = false;
function connect() {
  const es = new EventSource('/events');
  es.addEventListener('hello', async (e) => {
    $('conn').classList.add('hidden');
    const d = JSON.parse(e.data);
    renderStats(d);
    if (started) return;
    started = true;
    const cfg = d.config;
    $('disclosure').textContent = cfg.disclosure;
    $('credit').textContent = `キャラクター：${cfg.character.name}（オリジナル・仮素材）${cfg.tts.mode === 'voicevox' && cfg.tts.credit ? ` ／ 音声：${cfg.tts.credit}` : ''}`;
    lips.init(cfg);
    tts.init(cfg);
    await video.init(cfg);
    lips.updateVisibility();
    document.body.dataset.ready = video.mode;
  });
  es.addEventListener('reply', (e) => {
    const d = JSON.parse(e.data);
    say({ from: `${d.user}「${d.comment}」`, text: d.text, kind: 'reply' });
  });
  es.addEventListener('gift', (e) => {
    const d = JSON.parse(e.data);
    reactionQueue.push(d);
    if (reactionQueue.length > 6) reactionQueue.shift();
    nextReaction();
    say({ from: d.follow ? `${d.user}さんがフォロー` : `${d.user}さんから ${d.giftName} ×${d.count}`, text: d.speech, kind: 'gift' });
  });
  es.addEventListener('stats', (e) => renderStats(JSON.parse(e.data)));
  es.onerror = () => $('conn').classList.remove('hidden');
}
connect();

// テスト・確認用
window.__overlay = { video, lips, tts, reactionQueue, speechQueue };
