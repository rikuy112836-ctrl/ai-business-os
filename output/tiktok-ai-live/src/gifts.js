// ライブのイベント（コメント・ギフト等）を共通形式にそろえ、ギフト集計とランキングを持つ。
// 入力形式は TikFinity の Events API（{event, data:{uniqueId, nickname, ...}}）と
// TikTok-Live-Connector v2（{event, data:{user:{uniqueId, nickname}, giftDetails:{...}}}）の両方を受ける。

function pickUser(d) {
  const u = d.user || {};
  const id = String(d.uniqueId ?? u.uniqueId ?? d.userId ?? u.userId ?? 'guest');
  const name = String(d.nickname ?? u.nickname ?? id);
  return { id, name: name.slice(0, 30) };
}

export function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const event = String(raw.event || raw.type || '').toLowerCase();
  const d = raw.data || raw;
  const user = pickUser(d);
  switch (event) {
    case 'chat':
    case 'comment': {
      const text = String(d.comment ?? d.text ?? '').trim();
      return text ? { type: 'chat', user, text } : null;
    }
    case 'gift': {
      const g = d.giftDetails || d.gift || {};
      const giftType = d.giftType ?? g.giftType;
      // 連打ギフト（giftType 1）は連打が終わったとき（repeatEnd）にまとめて数える
      if (giftType === 1 && !(d.repeatEnd ?? d.repeat_end)) return { type: 'giftStreak', user };
      const count = Math.max(1, Number(d.repeatCount ?? d.count ?? 1));
      const coinsEach = Math.max(0, Number(d.diamondCount ?? g.diamondCount ?? d.coins ?? 0));
      return {
        type: 'gift', user, count, coinsEach, coins: coinsEach * count,
        giftName: String(d.giftName ?? g.giftName ?? 'Gift'),
      };
    }
    case 'follow':
      return { type: 'follow', user };
    case 'social': {
      const t = String(d.displayType || d.label || '');
      return /follow/i.test(t) ? { type: 'follow', user } : { type: 'share', user };
    }
    case 'like':
      return { type: 'like', user, count: Math.max(1, Number(d.likeCount ?? 1)) };
    case 'share':
      return { type: 'share', user };
    case 'member':
      return { type: 'member', user };
    default:
      return null;
  }
}

export function pickReaction(config, gift) {
  for (const rule of config.giftRules || []) {
    if (rule.names && rule.names.some((n) => n.toLowerCase() === gift.giftName.toLowerCase())) {
      return rule.reaction;
    }
    if (rule.minCoins != null && !rule.names && gift.coins >= rule.minCoins) return rule.reaction;
  }
  return 'heart';
}

export function createBoard() {
  const users = new Map();
  const totals = { giftCount: 0, coins: 0, likes: 0, follows: 0, comments: 0 };

  return {
    totals,
    addGift(gift) {
      totals.giftCount += gift.count;
      totals.coins += gift.coins;
      const u = users.get(gift.user.id) || { id: gift.user.id, name: gift.user.name, coins: 0, gifts: 0 };
      u.name = gift.user.name;
      u.coins += gift.coins;
      u.gifts += gift.count;
      users.set(u.id, u);
    },
    addLike(n) { totals.likes += n; },
    addFollow() { totals.follows += 1; },
    addComment() { totals.comments += 1; },
    ranking(n = 5) {
      return [...users.values()]
        .sort((a, b) => b.coins - a.coins || b.gifts - a.gifts)
        .slice(0, n)
        .map(({ name, coins, gifts }) => ({ name, coins, gifts }));
    },
    isTopGifter(id) {
      const top = this.ranking(3);
      const u = users.get(id);
      return !!u && top.some((r) => r.name === u.name && r.coins === u.coins);
    },
    reset() {
      users.clear();
      for (const k of Object.keys(totals)) totals[k] = 0;
    },
    snapshot() {
      return { totals: { ...totals }, ranking: this.ranking(5) };
    },
  };
}
