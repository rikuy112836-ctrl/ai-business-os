---
name: content-pipeline
description: リサーチ→企画→台本→レビューの4工程をサブエージェントで分担してコンテンツを1本仕上げる。「〇〇について記事/台本を作って」と頼まれたときに使う。
---

# コンテンツ制作パイプライン（運用チーム）

テーマと媒体（note / reel）を受け取り、次の順でサブエージェントに仕事を渡す。

1. **researcher** にリサーチを依頼 → `output/<テーマ>/01-research.md`
2. **planner** に企画を依頼 → `output/<テーマ>/02-plan.md`
3. **scriptwriter** に執筆を依頼 → `output/<テーマ>/03-draft-<媒体>.md`
   - note と reel の両方が必要なら、2つの scriptwriter を並列で起動する
4. **reviewer** にレビューを依頼 → `output/<テーマ>/final-<媒体>.md`

## ルール
- `<テーマ>` は英数字とハイフンのスラッグにする（例: `claude-code-7-features`）
- 各工程の完了後、成果物のパスと要点1行をユーザーに報告する
- 最後に「成果物を1つに整理」した一覧（ファイルパス＋要約）を出す
