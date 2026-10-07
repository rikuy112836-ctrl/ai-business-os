# AI Business OS

Claude Code を「会社の事業部」のように動かすための設定リポジトリ。

## 構成
- `.claude/settings.json` — Superpowers プラグイン（brainstorming / writing-plans / systematic-debugging / code-review）を有効化
- `.claude/agents/` — 運用チーム（researcher / planner / scriptwriter / reviewer）
- `.claude/skills/` — 自分専用ルール（note-writing / reel-script / content-pipeline）
- `output/` — 成果物の保存先（`output/<テーマ>/`）
- `docs/SETUP.md` — リポジトリ外で設定する機能（Routines / Chrome / Connectors / Remote Control）

## 作業ルール
- コンテンツ制作の依頼は `content-pipeline` スキルに従い、サブエージェントで分担する
- 新しい依頼の前に、目的・入力・出力を確認してから着手する（Superpowers の brainstorming）
- 成果物は必ず `output/` 配下に保存する
