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
  $('date').textContent = d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' });
}
setInterval(tick, 1000);
tick();

// ---------- 映像（普段=PC作業 / 話す=前を向いて手振り のループ + ギフト反応の差し込み） ----------
const LOOPS = ['idle', 'talk'];
const video = {
  mode: 'clips', // 'clips' | 'live'
  current: 'idle',
  base: 'idle', // 反応が終わったら戻るループ（話している間は talk）
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
        for (const l of LOOPS) if (this.els[l]) this.els[l].loop = true;
        this.show('idle');
        return;
      }
      console.warn('動画が見つからないため、仮キャラクターの直接描画に切り替えます');
    }
    this.mode = 'live';
    $('video').innerHTML = '';
    this.character = createCharacter($('video'), { photo: cfg.video?.look === 'photo' ? cfg.video.photo : null, placement: cfg.video?.photoPlacement });
    const loop = () => {
      const st = STATES[this.current];
      let t = (performance.now() - this.liveStart) / 1000;
      const looping = LOOPS.includes(this.current);
      if (!looping && t >= st.duration) {
        this.finish();
        t = 0;
      }
      this.character.render(this.current, looping ? t % st.duration : t,
        this.current === 'talk' ? { mouth: lips.level } : {});
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
      v.addEventListener('ended', () => { if (!LOOPS.includes(state)) this.finish(); });
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
        v.pause();
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

  // 話し始め・話し終わりでループを切り替える（反応中なら反応のあとに反映）
  setBase(state) {
    if (this.base === state) return;
    this.base = state;
    if (LOOPS.includes(this.current)) {
      this.current = state;
      this.liveStart = performance.now();
      if (this.mode === 'clips') this.show(state);
      lips.updateVisibility();
    }
  },

  get busy() {
    return !LOOPS.includes(this.current);
  },

  finish() {
    this.current = this.base;
    this.liveStart = performance.now();
    if (this.mode === 'clips') this.show(this.base);
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
    // 口なしで書き出した「話す」動画のときだけ口レイヤーを重ねる（他の動画は口が描き込み済み）
    $('mouth').style.display = this.cfg?.enabled && video.mode === 'clips' && video.current === 'talk' ? 'block' : 'none';
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
  async silent(text, onTick) {
    const ms = 700 + text.length * 120;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      const t = (performance.now() - t0) / 1000;
      const level = 0.5 + 0.5 * Math.sin(t * 18) * Math.sin(t * 5.3);
      lips.set(level);
      onTick((performance.now() - t0) / ms, level);
      await new Promise((r) => setTimeout(r, 50));
    }
    lips.set(0);
  },
  async voicevox(text, onTick) {
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
        const level = Math.min(1, Math.sqrt(sum / buf.length) * 6);
        lips.set(level);
        onTick(this.audio.duration ? this.audio.currentTime / this.audio.duration : 0, level);
        raf = requestAnimationFrame(meter);
      };
      this.audio.onended = () => { cancelAnimationFrame(raf); resolve(); };
      this.audio.onerror = () => { cancelAnimationFrame(raf); reject(new Error('audio error')); };
      this.audio.play().then(meter, reject);
    }).finally(() => { lips.set(0); URL.revokeObjectURL(url); });
  },
  browser(text, onTick) {
    if (!('speechSynthesis' in window) || !this.voice) return this.silent(text, onTick);
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      u.voice = this.voice;
      u.rate = 1.1;
      u.pitch = 1.2;
      let speaking = true;
      const flap = async () => {
        const t0 = performance.now();
        const est = 400 + text.length * 140;
        while (speaking) {
          const t = (performance.now() - t0) / 1000;
          const level = 0.5 + 0.5 * Math.sin(t * 17) * Math.sin(t * 4.1);
          lips.set(level);
          onTick(Math.min(0.97, (performance.now() - t0) / est), level);
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
  async speak(text, onTick = () => {}) {
    try {
      if (this.mode === 'voicevox') return await this.voicevox(text, onTick);
    } catch {
      console.warn('VOICEVOX に接続できないため、ブラウザの音声で読み上げます');
      this.mode = 'browser';
    }
    if (this.mode === 'browser') return this.browser(text, onTick);
    return this.silent(text, onTick);
  },
};

// ---------- コメントカードと返信カード（返信は読み上げに合わせて1文字ずつ出す） ----------
const WAVE_BARS = 44;
const wave = {
  history: new Array(WAVE_BARS).fill(0),
  els: [],
  last: 0,
  init() {
    const w = $('wave');
    for (let i = 0; i < WAVE_BARS; i++) w.appendChild(document.createElement('i'));
    this.els = [...w.children];
  },
  push(level) {
    const now = performance.now();
    if (now - this.last < 55) return;
    this.last = now;
    this.history.shift();
    this.history.push(level);
    this.draw();
  },
  clear() {
    this.history.fill(0);
    this.draw();
  },
  draw() {
    this.history.forEach((v, i) => {
      const el = this.els[i];
      el.style.height = `${Math.round(3 + v * 23)}px`;
      el.classList.toggle('on', v > 0.05);
    });
  },
};

function showComment(user, text, kind = 'コメント') {
  $('c-user').textContent = user;
  $('c-kind').textContent = kind;
  const t = $('c-text');
  t.textContent = text;
  t.classList.remove('muted');
  $('comment-card').classList.toggle('gift', kind !== 'コメント');
}

const speechQueue = [];
let speakingNow = false;
async function speakNext() {
  if (speakingNow || !speechQueue.length) return;
  speakingNow = true;
  const item = speechQueue.shift();
  showComment(item.user, item.comment, item.kind);
  $('r-to').textContent = item.user ? `${item.user} ＾` : '';
  const out = $('r-text');
  const chars = [...item.text];
  out.textContent = '';
  video.setBase('talk');
  try {
    await tts.speak(item.text, (progress, level) => {
      out.textContent = chars.slice(0, Math.ceil(Math.min(1, progress * 1.1) * chars.length)).join('');
      wave.push(level);
    });
  } finally {
    out.textContent = item.text;
    wave.clear();
    if (!speechQueue.length) video.setBase('idle');
    await new Promise((r) => setTimeout(r, 900));
    speakingNow = false;
    speakNext();
  }
}
function say(item) {
  // ギフトのお礼が続いたときは、まだ読んでいない古いお礼を飛ばして映像と合わせる
  if (item.isGift) {
    for (let i = speechQueue.length - 1; i >= 0; i--) if (speechQueue[i].isGift) speechQueue.splice(i, 1);
  }
  speechQueue.push(item);
  if (speechQueue.length > 4) speechQueue.splice(0, speechQueue.length - 4);
  speakNext();
}

// ---------- ギフト表とギフト反応の順番待ち ----------
function renderMenu(cfg) {
  const menu = $('menu');
  menu.innerHTML = '';
  for (const m of cfg.menu || []) {
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.reaction = m.reaction;
    const icons = document.createElement('span');
    icons.className = 'icons';
    icons.textContent = (m.icons || []).join('');
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = cfg.reactions[m.reaction]?.label || m.reaction;
    row.append(icons, label);
    menu.appendChild(row);
  }
}

const reactionQueue = [];
function nextReaction() {
  if (video.busy || !reactionQueue.length) return;
  const r = reactionQueue.shift();
  const row = document.querySelector(`#menu .row[data-reaction="${r.reaction}"]`);
  if (row) row.classList.add('active');
  video.onReactionEnd = () => {
    if (row) row.classList.remove('active');
    setTimeout(nextReaction, 250);
  };
  video.play(r.reaction);
}

// ---------- 集計表示 ----------
let CFG = null;
const fmt = (n) => n.toLocaleString('ja-JP');
const pct = (a, b) => `${Math.min(100, (a / Math.max(1, b)) * 100).toFixed(1)}%`;
function renderStats({ totals, ranking }) {
  const likesGoal = CFG?.likesGoal || 10000;
  $('likes-num').textContent = `${fmt(totals.likes)}/${fmt(likesGoal)}`;
  $('likes-bar').style.width = pct(totals.likes, likesGoal);
  const goal = CFG?.goal;
  if (goal) {
    $('goal-num').textContent = `${totals.goal}/${goal.target}`;
    $('goal-bar').style.width = pct(totals.goal, goal.target);
  }
  const counter = CFG?.counter;
  if (counter) $('counter-num').textContent = `${fmt(totals.counter)}${counter.unit}`;
  const list = $('rank-list');
  list.innerHTML = '';
  if (!ranking.length) {
    list.innerHTML = `<li class="empty">${goal ? `${goal.label.replace('今日の', '')}を贈ると載ります` : 'まだギフトはありません'}</li>`;
    return;
  }
  for (const r of ranking) {
    const li = document.createElement('li');
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = r.name;
    const v = document.createElement('span');
    v.className = 'v';
    v.textContent = goal ? `${fmt(r.value)}${goal.unit}` : `${fmt(r.value)}コイン`;
    li.append(n, v);
    list.appendChild(li);
  }
}

function applyConfig(cfg) {
  CFG = cfg;
  renderMenu(cfg);
  if (cfg.goal) {
    $('goal-icon').textContent = cfg.goal.icon || '';
    $('goal-label').textContent = cfg.goal.label;
  } else $('goal').style.display = 'none';
  if (cfg.counter) {
    $('counter-icon').textContent = cfg.counter.icon || '';
    $('counter-label').textContent = cfg.counter.label;
  } else document.querySelector('#goal .counter').style.display = 'none';
  $('r-name').textContent = cfg.character.name;
  $('voice-label').textContent = cfg.character.voiceLabel || `${cfg.character.name}の声`;
  $('r-text').textContent = `こんばんは、${cfg.character.name}です。コメントしてね`;
  const credit = cfg.tts.mode === 'voicevox' && cfg.tts.credit ? ` ／ 音声：${cfg.tts.credit}` : '';
  $('disclosure').textContent = `${cfg.disclosure}${credit}`;
  wave.init();
  wave.draw();
}

// ---------- サーバー接続 ----------
let started = false;
function connect() {
  const es = new EventSource('/events');
  es.addEventListener('hello', async (e) => {
    $('conn').classList.add('hidden');
    const d = JSON.parse(e.data);
    if (!started) applyConfig(d.config);
    renderStats(d);
    if (started) return;
    started = true;
    const cfg = d.config;
    lips.init(cfg);
    tts.init(cfg);
    await video.init(cfg);
    lips.updateVisibility();
    document.body.dataset.ready = video.mode;
  });
  es.addEventListener('reply', (e) => {
    const d = JSON.parse(e.data);
    say({ user: d.user, comment: d.comment, kind: 'コメント', text: d.text });
  });
  es.addEventListener('gift', (e) => {
    const d = JSON.parse(e.data);
    reactionQueue.push(d);
    if (reactionQueue.length > 6) reactionQueue.shift();
    nextReaction();
    say({ user: d.user, comment: d.follow ? 'フォローしてくれました' : `${d.giftName} ×${d.count} を贈りました`, kind: d.follow ? 'フォロー' : `ギフト・${d.label || ''}`, text: d.speech, isGift: true });
  });
  es.addEventListener('stats', (e) => renderStats(JSON.parse(e.data)));
  es.onerror = () => $('conn').classList.remove('hidden');
}
connect();

// テスト・確認用
window.__overlay = { video, lips, tts, wave, reactionQueue, speechQueue };
