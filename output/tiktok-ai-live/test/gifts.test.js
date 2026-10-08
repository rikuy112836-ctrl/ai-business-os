import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, pickReaction, createBoard } from '../src/gifts.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig();

test('TikFinity 形式のコメントとギフトを読める', () => {
  assert.deepEqual(normalizeEvent({ event: 'chat', data: { uniqueId: 'a1', nickname: 'あい', comment: ' こんばんは ' } }),
    { type: 'chat', user: { id: 'a1', name: 'あい' }, text: 'こんばんは' });
  const g = normalizeEvent({ event: 'gift', data: { uniqueId: 'a1', nickname: 'あい', giftName: 'Rose', diamondCount: 1, repeatCount: 7, giftType: 1, repeatEnd: true } });
  assert.equal(g.type, 'gift');
  assert.equal(g.count, 7);
  assert.equal(g.coins, 7);
});

test('TikTok-Live-Connector v2 形式（user / giftDetails の入れ子）も読める', () => {
  const g = normalizeEvent({ event: 'gift', data: { user: { uniqueId: 'b2', nickname: 'ビー' }, repeatCount: 2, repeatEnd: true, giftDetails: { giftName: 'Doughnut', diamondCount: 30, giftType: 1 } } });
  assert.equal(g.user.name, 'ビー');
  assert.equal(g.giftName, 'Doughnut');
  assert.equal(g.coins, 60);
});

test('連打中のギフトは数えず、連打終了時にまとめて数える', () => {
  assert.equal(normalizeEvent({ event: 'gift', data: { uniqueId: 'x', giftName: 'Rose', giftType: 1, repeatEnd: false, repeatCount: 3 } }).type, 'giftStreak');
});

test('ギフト→反応の対応（名前優先、次にコイン数）', () => {
  const r = (giftName, coins) => pickReaction(config, { giftName, coins });
  assert.equal(r('Finger Heart', 5), 'heart');
  assert.equal(r('rose', 1), 'heart');
  assert.equal(r('Doughnut', 30), 'cheers');
  assert.equal(r('Hand Hearts', 100), 'dance');
  assert.equal(r('Galaxy', 1000), 'dance');
  assert.equal(r('Unknown', 15), 'cheers');
  assert.equal(r('Unknown', 1), 'heart');
});

test('ランキングはコインの多い順', () => {
  const b = createBoard();
  b.addGift({ user: { id: '1', name: 'A' }, count: 1, coins: 5 });
  b.addGift({ user: { id: '2', name: 'B' }, count: 1, coins: 100 });
  b.addGift({ user: { id: '1', name: 'A' }, count: 2, coins: 10 });
  assert.deepEqual(b.ranking().map((r) => [r.name, r.coins]), [['B', 100], ['A', 15]]);
  assert.equal(b.totals.giftCount, 4);
  assert.equal(b.totals.coins, 115);
  assert.ok(b.isTopGifter('2'));
});
