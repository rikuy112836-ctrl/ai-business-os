// 仮キャラクター「ミライ」（このプロジェクト用のオリジナル図形。第三者の素材は使っていない）
// 1080x1920 の SVG を時間 t（秒）から決定的に描く。
// - tools/make-clips.mjs がこれをコマ撮りして待機/反応の動画（public/clips/*.webm）を作る
// - 動画が無いときはオーバーレイがこれを直接リアルタイム描画する（フォールバック）

const NS = 'http://www.w3.org/2000/svg';

export const STATES = {
  idle: { duration: 4.0, loop: true },
  heart: { duration: 2.6 },
  cheers: { duration: 3.0 },
  dance: { duration: 4.0 },
  thanks: { duration: 2.2 },
};

// 待機映像の口の位置（口パクレイヤーをこの位置に重ねる）
export const MOUTH_ANCHOR = { x: 540, y: 1078, width: 120 };

const C = {
  skin: '#ffe4d6', skinShade: '#f6c9b8', hair: '#5b3a6e', hairHi: '#7a5590',
  hoodie: '#7fd6c2', hoodieShade: '#5fbfa9', eye: '#3b2440', cheek: '#ff9fb5',
  mouth: '#c0395a', tongue: '#ff7f9a', star: '#ffd54a', juice: '#ffb347',
};

const SHOULDER_L = { x: 425, y: 1300 };
const SHOULDER_R = { x: 655, y: 1300 };
const L1 = 180, L2 = 170;

const TAU = Math.PI * 2;
const rad = (d) => (d * Math.PI) / 180;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => { v = clamp01(v); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;
// 0→1 に入って hold して 1→0 に戻る包絡
const envelope = (t, inEnd, outStart, outEnd) =>
  t < inEnd ? ease(t / inEnd) : t < outStart ? 1 : 1 - ease((t - outStart) / (outEnd - outStart));

const HEART_PATH = 'M0 -12 C -6 -26 -30 -22 -30 -4 C -30 12 -10 22 0 32 C 10 22 30 12 30 -4 C 30 -22 6 -26 0 -12 Z';
const NOTE_PATH = 'M -12 18 a 14 11 -20 1 0 0.1 0 Z M 0 14 L 0 -34 L 26 -26 L 26 -14 L 4 -20 L 4 14 Z';
const STAR_PATH = (r) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    d += (i ? 'L' : 'M') + (rr * Math.cos(a)).toFixed(1) + ' ' + (rr * Math.sin(a)).toFixed(1) + ' ';
  }
  return d + 'Z';
};

const TEMPLATE = `
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2d2357"/>
    <stop offset="0.55" stop-color="#7b5fb8"/>
    <stop offset="1" stop-color="#f3a6c8"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#fff" stop-opacity="0.55"/>
    <stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="1080" height="1920" fill="url(#bg)"/>
<g id="bokeh"></g>
<ellipse cx="540" cy="1000" rx="520" ry="520" fill="url(#glow)" opacity="0.35"/>
<g id="char">
  <g id="torso">
    <path d="M 300 2000 L 300 1920 C 300 1600 340 1330 470 1280 L 610 1280 C 740 1330 780 1600 780 1920 L 780 2000 Z" fill="${C.hoodie}"/>
    <path d="M 470 1280 C 500 1330 580 1330 610 1280 L 640 1300 C 600 1380 480 1380 440 1300 Z" fill="${C.hoodieShade}"/>
    <rect x="512" y="1240" width="56" height="60" rx="20" fill="${C.skinShade}"/>
    <line x1="505" y1="1335" x2="495" y2="1480" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
    <line x1="575" y1="1335" x2="585" y2="1480" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
    <circle cx="495" cy="1488" r="10" fill="#fff"/><circle cx="585" cy="1488" r="10" fill="#fff"/>
    <path d="M 430 1640 Q 540 1690 650 1640 L 640 1760 Q 540 1790 440 1760 Z" fill="${C.hoodieShade}" opacity="0.7"/>
  </g>
  <g id="head">
    <path d="M 290 960 C 280 700 420 640 540 640 C 660 640 800 700 790 960 L 800 1180 C 760 1220 700 1200 690 1150 L 390 1150 C 380 1200 320 1220 280 1180 Z" fill="${C.hair}"/>
    <ellipse cx="540" cy="970" rx="225" ry="235" fill="${C.skin}"/>
    <path d="M 312 900 C 330 720 450 680 540 690 C 640 680 760 730 770 905 C 740 860 700 830 660 850 C 640 800 600 790 560 830 C 520 790 470 800 450 850 C 400 830 350 850 312 900 Z" fill="${C.hair}"/>
    <path d="M 420 730 C 470 700 520 700 560 708" stroke="${C.hairHi}" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.8"/>
    <path id="clip-star" transform="translate(705 790) rotate(12)" d="${STAR_PATH(38)}" fill="${C.star}" stroke="#fff" stroke-width="5"/>
    <g id="eyeL" transform="translate(455 985)">
      <g class="open"><ellipse rx="30" ry="42" fill="${C.eye}"/><circle cx="-9" cy="-16" r="11" fill="#fff"/><circle cx="10" cy="12" r="5" fill="#fff" opacity="0.8"/></g>
      <path class="happy" d="M -30 8 Q 0 -30 30 8" stroke="${C.eye}" stroke-width="10" fill="none" stroke-linecap="round" visibility="hidden"/>
    </g>
    <g id="eyeR" transform="translate(625 985)">
      <g class="open"><ellipse rx="30" ry="42" fill="${C.eye}"/><circle cx="-9" cy="-16" r="11" fill="#fff"/><circle cx="10" cy="12" r="5" fill="#fff" opacity="0.8"/></g>
      <path class="happy" d="M -30 8 Q 0 -30 30 8" stroke="${C.eye}" stroke-width="10" fill="none" stroke-linecap="round" visibility="hidden"/>
    </g>
    <path d="M 420 925 Q 455 905 490 922" stroke="${C.hair}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M 590 922 Q 625 905 660 925" stroke="${C.hair}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <ellipse cx="405" cy="1055" rx="38" ry="22" fill="${C.cheek}" opacity="0.6"/>
    <ellipse cx="675" cy="1055" rx="38" ry="22" fill="${C.cheek}" opacity="0.6"/>
    <g id="mouth" transform="translate(${MOUTH_ANCHOR.x} ${MOUTH_ANCHOR.y})"></g>
  </g>
  <g id="armL"></g>
  <g id="armR"></g>
</g>
<g id="fx"></g>
`;

// 口の形。open: 0（閉）〜1（全開）、happy: 反応時の大きな笑顔
export function mouthMarkup(open, happy = false) {
  if (happy) {
    return `<path d="M -42 -6 Q 0 -10 42 -6 Q 36 44 0 46 Q -36 44 -42 -6 Z" fill="${C.mouth}"/>
            <path d="M -22 30 Q 0 18 22 30 Q 12 44 0 44 Q -12 44 -22 30 Z" fill="${C.tongue}"/>`;
  }
  if (open < 0.15) {
    return `<path d="M -30 -4 Q 0 22 30 -4" stroke="${C.mouth}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
  }
  const ry = 8 + 26 * open;
  return `<ellipse cx="0" cy="${ry * 0.4}" rx="${24 + 8 * open}" ry="${ry}" fill="${C.mouth}"/>
          <ellipse cx="0" cy="${ry * 0.9}" rx="${14 + 4 * open}" ry="${ry * 0.4}" fill="${C.tongue}"/>`;
}

// 口パク用レイヤーの単体 SVG（public/mouth/*.svg の元）
export function mouthSvg(open) {
  return `<svg xmlns="${NS}" viewBox="-60 -40 120 100" width="120" height="100">${mouthMarkup(open)}</svg>`;
}

function armPath(s, a1, a2) {
  const e = { x: s.x + L1 * Math.cos(rad(a1)), y: s.y + L1 * Math.sin(rad(a1)) };
  const h = { x: e.x + L2 * Math.cos(rad(a2)), y: e.y + L2 * Math.sin(rad(a2)) };
  const d = `M ${s.x} ${s.y} L ${e.x.toFixed(1)} ${e.y.toFixed(1)} L ${h.x.toFixed(1)} ${h.y.toFixed(1)}`;
  const markup = `<path d="${d}" stroke="${C.hoodieShade}" stroke-width="76" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" stroke="${C.hoodie}" stroke-width="62" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${h.x.toFixed(1)}" cy="${h.y.toFixed(1)}" r="36" fill="${C.skin}" stroke="${C.skinShade}" stroke-width="4"/>`;
  return { markup, hand: h };
}

function pose(state, t) {
  // 返り値: 腕の角度、体と頭の変形、目、口、エフェクト
  const p = {
    l: [104, 96], r: [76, 84], charX: 0, charY: 0, charRot: 0,
    headX: 0, headY: 0, headRot: 0, eyes: 'open', blink: 0, mouthHappy: false, fx: '',
  };
  const breathe = Math.sin((TAU * t) / 4);
  if (state === 'idle') {
    // 頭は固定（口パクレイヤーの位置をずらさないため）。腕と胴だけ呼吸させる
    p.l = [104 + breathe * 2, 96 + breathe * 3];
    p.r = [76 - breathe * 2, 84 - breathe * 3];
    const tb = t % 4;
    if (tb > 2.6 && tb < 2.78) p.blink = 1 - Math.abs(tb - 2.69) / 0.09;
    return p;
  }
  p.mouthHappy = true;
  if (state === 'heart') {
    const k = envelope(t, 0.45, 2.1, 2.6);
    p.r = [lerp(76, 28, k), lerp(84, -122, k)];
    p.headRot = 6 * k;
    p.eyes = k > 0.5 ? 'wink' : 'open';
    const hand = armPath(SHOULDER_R, ...p.r).hand;
    let fx = '';
    if (k > 0.6) {
      fx += `<g transform="translate(${hand.x - 8} ${hand.y - 70}) scale(${1 + 0.1 * Math.sin(TAU * t * 2)})"><path d="${HEART_PATH}" fill="#ff4f86" stroke="#fff" stroke-width="5"/></g>`;
    }
    for (let i = 0; i < 7; i++) {
      const st = 0.5 + i * 0.22;
      const u = (t - st) / 1.3;
      if (u <= 0 || u >= 1) continue;
      const x = hand.x + 70 + Math.sin(i * 1.9 + u * 5) * 50 + (i % 3) * 30;
      const y = hand.y - 100 - u * 520;
      fx += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(0.6 + 0.5 * Math.sin(i)) * (1 - u * 0.3)})" opacity="${(1 - u).toFixed(2)}"><path d="${HEART_PATH}" fill="${i % 2 ? '#ff7aa8' : '#ffb3cf'}"/></g>`;
    }
    p.fx = fx;
    return p;
  }
  if (state === 'cheers') {
    const k = envelope(t, 0.6, 2.4, 3.0);
    const clink = t > 0.8 && t < 1.8 ? Math.sin(((t - 0.8) / 1.0) * Math.PI * 3) * 8 : 0;
    p.r = [lerp(76, 18, k), lerp(84, -78, k) + clink];
    p.headRot = -4 * k;
    p.eyes = t > 0.8 && t < 2.2 ? 'happy' : 'open';
    const hand = armPath(SHOULDER_R, ...p.r).hand;
    const tilt = clink * 1.5;
    let fx = `<g transform="translate(${hand.x.toFixed(1)} ${(hand.y - 40).toFixed(1)}) rotate(${tilt.toFixed(1)})">
      <path d="M -40 -70 L 40 -70 L 32 50 Q 0 62 -32 50 Z" fill="#ffffff" opacity="0.55" stroke="#fff" stroke-width="5"/>
      <path d="M -36 -30 L 36 -30 L 31 46 Q 0 56 -31 46 Z" fill="${C.juice}"/>
      <circle cx="-12" cy="0" r="6" fill="#fff" opacity="0.8"/><circle cx="10" cy="20" r="4" fill="#fff" opacity="0.8"/>
      <rect x="10" y="-110" width="10" height="90" rx="5" fill="#ff6fa3" transform="rotate(14)"/>
    </g>`;
    if (t > 0.8 && t < 2.0) {
      const u = (t - 0.8) / 1.2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        const r = 80 + u * 160;
        fx += `<g transform="translate(${(hand.x + Math.cos(a) * r).toFixed(1)} ${(hand.y - 110 + Math.sin(a) * r).toFixed(1)})" opacity="${(1 - u).toFixed(2)}"><path d="${STAR_PATH(22)}" fill="${C.star}"/></g>`;
      }
    }
    p.fx = fx;
    return p;
  }
  if (state === 'dance') {
    const k = envelope(t, 0.3, 3.6, 4.0);
    const beat = (TAU * t) / 1.0;
    p.charX = 36 * Math.sin(beat) * k;
    p.charY = -26 * Math.abs(Math.sin(beat)) * k;
    p.charRot = 3 * Math.sin(beat) * k;
    p.headRot = 8 * Math.sin(beat + 0.6) * k;
    p.l = [lerp(104, 205 + 18 * Math.sin(beat * 2), k), lerp(96, 245 + 30 * Math.sin(beat * 2 + 1), k)];
    p.r = [lerp(76, -25 - 18 * Math.sin(beat * 2), k), lerp(84, -65 - 30 * Math.sin(beat * 2 + 1), k)];
    p.eyes = Math.sin(beat) > 0 ? 'happy' : 'open';
    let fx = '';
    for (let i = 0; i < 6; i++) {
      const u = ((t * 0.6 + i / 6) % 1);
      const side = i % 2 ? 1 : -1;
      const x = 540 + side * (300 + 60 * Math.sin(u * TAU + i));
      const y = 1300 - u * 700;
      fx += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(side * 12).toFixed(0)}) scale(1.6)" opacity="${(Math.sin(u * Math.PI) * k).toFixed(2)}"><path d="${NOTE_PATH}" fill="${i % 3 ? '#ffffff' : C.star}"/></g>`;
    }
    p.fx = fx;
    return p;
  }
  if (state === 'thanks') {
    const k = envelope(t, 0.5, 1.6, 2.2);
    p.charY = 18 * k;
    p.headY = 46 * k;
    p.headRot = 0;
    p.l = [lerp(104, 96, k), lerp(96, 40, k)];
    p.r = [lerp(76, 84, k), lerp(84, 140, k)];
    p.eyes = k > 0.3 ? 'happy' : 'open';
    return p;
  }
  return p;
}

function bokeh(t) {
  let s = '';
  for (let i = 0; i < 14; i++) {
    const x = (i * 197) % 1080;
    const y = 160 + ((i * 331) % 1500) + 18 * Math.sin((TAU * t) / 4 + i);
    const r = 14 + ((i * 7) % 30);
    s += `<circle cx="${x}" cy="${y.toFixed(1)}" r="${r}" fill="#fff" opacity="${(0.08 + (i % 4) * 0.04).toFixed(2)}"/>`;
  }
  return s;
}

export function createCharacter(container) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1080 1920');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.innerHTML = TEMPLATE;
  container.appendChild(svg);
  const $ = (id) => svg.getElementById(id);
  const el = {
    bokeh: $('bokeh'), char: $('char'), head: $('head'), mouth: $('mouth'),
    armL: $('armL'), armR: $('armR'), fx: $('fx'), eyeL: $('eyeL'), eyeR: $('eyeR'),
  };

  function setEye(g, mode, blink) {
    const open = g.querySelector('.open');
    const happy = g.querySelector('.happy');
    open.setAttribute('visibility', mode === 'open' ? 'visible' : 'hidden');
    happy.setAttribute('visibility', mode === 'open' ? 'hidden' : 'visible');
    open.setAttribute('transform', `scale(1 ${(1 - 0.88 * blink).toFixed(2)})`);
  }

  // mouth: null = 口を描かない（口パクレイヤーを上に重ねる待機動画用）、数値 = 開き具合
  function render(state, t, opts = {}) {
    const p = pose(state, t);
    el.bokeh.innerHTML = bokeh(t);
    el.char.setAttribute('transform', `translate(${p.charX.toFixed(1)} ${p.charY.toFixed(1)}) rotate(${p.charRot.toFixed(2)} 540 1500)`);
    el.head.setAttribute('transform', `translate(${p.headX} ${p.headY.toFixed(1)}) rotate(${p.headRot.toFixed(2)} 540 1200)`);
    const a = armPath(SHOULDER_L, ...p.l);
    const b = armPath(SHOULDER_R, ...p.r);
    el.armL.innerHTML = a.markup;
    el.armR.innerHTML = b.markup;
    setEye(el.eyeL, p.eyes === 'happy' ? 'happy' : 'open', p.blink);
    setEye(el.eyeR, p.eyes === 'open' ? 'open' : 'happy', p.blink);
    if (opts.mouth === null) el.mouth.innerHTML = '';
    else el.mouth.innerHTML = mouthMarkup(opts.mouth ?? 0, p.mouthHappy && opts.mouth == null);
    el.fx.innerHTML = p.fx;
  }

  return { svg, render };
}
