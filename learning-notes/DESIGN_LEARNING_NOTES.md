# 設計学習メモ

このファイルは、設計判断の理由や判断基準を蓄積する legacy note です。仕様正本、実装指示、運用ルールではありません。実装時は `AGENTS.md`、`doc/`、`codex-queue/README.md`、`summary/README.md` を確認します。

新しい学習メモは、できるだけテーマ別 note に整理します。

## Topic Notes

- [Next.js / React で Modular Architecture を主軸にする判断基準](architecture/modular-architecture-for-nextjs.md)
- [Cornell Method Notebook の学習サイクル中心軸](requirements/cornell-learning-cycle.md)
- [MVP / Phase 2 の切り分け基準](requirements/mvp-vs-phase2.md)
- [UI 実装前に体験を設計する判断基準](ui-design/ui-implementation-readiness.md)
- [Note 欄に図解カードを入れる判断基準](ui-design/note-diagram-card.md)
- [AI 機能が学習行為を置き換えないための判断基準](ai-features/ai-assists-learning.md)
- [外部デプロイとアクセス制御を分けて判断する基準](operations/deploy-access-control.md)
- [Manager / Worker task を設計する判断基準](operations/manager-worker-task-design.md)

## 学習メモとして残す観点

- 判断対象を何と何に分けたか。
- その判断が、学習サイクル、保守性、運用安全性のどこに効いたか。
- 初心者が混同しやすい点は何か。
- 次に同じ判断をするとき、最初にどの正本や設計書を見るべきか。

## これまでの主な学び

### Manager / Worker task は成果物と完了条件を先に固定する

非 coding task では、調査本文をどこに残すかを先に決めないと、最終回答や summary だけに情報が散りやすい。summary は checkpoint であり、設計本文の保存先ではない。

運用ルールの正本は `codex-queue/README.md` と `summary/README.md` を参照する。

### Next.js / React では Modular Architecture を主軸にする

有名なアーキテクチャ名をそのまま UI に持ち込むより、機能単位の module と軽量な責務分離で考える方が判断しやすい。層を増やす目的は、名前をそろえることではなく、変更理由と副作用境界を追いやすくすること。

技術設計の正本は `doc/technical/` を参照する。

### MVP と Phase 2 は「価値」ではなく「初回完成ラインに必須か」で分ける

価値がある機能をすべて MVP に入れると、最初に検証したい体験が遅れる。Phase 2 送りは却下ではなく、検証順序を守る判断である。

現在の仕様分類は `AGENTS.md` と `doc/requirements/` を参照する。

### 外部デプロイとアクセス制御は別の論点として扱う

無料でデプロイできること、URL が生成されること、本人だけが安全に使えることは別問題である。個人メモを外部に置く場合は、DB、認証、秘密情報、バックアップをまとめて見直す。

プロジェクトの現行前提は `AGENTS.md` と `doc/` を参照する。

### UI は normal state だけで設計完了にしない

実装後スクリーンショットは結果確認には有効だが、実装前の判断根拠にはなりにくい。保存中、失敗、空状態、競合、validation など、ユーザーが次に何をするか迷いやすい状態を先に考える。

画面設計の正本は `doc/screens/`、テスト観点は `doc/testing/`、レビュー記録は `doc/review/` を参照する。

### AI 機能は学習行為を置き換えない

AI の便利さで、Cue を自分で作る、本文を思い出す、自分の言葉でまとめる行為を削りすぎると、Cornell Method の中心が弱くなる。AI は候補、問い、根拠、見直し観点として扱い、採用判断はユーザーに残す。

将来構想の正本は `AGENTS.md` の未決事項 / ToDo と該当 `doc/` を参照する。
