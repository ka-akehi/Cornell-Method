# Tauri Cornell Notebook Icon Task Summary

## Objective

Vercel の三角形だった Tauri bundle icon を、Cornell Method Notebook を表す紙面アイコンへ置き換える。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Tauri macOS bundle icon |
| 対象ファイル / ディレクトリ | `src-tauri/icons/`, `test/desktop/tauri-icon-contract.test.js` |
| 対象外 | Web UI、favicon、API、DB、Rust runtime、テーマ |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `src-tauri/icons/icon.png` | Cornell 用の 1024px RGBA PNG に置換 | Tauri の既存 bundle icon path を維持したまま Vercel mark を除去 |
| `src-tauri/icons/icon.svg` | 編集可能な Cornell icon 原本を追加 | 紙面、Cue 欄、罫線、既存 palette を再利用可能な形で保持 |
| `test/desktop/tauri-icon-contract.test.js` | bundle path、PNG 形式・寸法、palette、Vercel/Next mark 不使用を検証 | icon asset の focused regression を追加 |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| I-1 | fact | `tauri.conf.json` は既存の `icons/icon.png` を bundle icon として参照しており、変更不要だった。 | 設定ファイルの確認 |
| I-2 | fact | `sips` はこの環境で SVG の直接変換に失敗したため、生成 PNG を最終ラスターとして使用した。 | `sips -s format png ...svg` の失敗 |
| I-3 | unknown | 実際の packaged macOS app の LaunchServices 表示は未確認。 | bundle build / GUI 起動は実施していない |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| `node --test test/desktop/tauri-icon-contract.test.js` | PASS | 2 tests passed |
| PNG 情報 | PASS | 1024x1024、RGBA、透明 alpha あり |
| 小サイズ確認 | PASS | 16 / 32 / 128 / 256px に縮小し、32px で主要形状を判別可能 |
| `git diff --check` | PASS | whitespace error なし |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-1 | packaged `.app` の Finder / Dock 上の実表示 | macOS bundle を生成して目視確認 |

## Next Read

- `src-tauri/icons/icon.svg`
- `src-tauri/tauri.conf.json`
- `test/desktop/tauri-icon-contract.test.js`
