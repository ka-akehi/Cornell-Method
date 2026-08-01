# Summary directory instructions

`summary/`は、Worker task、長時間調査、`codex exec`などの完了要約と再開用記録を保存する運用ディレクトリです。

## Code Review policy

このディレクトリ配下は、ユーザーが明示的にレビューを依頼した場合を除き、Codex Code Reviewの対象外です。

- P0、P1、P2、P3のFindingを出さない
- 文章、参照先、記録の完全性、古さを指摘しない
- Issue化しない
- マージ可否の根拠にしない
- 製品仕様、MVP契約、Target Architectureの正本として扱わない

作業再開の文脈として読むことはできますが、変更差分に含まれていても通常のレビュー対象にはしません。

共通の除外範囲は`.github/CODEX_REVIEW_SCOPE.md`を参照してください。
