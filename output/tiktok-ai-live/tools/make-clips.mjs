// 仮キャラクターの待機/反応動画（public/clips/*.webm）と口パク画像（public/mouth/*.svg）を作る。
// 本番のキャラクター動画ができたら、このスクリプトは使わずに public/clips/ に同じ名前で置けばよい。
//   必要: ffmpeg、Playwright（npm i -D playwright && npx playwright install chromium）
//   実行: node tools/make-clips.mjs [state...]            → public/clips/（仮キャラクター）
//         node tools/make-clips.mjs --photo [state...]    → public/clips-photo/（人物写真。config.json の video.photo）
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { loadConfig, ROOT } from '../src/config.js';
import { createApp } from '../server.js';
import { STATES, mouthSvg } from '../public/js/character.js';

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    // グローバルに入っている場合
    const globalRoot = process.env.PLAYWRIGHT_GLOBAL || '/opt/node22/lib/node_modules/';
    return createRequire(globalRoot)('playwright');
  }
}

const FPS = 30;
const OUT_W = 720;
const OUT_H = 1280;

// 口パク画像（閉・半開き・開き）
const mouthDir = path.join(ROOT, 'public', 'mouth');
fs.mkdirSync(mouthDir, { recursive: true });
for (const [name, open] of [['closed', 0], ['half', 0.45], ['open', 1]]) {
  fs.writeFileSync(path.join(mouthDir, `${name}.svg`), mouthSvg(open));
}

const args = process.argv.slice(2);
const usePhoto = args.includes('--photo');
const wanted = args.filter((a) => !a.startsWith('--'));
const states = Object.keys(STATES).filter((s) => !wanted.length || wanted.includes(s));
const clipsDir = path.join(ROOT, 'public', usePhoto ? 'clips-photo' : 'clips');
fs.mkdirSync(clipsDir, { recursive: true });

const config = loadConfig({ sources: { mock: { enabled: false }, tikfinity: { enabled: false } } });
const photoParam = usePhoto ? `&photo=${encodeURIComponent(config.video.photo || 'assets/person-cutout.png')}` : '';
const app = await createApp(config, { quiet: true });
const port = await app.listen(0);
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

for (const state of states) {
  // 話す動画は口を描かずに書き出し、配信画面側で口パク画像を重ねる
  const mouth = state === 'talk' && !usePhoto ? '&mouth=none' : '';
  await page.goto(`http://127.0.0.1:${port}/character.html?state=${state}&play=0${mouth}${photoParam}`);
  await page.evaluate(() => window.ready);
  const frames = Math.round(STATES[state].duration * FPS);
  const out = path.join(clipsDir, `${state}.webm`);
  const ff = spawn('ffmpeg', [
    '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-vf', `scale=${OUT_W}:${OUT_H}:flags=lanczos`, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33',
    '-pix_fmt', 'yuv420p', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', out,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((ok, ng) => ff.on('close', (c) => (c === 0 ? ok() : ng(new Error(`ffmpeg exit ${c}`)))));
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.renderAt(t), i / FPS);
    const png = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  console.log(`${state}: ${frames}フレーム → ${path.relative(ROOT, out)}（${(fs.statSync(out).size / 1024).toFixed(0)} KB）`);
}

await browser.close();
await app.close();
