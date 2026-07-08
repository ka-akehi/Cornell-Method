# Learning Notes

このディレクトリは、Cornell Method Notebook の設計判断から得た学習メモをテーマ別に残す場所です。

ここにある文書は、仕様の正本、実装指示、運用ルール、受け入れ条件ではありません。実装や仕様更新では、必ず `AGENTS.md`、`doc/` 配下の設計書、最新 handoff、該当 Worker task を確認します。Manager / Worker の運用は `codex-queue/README.md` と `summary/README.md` を正本として扱います。

## 残す内容

- 判断基準
- なぜ重要か
- 初心者が誤解しやすい点
- 次に同じ判断をするときの見方
- 採用しなかった案から学べること

## 残さない内容

- 機能一覧や仕様分類の正本
- 実装手順、受け入れ条件、検証コマンドの詳細
- Worker 運用ルール本文
- 過去レビューや調査の詳細事実記録
- `AGENTS.md`、`doc/`、`codex-queue/README.md` と重複する長い説明

過去設計の事実記録、レビュー結果、棚卸し、実装との差分は、目的に合う `doc/` 配下へ置きます。

## Notes

- [設計学習メモ](DESIGN_LEARNING_NOTES.md)
- [Next.js / React で Modular Architecture を主軸にする判断基準](architecture/modular-architecture-for-nextjs.md)
- [Cornell Method Notebook の学習サイクル中心軸](requirements/cornell-learning-cycle.md)
- [MVP / Phase 2 の切り分け基準](requirements/mvp-vs-phase2.md)
- [外部デプロイとアクセス制御を分けて判断する基準](operations/deploy-access-control.md)
- [Manager / Worker task を設計する判断基準](operations/manager-worker-task-design.md)
- [UI 実装前に体験を設計する判断基準](ui-design/ui-implementation-readiness.md)
- [Note 欄に図解カードを入れる判断基準](ui-design/note-diagram-card.md)
- [AI 機能が学習行為を置き換えないための判断基準](ai-features/ai-assists-learning.md)
