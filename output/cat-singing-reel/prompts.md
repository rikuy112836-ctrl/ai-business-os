# 猫デュエット熱唱リール — 動画生成プロンプト（全6カット / 約21秒）

参考動画（@bellvtrix.ai の TikTok）のカット割り・カメラワーク・尺を分析し、
猫2匹（タキシード猫 × シルバータビー）と背景（バラの壁 × 濡れた石畳）に置き換えた版。
※参考動画はカット構成の分析のみに使用。ロゴ・透かし・エンドカードは再現しない。

## 参考動画のカット構成（実測）

| # | 尺 | 参考動画の内容 |
|---|----|----------------|
| 1 | 0.0–6.9s | 茶トラの超アップ熱唱。頬に前足。後半で前足がレンズを覆い、離れると驚き顔＋胸の前で手を組む |
| 2 | 6.9–14.1s | グレー猫の超アップ。両手で頭を抱え、目を閉じた溜めから一気に熱唱 |
| 3 | 14.1–16.2s | 引きのツーショット。並んで腰に手を当てたダンスポーズ |
| 4 | 16.2–17.9s | 地面すれすれのローアングル。空を背景に2匹がそびえ立つ |
| 5 | 17.9–19.5s | 目線ミディアムのツーショット。腕を組んで腰振りダンス |
| 6 | 19.5–21.0s | 2匹がカメラに突進し、前足でレンズを覆ってエンド |

---

## 共通プロンプト（全カットの先頭に付ける）

```
Ultra-realistic cinematic footage, vertical 9:16, shot on 35mm lens, shallow depth of field, soft overcast daylight, natural fur detail, individual whiskers, handheld camera feel. Two cats: a black-and-white tuxedo cat with a white chest and green eyes, and a fluffy silver tabby with amber eyes. Background: a pale blue-grey painted wall with pink climbing roses, wet cobblestone ground.
```

---

## カット1（0〜6秒）寄り：タキシード猫が熱唱

```
Extreme close-up of the tuxedo cat standing upright, mouth wide open as if singing passionately, one paw pressed to its cheek, eyes wide and expressive. The silver tabby stands upright in the blurry background, swaying. Camera slowly pushes in. Near the end, the tuxedo cat reaches one paw toward the lens, briefly covering it, then pulls back to reveal a startled, wide-eyed face with both paws clasped in front of its chest.
```

## カット2（6〜13秒）寄り：シルバータビーが熱唱

```
Extreme close-up of the silver tabby standing upright, both paws pressed on top of its head, eyes squeezed shut as if building up emotion, then suddenly opening its amber eyes wide and belting out a high note with its mouth wide open, head tilting side to side dramatically. The tuxedo cat dances upright in the blurry background, paws raised. Slight handheld sway, camera holds close.
```

## カット3（13〜15秒）引き：ツーショットのキメポーズ

```
Full-body wide shot of both cats standing upright side by side in front of the rose-covered wall, paws on hips, striking a confident dance pose, subtle head bob to the beat. Wet cobblestones reflect soft light. Static camera with slight handheld drift.
```

## カット4（15〜17秒）ローアングル：見上げショット

```
Extreme low-angle shot from cobblestone level looking up at both cats standing tall side by side, overcast sky and the tops of the pink roses behind them, paws raised mid-dance, fur moving slightly in the breeze. Wide-angle perspective makes them look heroic. Slow upward tilt.
```

## カット5（17〜19秒）ミディアム：腕組み腰振りダンス

```
Eye-level medium shot of both cats standing upright, linking arms and swaying their hips in sync, playful synchronized dance, looking straight into the camera. Rose wall softly out of focus behind them. Slight handheld bounce on the beat.
```

## カット6（19〜21秒）エンド：レンズに突進

```
Both cats lean forward and rush toward the camera together, faces filling the frame, the tuxedo cat's white paw reaching out and covering the lens, motion blur, frame goes dark. Handheld, quick push-in.
```

---

## 生成のコツ
- 各カットは「共通プロンプト ＋ カット別プロンプト」で個別に生成し、編集でつなぐ
- 猫の見た目がカット間でブレやすいので、カット1の良いフレームを画像参照（image-to-video）として以降のカットに渡す
- 歌声・BGMは後付け。口の動きは曲のテンポ（参考動画はアップテンポ）に合わせて編集で調整
