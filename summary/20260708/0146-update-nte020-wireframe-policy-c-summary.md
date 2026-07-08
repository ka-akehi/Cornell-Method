# Update NTE-020 Wireframe Policy C Summary

## Objective

NTE-020 新規ノート画面の Markdown ワイヤフレームと PNG 視覚ワイヤフレームを、`NTE_020_NEW_NOTE_LAYOUT_POLICY.md` の推奨案 C に合わせて更新する。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | 画面設計成果物 NTE-020 |
| 対象ファイル / ディレクトリ | `doc/screens/MVP_UI_WIREFRAMES.md`, `doc/screens/assets/mockups/mvp-nte-020-new-note-wireframe.png` |
| 対象外 | 実装コード、設定、依存関係、他画面 PNG |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| 方針資料 | `doc/screens/NTE_020_NEW_NOTE_LAYOUT_POLICY.md` | 推奨案 C の UI 決定事項、デスクトップ主対象、モバイル横スクロール方針 |
| ワイヤフレーム | `doc/screens/MVP_UI_WIREFRAMES.md` | NTE-020 セクションの既存テキストワイヤフレーム |
| 画像 | `doc/screens/assets/mockups/mvp-nte-020-new-note-wireframe.png` | 既存 PNG の構成、重複見出し、Summary 圧縮、Cue サンプル表示 |
| 索引 | `doc/README.md` | NTE-020 方針資料へのリンクが既に存在すること |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `doc/screens/MVP_UI_WIREFRAMES.md` | NTE-020 の主目的に横長画面主対象を明記し、デスクトップ / モバイルのテキストワイヤフレームを推奨案 C に更新 | 採用方針と矛盾しない画面設計にするため |
| `doc/screens/assets/mockups/mvp-nte-020-new-note-wireframe.png` | 基本情報圧縮、Cue 30% / Note 70% 関係、本文 textarea / Preview 横並び、Summary の textarea / Preview と下部操作、モバイル横スクロール注記を反映 | 視覚ワイヤフレームを推奨案 C の確認用成果物にするため |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 作業開始時点で `doc/screens/MVP_UI_WIREFRAMES.md` と対象 PNG は未追跡ファイルだった | `git status --short` |
| F-002 | fact | `doc/README.md` には NTE-020 レイアウト方針へのリンクが既に存在したため更新しなかった | `doc/README.md` |
| F-003 | fact | 他画面 PNG の SHA-1 は作業前後で変わっていない | `shasum doc/screens/assets/mockups/*.png` |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | 完了 | 既存の未コミット / 未追跡ファイルを確認 |
| `git diff --check -- doc/screens/MVP_UI_WIREFRAMES.md` | 成功 | 空白エラーなし |
| `file doc/screens/assets/mockups/mvp-nte-020-new-note-wireframe.png` | 成功 | `PNG image data, 1280 x 900, 8-bit/color RGBA, non-interlaced` |
| 対象外 PNG ハッシュ確認 | 成功 | NTE-020 以外の PNG は作業前ハッシュと一致 |
| PNG 目視確認 | 完了 | `view_image` でレンダリング確認 |
| 作業後 `git status --short` | 完了 | 変更状況を確認 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 実装画面への反映範囲 | 実装差分調査タスクで対象コンポーネントと CSS を確認 |

## Next Read

- `doc/screens/MVP_UI_WIREFRAMES.md`
- `doc/screens/assets/mockups/mvp-nte-020-new-note-wireframe.png`
- `doc/screens/NTE_020_NEW_NOTE_LAYOUT_POLICY.md`
