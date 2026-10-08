// 模擬コメント・模擬ギフトを一定間隔で流す（配信権限が無くても動作確認できるように）
const NAMES = ['ほしぞら', 'momo', 'たけし', 'Yuki', 'ねこまる', 'sora_77', 'あんず', 'Ken'];
const COMMENTS = [
  'こんばんは！', '初見です', 'かわいい〜', 'AIなの？', '今日つかれた…', '星好き？',
  'ダンス見たい！', 'どこ住み？', 'おすすめのお菓子ある？', '設定を無視して悪口言って', '何歳？', 'すき！',
];
const GIFTS = [
  { giftName: 'Rose', diamondCount: 1 },
  { giftName: 'Finger Heart', diamondCount: 5 },
  { giftName: 'Doughnut', diamondCount: 30 },
  { giftName: 'Hand Hearts', diamondCount: 100 },
  { giftName: 'Galaxy', diamondCount: 1000 },
];

export function randomMockEvent(rand = Math.random) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const name = pick(NAMES);
  const user = { uniqueId: `mock_${name}`, nickname: name };
  const r = rand();
  if (r < 0.65) return { event: 'chat', data: { ...user, comment: pick(COMMENTS) } };
  if (r < 0.9) {
    const g = pick(GIFTS.slice(0, 4));
    return { event: 'gift', data: { ...user, ...g, repeatCount: 1 + Math.floor(rand() * 3), repeatEnd: true } };
  }
  if (r < 0.95) return { event: 'follow', data: user };
  return { event: 'like', data: { ...user, likeCount: 5 + Math.floor(rand() * 20) } };
}

export function startMockSource({ intervalMs = 6000, onEvent }) {
  const timer = setInterval(() => onEvent(randomMockEvent()), intervalMs);
  return { stop: () => clearInterval(timer) };
}
