---
summary_type: task-summary
created_at: 2026-08-22 20:58 JST
task_kind: worker-task
task_status: done
---

## Objective

`specify-desktop-update-manifest-schema-20260822-e4b0fe2f.task.md` の完了状態、変更ファイル、後続で読む最小ファイルを固定し、raw log の再読を避ける。

## Scope

| 項目 | 内容 |
|---|---|
| task kind | `worker-task` |
| worker | `Worker-common` |
| status | `done` |
| task file | `codex-queue/tasks/done/specify-desktop-update-manifest-schema-20260822-e4b0fe2f.task.md` |
| raw log | out of scope |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/done/specify-desktop-update-manifest-schema-20260822-e4b0fe2f.task.md` | task 完了状態の起点 |
| changed files | worker timestamp | task 実行中に更新された成果物の確認 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| none | 変更ファイルなし | worker timestamp 以降の成果物更新なし |

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | task は `done` として完了処理された。 | `codex-queue/tasks/done/specify-desktop-update-manifest-schema-20260822-e4b0fe2f.task.md` |
| F-002 | fact | worker timestamp 以降の成果物更新は検出されなかった。 | Changes Made |
| A-001 | assumption | 後続作業ではこの summary の Next Read を起点にすれば raw log 再読を避けられる。 | summary 運用ルール |

## Worker Report

# Worker Report

結論として、validation coding task はまだ投入せず、以下の契約案について発注者承認を取る段階です。コード、設定、依存関係、lockfile、生成物、既存ドキュメントは変更していません。

## 1. 棚卸し結果

承認済みなのは次の高位契約です。

- 初期 provider は GitHub Releases。ただし内部は provider-neutral。
- manifest は `releases[]` とし、端末側で channel・version・architecture・macOS compatibility を判定。
- Alpha は `aarch64-apple-darwin` のみ。
- 初回配布は DMG、アプリ内更新は Apple Silicon 向け `.app archive`。
- package は公開鍵署名と SHA-256 を検証し、`keyId` はアプリ内の現行鍵・次期鍵を参照。
- 同一 channel の新しい compatible version のみ選択し、downgrade しない。
- DB compatibility は manifest に載せず、端末内 staging copy で判定。
- `/backup`、explicit save、CanvasDocumentV1、legacy Markdown、通常 uninstall と完全データ削除の境界は変更しない。

根拠は [POST_MVP_IMPLEMENTATION_PLAN.md:175](/Users/kazuya/Desktop/自己学習/Cornell-Method/doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md:175)、[MVP_CONTRACT.md:293](/Users/kazuya/Desktop/自己学習/Cornell-Method/doc/implementation/MVP_CONTRACT.md:293) などです。

未承認なのは、完全 schema の field 名・型、version 比較、macOS range、artifact ID、size の単位、URL policy、署名 proof の表現、署名アルゴリズム・encoding、manifest schema version、unknown field 方針です。

`update_state.rs` の `schemaVersion: 1` は local persistence 用であり、manifest schema version ではありません。[update_state.rs:13](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/update_state.rs:13)

## 2. manifest 候補比較

| 候補 | 構造 | 影響 | 判定 |
|---|---|---|---|
| A. flat release record | `releases[]` の各 item が channel・version・architecture・macOS・artifact を持つ | Alpha の端末内選択が単純。1 item = 1 artifact target | 推奨 |
| B. nested target matrix | release が version 単位で `targets[]` を持つ | 将来の Intel / universal 対応には有利。ただし target 選択・重複・migration 対応が複雑 | Alpha では採用しない |
| C. latest / provider order | provider が最新 1 件または順序を返す | 複数版スキップ、provider-neutral、downgrade 防止と矛盾 | 却下 |

推奨する最小 envelope は次の概念です。field 名と細かな型は承認前の提案です。

```json
{
  "schemaVersion": 1,
  "productId": "com.cornellmethod.notebook",
  "releases": [
    {
      "channel": "<opaque channel>",
      "version": "<comparable version>",
      "architecture": "aarch64-apple-darwin",
      "macosCompatibility": {
        "minVersion": "<version>",
        "maxVersionExclusive": "<optional version>"
      },
      "artifact": {
        "artifactId": "<opaque immutable id>",
        "format": "app-archive",
        "sizeBytes": 123456,
        "url": "<direct package URL>",
        "sha256": "<canonical digest>",
        "signature": {
          "keyId": "<trusted key reference>",
          "proof": "<opaque verification metadata>"
        }
      }
    }
  ]
}
```

### 推奨 field 方針

| field | 推奨 |
|---|---|
| `schemaVersion` | root の正整数。未知 version は fail closed。local update-state の version と分離 |
| `productId` | 製品識別子との一致を検証。manifest の取り違え防止のため推奨 |
| `releases[]` | 必須配列。空配列は「更新なし」として許可 |
| `channel` | release ごとの opaque identifier。クライアントの対象 channel と完全一致させる |
| `version` | 厳密な semver 相当を推奨。文字列比較や provider 順序は使わない |
| `architecture` | item ごとの単一値。Alpha は `aarch64-apple-darwin` のみ |
| `macosCompatibility` | `minVersion` 必須、上限は optional とする案。range の境界規則は未承認 |
| `artifactId` | URL や path ではない opaque identifier。artifact の重複通知・staging 管理に使う |
| `format` | `.app archive` を表す抽象値。実際の archive 拡張子は入れない。DMG は更新候補にしない |
| `sizeBytes` | 正の整数 byte 数を推奨。取得後の実 byte 数とも照合 |
| `url` | direct package URL は必要。ただし provider の feed URL・GitHub API response は含めない |
| `sha256` | 必須。表記を lowercase hex にするかは承認事項 |
| `signature.keyId` | 必須。アプリ内 allowlist に存在する key の参照だけを許可 |
| `signature.proof` | 必須の署名検証 metadata。ただし algorithm・encoding・signed bytes は未確定 |

## 3. version と compatible selection

比較案は次のとおりです。

- 厳密な semver 相当: downgrade 防止、複数版スキップ、最大 compatible 選択と整合する。推奨。
- opaque version / lexical 比較: `2.10` と `2.9` の順序を安全に決められないため不採用。
- provider order / publish timestamp: GitHub 固有で provider-neutral 契約と矛盾するため不採用。
- `version` と別の numeric `versionCode`: semver 非対応製品では可能だが field 追加となり、最小 schema ではない。

推奨アルゴリズムは以下です。

1. manifest を検証。
2. 対象 channel と一致する release だけを残す。
3. `aarch64-apple-darwin` と macOS compatibility を確認。
4. 現行 version より大きい version だけを残す。
5. 候補の最大 version を選ぶ。`releases[]` の並び順は信用しない。
6. 同じ version・target に複数 artifact があり曖昧な場合は選択せず fail closed。
7. 中間 version を順番に install せず、選択した最新 package を staging migration する。DB migration の実行順は端末内 migration に任せる。

semver の prerelease、build metadata、current channel の設定方法は発注者の承認が必要です。

## 4. validation contract

推奨は、既存 `update_state.rs` と同じく正規化済み object に対する strict validation です。

- root が object でない、JSON が壊れている、`schemaVersion` 不明、`productId` 不一致、`releases[]` 欠落の場合は manifest 全体を拒否。
- 必須 field の欠落、型違い、空文字、control character、path 形式、異常な URL、digest 長不一致は候補を拒否。
- macOS range の逆転、version の parse 不能、同一 target の重複 artifact は拒否。
- unknown field は root、release、artifact、signature の各 object で拒否する案を推奨。将来拡張は schema version を上げる。
- 未知 channel、architecture、format は信頼して fallback せず、Alpha の選択対象から除外する。
- `keyId` がアプリ内 trust store にない場合、manifest から鍵を追加せず候補を拒否。
- 有効な manifest に compatible candidate がなければ `NoUpdate`。
- manifest 破損、署名不一致、SHA-256 不一致、download 失敗は更新失敗として現行版を維持。
- validation は network、package download、暗号検証、DB migration、apply を実行しない。

## 5. 署名 metadata の比較

| 案 | 内容 | 影響 |
|---|---|---|
| inline detached proof | `keyId` と opaque proof を manifest に含める | 取得回数が少なく、provider-neutral。proof の encoding は別承認が必要 |
| signature URL | `keyId` と別 URL を持つ | 二重取得・TOCTOU・URL policy が増える |
| archive 内蔵 signature | manifest は `keyId` のみ | archive 形式と内部構造に依存し、Alpha の最小 schema と合わない |

推奨は inline detached proof の抽象 envelope です。ただし、次は固定していません。

- 署名アルゴリズム名
- 公開鍵値・秘密鍵
- proof の encoding
- 署名対象が package bytes か digest か
- canonicalization
- current / next key の rotation、失効、unknown key の扱い

## 6. privacy denylist

正規化 manifest に含めないものは以下です。

- provider feed URL、GitHub Releases 固有 response、raw payload
- release notes
- 端末 ID、利用状況、telemetry
- note 本文、Cue、Summary、タイトル、タグ、検索内容
- SQLite、backup、DB のユーザー固有状態、diagnostic log
- token、credential、Authorization 情報、user path
- `databaseSchema`、`pendingMigration` など端末内 DB 状態

`artifact.url` は package 取得に必要なため、上記の「provider URL」は provider discovery/feed URL を指すものとして整理しました。artifact URL まで禁止する意図なら、provider resolver を manifest 外に置く別案を発注者に確認する必要があります。

## 7. 後続 Worker task

既存の広すぎる `implement-desktop-update-download-apply` は、次の単目的 task に分割することを推奨します。

| 順序 | queue | task | 依存 | 並列可否 |
|---|---|---|---|---|
| 0 | Manager / Common | manifest 契約承認・task contract 化 | 発注者判断 | 不可 |
| 1 | Common | `validate-desktop-update-manifest` | 0 | 最初 |
| 2 | Common | `select-compatible-desktop-release` | 1 | 3 と並列可 |
| 3 | Common | `normalize-github-releases-provider` | 0, 1 | 2 と並列可 |
| 4 | Common | `download-desktop-update-artifact` | 1, 2, 3 | 5 の unit 実装とは並列可 |
| 5 | Common | `verify-desktop-update-signature-and-digest` | 1、承認済み署名 envelope | 4 の integration 後 |
| 6 | API | `stage-desktop-update-migration` | 0、既存 storage 境界 | 4・5 と fixture ベースで並列可 |
| 7 | Common | `apply-desktop-update-and-rollback` | 4、5、6 | 不可 |
| 8 | UI | `implement-desktop-unsaved-update-dialog` | 7 の command contract | 実装は mock と並列可、統合は直列 |
| 9 | Common | `qa-packaged-desktop-alpha-update` | 全 task | 不可 |

manifest validation task では署名アルゴリズム、DB compatibility、GitHub raw response、Intel fixture を実装しません。`update_state.rs` の既存 `PendingUpdate.artifact` を最終的な `artifactId` と同一視する変更も、別途承認するまで行いません。

## 8. 発注者の承認事項

1. `productId` を必須にするか。
2. manifest `schemaVersion` の field 名と初期 version。
3. semver 相当の厳密度、prerelease、build metadata、channel policy。
4. macOS compatibility を min-only、min/max、range のどれにするか。
5. `artifactId` の opaque / structured 方針と重複規則。
6. `sizeBytes` 必須化と SHA-256 の文字列表現。
7. artifact URL の HTTPS・credential・query policy。
8. signature proof の格納場所、wire type、signed bytes、key rotation。
9. unknown field を拒否するか、release 単位で除外するか。
10. 空配列、重複 release、壊れた非対象 channel の扱い。
11. `update_state.json` への artifact metadata の保存範囲。

## 9. 検証結果

- 作業前後の `git status --short` は同一。既存の未コミット変更・未追跡変更を保持。
- `node --test test/desktop/desktop-update-state.test.js`: 2 pass。
- `git diff --check`: PASS。
- 外部サービス、GitHub、package registry、network は未接続。
- `cargo`、build、packaged GUI、browser runtime、DB read-back は未実施。static contract の PASS を packaged runtime の PASS には繰り上げていません。
- `src-tauri/target/` は作成・更新していません。

## Next Read

- 自動生成される本 Worker summary
- [HANDOFF_2026-08-22.md](/Users/kazuya/Desktop/自己学習/Cornell-Method/HANDOFF_2026-08-22.md)
- [POST_MVP_IMPLEMENTATION_PLAN.md:175](/Users/kazuya/Desktop/自己学習/Cornell-Method/doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md:175)
- [MVP_CONTRACT.md:293](/Users/kazuya/Desktop/自己学習/Cornell-Method/doc/implementation/MVP_CONTRACT.md:293)
- [update_state.rs:13](/Users/kazuya/Desktop/自己学習/Cornell-Method/src-tauri/src/update_state.rs:13)
- [desktop-update-state.test.js:13](/Users/kazuya/Desktop/自己学習/Cornell-Method/test/desktop/desktop-update-state.test.js:13)

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| summary file created | 完了 | `summary/20260822/2058-specify-desktop-update-manifest-schema-20260822-e4b0fe2f-summary.md` |
| required headings | 完了 | template 必須見出しを含む |
| raw log suppression | 完了 | raw log 本文は転記していない |
| `tools/check-summary.sh` | 完了 | writer script により終了コード 0 で通過 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | 生成物の内容妥当性はこの summary ではレビューしていない | Next Read の対象成果物 |

## Next Read

次の作業では、まずこの summary を読む。

- `summary/20260822/2058-specify-desktop-update-manifest-schema-20260822-e4b0fe2f-summary.md`
