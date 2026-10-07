# 導入手順（7つの機能）

| # | 機能 | 設定場所 | 状態 |
|---|---|---|---|
| ① | Superpowers プラグイン | このリポジトリ（`.claude/settings.json`） | ✅ 設定済み |
| ② | Skills | このリポジトリ（`.claude/skills/`） | ✅ 設定済み |
| ③ | Subagents | このリポジトリ（`.claude/agents/`） | ✅ 設定済み |
| ④ | Routines | Claude アカウント | ✅ 3件作成済み（Drive 連携は要設定） |
| ⑤ | Claude in Chrome | Chrome 拡張 | 手順は下記 |
| ⑥ | Connectors | claude.ai 設定 | Gmail / Drive 接続済み、Notion / Calendar は要接続 |
| ⑦ | Remote Control | ローカルの Claude Code | 手順は下記 |

---

## ① Superpowers
このリポジトリで Claude Code を開くと、プラグインのインストールを確認されるので承認する。
手動で入れる場合:

```
/plugin install superpowers@claude-plugins-official
```

## ② Skills
`.claude/skills/<名前>/SKILL.md` を置くだけで使える。自分の台本ルールなどを追加したいときは
「今の台本のルールをスキルとして保存して」と頼めば Claude が SKILL.md を作る。

## ③ Subagents（運用チーム）
| 担当 | エージェント | 出力 |
|---|---|---|
| リサーチ | `researcher` | `01-research.md` |
| 企画 | `planner` | `02-plan.md` |
| 台本 | `scriptwriter` | `03-draft-*.md` |
| レビュー/編集 | `reviewer` | `final-*.md` |

使い方の例:
```
「Claude Code の便利機能」で note 記事とリール台本を作って
```
→ `content-pipeline` スキルが4担当に順番に仕事を振る。

## ④ Routines（定期実行）
claude.ai/code の **Routines → New routine**（CLI では `/schedule`）で作成する。
クラウドで動くので PC を閉じていても実行される。おすすめ:

| 名前 | 頻度 | 依頼文 |
|---|---|---|
| AIニュースの要約 | 毎日 9:00 | AI関連の最新ニュースを5件調べて要約し、`output/news/YYYY-MM-DD.md` に保存して |
| 競合投稿のリサーチ | 毎週月曜 9:00 | researcher エージェントで今週伸びている AI 活用系の投稿を調べて |
| 月次レポート | 毎月1日 9:00 | 先月 `output/` に作った成果物を一覧にしてまとめて |

作成後はまず **Run now** で1回試して、出力を確認してから定期実行に任せる。

**作成済み（日本時間）:** AIニュースの要約（毎日 8:50）/ 競合投稿のリサーチ（毎週月曜 8:50）/ 月次レポート（毎月1日 8:53）。
結果は Google Drive の「AI Business OS」フォルダに保存する設定。ただし作成時にコネクタを紐付けられなかったため、
claude.ai/code の Routines で各ルーチンを開き、Google Drive コネクタを追加すること（未設定の間は結果がセッションに出力され、プッシュ通知が届く）。

## ⑤ Claude in Chrome
1. Chrome ウェブストアで「Claude in Chrome」拡張をインストールし、Claude アカウントでログイン
2. Claude Code（ローカル）で `/chrome` を実行して接続
3. 例:「note のエディタを開いて、この下書きを貼り付けて下書き保存して」

## ⑥ Connectors
claude.ai の **設定 → コネクタ** で連携する。
- Gmail / Google Drive — 接続済み（このクラウド環境で利用可能）
- Notion / Google Calendar — 必要なら追加で接続

例:
- 「昨日のメールをまとめて、返信の下書きを作って」
- 「投稿アイデアを Notion のデータベースに登録して」
- 「明日9時に企画会議を Google カレンダーに入れて」

## ⑦ Remote Control
PC で動いている Claude Code をスマホから操作する。
1. PC の Claude Code で `/remote-control` を実行
2. 表示された案内に従い、スマホの Claude アプリでセッションを開く
3. 外出先から「台本を3本作って」などと仕事を投げられる
