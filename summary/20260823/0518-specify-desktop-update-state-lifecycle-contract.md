---
summary_type: task-summary
created_at: 2026-08-23 05:18 JST
task_kind: worker-task
task_status: done
---

## Objective

Desktop Alpha の manifest check、package download、archive extraction、app bundle validation を `UpdateStateStore` へ接続するための state lifecycle、永続化、staging retention / cleanup 契約を一つの推奨案へ固定する。後続 Worker が追加の仕様質問なしに state v2、明示 package verification、再検証境界を実装できるようにする。

この summary は仕様整理だけを行った成果物であり、製品コード、設定、依存関係、lockfile、既存仕様書本文、既存テスト、生成物は変更していない。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | `update-state.json` の schema / migration、manifest check と package verification の分離、staging lifecycle、error mapping、将来の apply boundary |
| 対象ファイル / ディレクトリ | `src-tauri/src/update_state.rs`、`update_check.rs`、`update_download.rs`、`update_archive.rs`、`update_bundle.rs`、`main.rs`、関連する runtime / desktop tests、Desktop Alpha の正本 docs、指定済み update summary |
| 成果物 | `summary/20260823/0518-specify-desktop-update-state-lifecycle-contract.md` のみ |
| 対象外 | code / config / dependency / lockfile / existing docs / existing tests / generated artifact の変更、GitHub / network / package download、実 archive / bundle access、live DB、apply、restart、DB migration、health check、rollback の実装 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| handoff | `HANDOFF_2026-08-22.md` | Desktop Alpha の実装済み範囲、update task の順序、未検証境界、`Next Read` |
| summary operation | `summary/README.md`、`summary/task-summary-template.md`、`tools/check-summary.sh` | summary の必須見出し、raw log を保存しない規則、検証方法 |
| canonical contract | `doc/implementation/MVP_CONTRACT.md` §9.4〜§9.4.1 | current MVP 非変更、Apple Silicon、staging、署名 / SHA-256、current app / live DB / backup 維持、privacy 境界 |
| technical contract | `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md` | Application Support layout、`update-state.json` の承認済み metadata、single instance、migration / apply の境界 |
| archive contract | `summary/20260823/0259-specify-desktop-app-archive-contract.md` | `.app.tar.gz`、`incoming` / `packages` / `extract` layout、relative path、safe extraction、cleanup と後続 interface |
| signature contract | `summary/20260823/0312-specify-desktop-update-signature-contract.md` | canonical payload v1、embedded trust store、key rotation、apply 前の再検証、sanitized error mapping |
| archive implementation summary | `summary/20260823/0451-implement-desktop-update-archive-extraction-20260823-96fed217-summary.md` | 実装済みの gzip / tar preflight、no-follow extraction、temporary directory、atomic rename、error code |
| bundle implementation summary | `summary/20260823/0509-implement-desktop-update-app-bundle-validation-20260823-f09ef5a3-summary.md` | 実装済みの Info.plist、bundle identity / version、executable、thin arm64、path / symlink validation |
| state implementation | `src-tauri/src/update_state.rs` | schema 1、status / verification state、24 時間 suppression、Mutex、atomic state write、notification、crash recovery、privacy snapshot |
| check implementation | `src-tauri/src/update_check.rs` | startup / manual の manifest-only orchestration、selection、`Available + NotVerified`、provider failure、command response |
| download implementation | `src-tauri/src/update_download.rs` | raw package streaming、size / SHA-256 / signature、`.part` cleanup、sha-based package path、staging root safety |
| archive implementation | `src-tauri/src/update_archive.rs` | verified raw package input、preflight、safe extraction、`extract/<sha>` ready tree、relative app path、partial tree cleanup |
| bundle implementation | `src-tauri/src/update_bundle.rs` | extracted app input、relative path safety、Info.plist / executable / Mach-O arm64 checks、sanitized error code |
| application wiring | `src-tauri/src/main.rs`、`src-tauri/src/runtime.rs` | `UpdateStateStore` の settings 初期化、startup / manual check の接続、現状 `StorageLayout` に staging accessor がないこと |
| desktop contract tests | `test/desktop/desktop-update-state.test.js`、`desktop-update-check.test.js`、`desktop-update-startup-check.test.js` | 現行 state snapshot、daily/manual/retry、manifest check と package side effect 分離の静的契約 |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260823/0518-specify-desktop-update-state-lifecycle-contract.md` | 現行棚卸し、推奨 state v2、migration、lifecycle、staging retention / cleanup、concurrency、error mapping、後続 coding task、verification を記録 | 後続 Worker の実装入力を一つに固定するため |

## Findings

### 1. 推奨案の結論

次の案を採用する。ここでは複数案を残さず、後続実装の正本となる一案だけを定義する。

| 決定項目 | 推奨案 |
|---|---|
| local state schema | `update-state.json` は schema version `2` へ上げる。schema version は manifest root の `schemaVersion: 1` と別 namespace のままにする |
| 既存 state | schema 1 は読み取り、検証後に v2 へ一度だけ migrate する。未知 schema、壊れた JSON、symlink state は fail closed し、元ファイルを上書きしない |
| UI snapshot | `UpdateStateSnapshot.snapshotVersion: 1`、既存の status / pending six fields / failure allowlist を維持する。v2 の size、hash、key、path、phase、verifiedAt は UI に出さない |
| manifest check | startup / manual `run_update_check` は manifest fetch と compatible selection だけを行う。package download、signature、archive、bundle validation を暗黙に開始しない |
| explicit verification | `Available + NotVerified` から別 command / service が開始する。download、raw integrity / signature、archive、bundle が全て成功した最後の atomic transition だけが `Verified` を保存する |
| path | state には package / extracted app の relative-only path を保存する。ただし path は任意値ではなく SHA-256 から決まる canonical path と完全一致させ、利用時は再構成値と照合する |
| retention | `Available + Verified` の package と ready app tree は apply の成否が確定するまで保持する。`.part` と partial extraction は失敗時に exact target だけを削除する。同一 artifact の再試行は canonical package cache を再検証して再利用できる |
| apply trust | persisted `Verified` marker、path、digest だけを信頼して apply しない。apply preparation で fresh manifest / proof / trust store、raw package、archive、bundle、selected identity を再検証する |
| data safety | verification / cleanup は `staging/` の中だけを対象にする。current app、`live/notebook.sqlite`、app-managed `backups/`、Application Support 外の export は変更しない |

#### 1.1 現行実装の事実

- `src-tauri/src/update_state.rs` の現行 schema は `1`。`UpdateStatus` は `NotChecked`、`Checking`、`NoUpdate`、`Available`、`Failed`、`PendingUpdate` は version / channel / architecture / opaque artifact / verificationState / discoveredAt を持つ。
- 現行 `UpdateStateStore` は `Mutex<UpdateState>`、24 時間の automatic suppression、manual override、`Checking` の二重開始拒否、同一ディレクトリ内の `create_new` temp file、file `sync_all`、rename、親 directory `sync_all` を実装している。
- 現行起動時に persisted `Checking` を `Failed + check-interrupted` へ変換する。ただし phase がなく、manifest check と将来の package verification を区別できない。
- 現行 `UpdateStateSnapshot` は `snapshotVersion: 1` の fixed allowlist で、URL、size / hash、signature / proof、response、headers、absolute path、user data を出さない。この privacy boundary は維持する。
- `update_check.rs` は provider → manifest parse → compatible selection → state record のみを行い、selected release を `Available + NotVerified` として保存する。`main.rs` の startup / manual command はこの orchestration に接続するだけで、download / extraction / bundle validation は呼ばない。
- `update_download.rs` は `incoming/<sha256>.part` に streaming し、size、SHA-256、signature を通過した raw archive を `packages/<sha256>.app.tar.gz` へ rename して `VerifiedArchive` を返す。失敗時は `.part` を削除する。
- `update_archive.rs` は verified raw archive を `extract/<sha256>.tmp` へ preflight / no-follow 展開し、成功時に `extract/<sha256>` へ rename して `ExtractedArchive` を返す。失敗時は temporary tree を削除する。
- `update_bundle.rs` は `ExtractedArchive.relative_app_path` から path を解決し、Info.plist、product ID、version、executable、thin arm64 を検証して `VerifiedAppBundle` を返す。apply への接続はない。
- `src-tauri/src/runtime.rs` の `StorageLayout` は settings directory accessor を持つが、staging directory accessor はまだ公開していない。後続実装は Application Support root の直接再計算を各 module に散らさず、最小の `staging_directory()` accessor を追加する。

#### 1.2 重要な用語

- `status` は UI と persisted state の大きな lifecycle を表す。
- `verificationState` は candidate の package / app verification 結果を表す。`Available + NotVerified` は候補が見つかっただけで、installable / trusted ではない。`Available + Verified` は全 verification を通過した apply candidate だが、apply 前再検証は必須である。
- `phase` は `status=checking` の理由を表す内部 persisted field である。候補の verification と manifest check を一つの status に押し込みつつ、crash recovery と concurrency を区別する。

### 2. 推奨 schema v2

#### 2.1 Top-level fields

```text
schemaVersion: 2
status: not-checked | checking | no-update | available | failed
phase: null | manifest-check | package-verification | apply-preparation | restart-health-check | rollback
lastCheckAt: u64 | null
checkStartedAt: u64 | null
pendingUpdate: PendingUpdateV2 | null
failure: { code: string, retryAt: u64 } | null
notification: { version: string, artifact: string, notifiedAt: u64 } | null
```

`checkStartedAt` は wire compatibility のために名称を維持し、v2 では `phase` が存在する active operation の開始時刻として扱う。`phase` は v2 の persisted internal field で、snapshot には含めない。`status != checking` では `phase` と `checkStartedAt` を null にする。

`phase` の意味は次のとおりとする。

| phase | 実装段階 | 現行 task での扱い |
|---|---|---|
| `manifest-check` | provider fetch、parse、selection | 現行 startup / manual check が使う |
| `package-verification` | package download、raw integrity / signature、archive、bundle | 次の explicit verification task が使う |
| `apply-preparation` | current target と persisted candidate の再検証、DB staging 前の準備 | apply task まで実装しない |
| `restart-health-check` | explicit restart 後の新 app 起動、migration / reopen、health check | apply / restart task まで実装しない |
| `rollback` | health failure 後の old app / DB / backup recovery | rollback task まで実装しない |

#### 2.2 `PendingUpdateV2` fields

| JSON field | 必須性 | 意味と validation |
|---|---|---|
| `version` | 常に必須 | selected release の exact SemVer。既存 wire field を維持 |
| `channel` | 常に必須 | `stable`。opaque identifier validation を維持 |
| `architecture` | 常に必須 | `aarch64-apple-darwin`。filename から導出しない |
| `artifact` | 常に必須 | artifact ID。既存 JSON key を維持し、意味としては `artifactId`。path component に使わない |
| `verificationState` | 常に必須 | fresh v2 writer は `not-verified` または `verified` を出す。`failed` は旧 state の read compatibility のみとし、新規 failure は top-level `status=failed` へ集約する |
| `sizeBytes` | fresh v2 では必須 | manifest の compressed archive wire byte 数。`0` と hard cap 超過を拒否 |
| `sha256` | fresh v2 では必須 | manifest の lowercase 64 hex。actual raw bytes と exact match する expected digest |
| `keyId` | fresh v2 では必須 | embedded trust store lookup 用の opaque ID。public key bytes、proof は保存しない |
| `packagePath` | raw package publish 後に必須 | staging root からの relative path。`packages/<sha256>.app.tar.gz` と exact match する場合だけ受理 |
| `extractedAppPath` | extraction ready tree 後に必須 | staging root からの relative path。`extract/<sha256>/Cornell Method Notebook.app` と exact match する場合だけ受理 |
| `discoveredAt` | 常に必須 | candidate が state に保存された時刻 |
| `verifiedAt` | `verificationState=verified` で必須 | bundle validation まで完了した時刻。未検証では null |

fresh v2 state では `sizeBytes`、`sha256`、`keyId` は selected manifest から `Available + NotVerified` を保存する時点で揃える。v1 migration で値が存在しない candidate だけは legacy compatibility exception として三つを全て null にできる。部分的な欠落は invalid とする。explicit verification は legacy candidate に fresh selected release metadata を再供給してから開始し、値が揃うまで download しない。

`packagePath` だけが存在する `NotVerified` は、raw package の size / digest / signature checkpoint は完了したが、archive / bundle 検証が未完了の状態を表せる。`extractedAppPath` が存在する `NotVerified` は safe extraction が完了したが、bundle validation または最終 state commit が未完了の状態を表せる。どちらも installable ではない。

canonical path を state に保存する理由は、既存 docs が再起動後検証用 metadata として relative package path を承認しており、既存 `VerifiedArchive` / `ExtractedArchive` DTO の read-back と一致させるためである。ただし persisted path は trust root ではない。ロード時・再検証時・削除時に SHA-256 から canonical path を再構成し、保存値と一致しなければ state tampering / `update-revalidation` として fail closed する。

#### 2.3 Example

```json
{
  "schemaVersion": 2,
  "status": "available",
  "lastCheckAt": 1787450000,
  "pendingUpdate": {
    "version": "1.2.3",
    "channel": "stable",
    "architecture": "aarch64-apple-darwin",
    "artifact": "opaque-artifact-id",
    "verificationState": "verified",
    "sizeBytes": 123456,
    "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "keyId": "cmn-ed25519-v1-<fingerprint>",
    "packagePath": "packages/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.app.tar.gz",
    "extractedAppPath": "extract/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef/Cornell Method Notebook.app",
    "discoveredAt": 1787450000,
    "verifiedAt": 1787450100
  }
}
```

この例は wire shape のみを示す。proof、canonical payload、URL、HTTP response、absolute path、DB、user data は state に入れない。`<fingerprint>` は production key value の配布を意味しない。

### 3. schema version の比較と migration

| 案 | 利点 | 問題 |
|---|---|---|
| schema 1 を維持 | 既存 file をそのまま読むことができる | phase、verifiedAt、size / hash / key、relative paths を optional extension として混ぜることになり、`deny_unknown_fields` と `Available + Verified` の意味が曖昧になる。旧 `Verified` marker を再検証済みと誤認しやすい |
| schema 2 へ上げる | lifecycle と evidence の invariant を wire contract として明示でき、旧 marker の再検証要求を一度の migration で固定できる | v1 parser、migration、v2 atomic rewrite、invalid / interrupted recovery の実装が必要 |

推奨は schema 2 である。これは既存 state を捨てる変更ではなく、v1 を strict に読んで v2 へ変換する compatibility path を追加する変更である。UI snapshot version は別 namespace のため 1 のまま維持する。

#### 3.1 Load order

1. `settings/update-state.json` の parent directory が想定 settings directory であることを確認する。
2. state file を symlink でない regular file として no-follow read する。missing は `NotChecked`、symlink / directory / permission error は `state-read-failed` とする。
3. JSON を parse し、`schemaVersion` を先に読む。未知 field、型、enum、identifier、failure code、path、digest、status invariant を validate する。
4. version `1` は専用 v1 struct で validate してから v2 struct へ変換する。v1 の JSON を v2 struct へ直接 deserialize して optional default でごまかさない。
5. v1 `Available` の `Verified` または `Failed` marker は cryptographic evidence がないため `NotVerified` に downgrade する。v1 の candidate metadata は保持し、size / hash / key / path は null の legacy exception とする。
6. v1 / v2 の `status=checking` は active operation とみなし、phase に応じて interrupted failure へ recovery する。v1 は phase がないため `manifest-check` として扱う。
7. migrate / recovery 後の v2 state を validate し、同一 settings directory の temp → fsync → rename → parent fsync で atomic persist する。write failure の場合は元の v1 / v2 file を残し、package / staging / current app へ副作用を出さない。

#### 3.2 Invalid / unsupported state

- 空、壊れた JSON、unknown field、inconsistent status、invalid path、invalid digest、absolute path、symlink state は `state-invalid` または `state-read-failed` とし、in-memory は `NotChecked` にする。
- schema `0`、`3` 以降など未対応 version は `state-schema-unsupported` とし、元 file を削除・上書き・rename しない。current app、live DB、backup、staging は state parser を理由に変更しない。
- invalid state を読み込んだ後に state 起点の recursive cleanup を実行しない。staging cleanup は state から独立した exact canonical target validation を通った場合だけ行う。
- `load_issue` は固定 code だけを返し、OS error message、JSON body、path、user data を command / UI に出さない。

#### 3.3 Interrupted operation recovery

| 起動時の state | recovery | persisted result |
|---|---|---|
| `Checking + manifest-check` | provider / selection は再開しない。download は開始しない | `Failed`、failure code `check-interrupted`、`retryAt=now`、pending / notification clear |
| `Checking + package-verification` | exact `<sha>.part` と `<sha>.tmp` を cleanup。checkpoint 済みの canonical package は再検証可能な cache として残してよい | `Failed`、failure code `verification-interrupted`、pending clear。次の explicit verify は fresh manifest と SHA identity で再開 |
| `Checking + apply-preparation` | apply / restart を自動再開しない。後続 apply task が old app / DB boundary を確認するまで候補を installable 扱いしない | `Failed`、failure code `update-interrupted`、pending clear。current app / live DB / backup は変更しない |
| `Checking + restart-health-check` または `rollback` | 起動処理で勝手に新 app を起動・削除・DB migration しない。専用 recovery task の入力として停止する | `Failed`、failure code `update-interrupted` または `update-rollback`。状態が不確かな場合は fail closed |

atomic rename 前の temp state は未完成として無視する。state file が存在しない場合も temp を promote しない。stale temp は settings directory の直下で、固定 prefix、regular non-symlink、既知の state temp filename pattern に一致するものだけを後続 maintenance で削除する。広い glob、親 root の recursive deletion、外部 path の cleanup は行わない。

### 4. Status / verification lifecycle

#### 4.1 Stable state invariant

| status | phase | pending | invariant / UI meaning |
|---|---|---|---|
| `NotChecked` | null | null | 起動直後、または成功した apply / health check 後に再確認が必要な状態。package は持たない |
| `Checking` | non-null | phase により任意 | active operation。UI snapshot は既存 `checking` を返す。再起動時は必ず recovery する |
| `NoUpdate` | null | null | 完了した manifest check が compatible candidate を見つけなかった状態。package verification の結果を意味しない |
| `Available` | null | 必須 | `NotVerified` は候補のみ、`Verified` は全 package / archive / bundle validation 済みの apply candidate。どちらも apply 前再検証が必要 |
| `Failed` | null | null | check / verification / revalidation / health / rollback の失敗。current app、live DB、backup を保持したまま再試行入力を待つ |

新規 writer は `Available + verificationState=Failed` を作らない。verification failure は top-level `Failed + failure.code` に集約し、古い enum variant は v1 read compatibility のためだけに残す。これにより `Failed` と `PendingUpdate` の二重の failure source を作らない。

#### 4.2 Transition table

| 段階 | entry | atomic state transition | side effect / cleanup |
|---|---|---|---|
| manifest check 開始 | `NotChecked`、`NoUpdate`、`Available`、`Failed` で active phase なし | `Checking + manifest-check`、`lastCheckAt=now`、`checkStartedAt=now`、前回 failure clear | provider fetch だけ。package / archive / bundle は呼ばない |
| automatic suppression | `lastCheckAt + 24h` 未満、または failure `retryAt` 未到達 | state を変更せず `Suppressed` | provider、download、staging side effect なし |
| manual check in flight | active phase あり | state を変更せず `AlreadyChecking` / busy | 二重 provider request なし |
| manifest が update なし | `Checking + manifest-check` | `NoUpdate`、pending / failure / notification clear | state commit 成功後、旧 candidate の exact package / app tree を cleanup queue へ送る |
| manifest が candidate を選択 | `Checking + manifest-check` | `Available + NotVerified`、version / channel / arch / artifact / size / hash / key / discoveredAt を保存、phase clear | package download なし。candidate notification の existing claim は維持 |
| explicit verification 開始 | `Available + NotVerified`、fresh selected identity が一致 | `Checking + package-verification`、`checkStartedAt=now`、pending を保持 | separate command だけが開始。startup / manifest check からは呼ばない |
| raw package checkpoint | raw download function が `VerifiedArchive` を返した後 | pending に canonical `packagePath` を保存、`verificationState=NotVerified`、phase は維持 | package は `packages/<sha>.app.tar.gz` に存在。まだ installable ではない |
| safe extraction checkpoint | archive function が `ExtractedArchive` を返した後 | pending に canonical `extractedAppPath` を保存、`verificationState=NotVerified`、phase は維持 | `extract/<sha>` は ready tree。bundle validation 前なので apply 不可 |
| bundle verification 完了 | bundle function が `VerifiedAppBundle` を返し、selected identity / path / version / arch が一致 | `Available + Verified`、`verifiedAt=now`、phase clear、failure clear | package と ready app tree を apply 用に保持 |
| package / archive / bundle failure | active package verification | `Failed`、fixed failure code、`retryAt=now`、pending / notification clear | `.part`、temporary tree、invalid final / ready tree を exact cleanup。current app / DB / backup は不変 |
| apply preparation 開始 | `Available + Verified` | `Checking + apply-preparation`、pending を保持 | fresh manifest / trust / raw / archive / bundle / selected identity を再検証。apply はまだしない |
| apply preparation failure | `Checking + apply-preparation` | `Failed`、`update-revalidation` 等、pending clear | new tree / invalid cache を cleanup。current app / live DB / backup は不変 |
| restart / health success | future apply task | `NotChecked`、pending / failure / phase clear、`lastCheckAt` は clear して次回 reconcile を促す | health success 後だけ old app bundle / consumed staging を cleanup |
| health failure、rollback success | future apply task | `Failed + update-health-check`、pending clear | old app、live DB、app-managed backup を維持 / restore。new candidate tree は cleanup |
| rollback failure | future apply task | `Failed + update-rollback`、automatic retry / delete をしない | current app / DB の不確かな状態を広げない。recovery UI / manual recovery task の入力にする |

`lastCheckAt` の 24 時間制限は manifest check にだけ適用する。explicit package verification と apply revalidation は user action / apply transaction の明示操作であり、automatic startup check に package work を付け足さない。package verification が内部で fresh manifest を取得する場合も、`run_update_check` の daily suppression と別の operation として扱う。

### 5. Explicit verification service boundary

#### 5.1 Command / coordinator

将来の入口は現行 `manual_update_check` を拡張せず、例えば次の separate command とする。

```text
verify_pending_update(app) -> VerifyPendingUpdateResponse
```

`verify_pending_update` は次の責務を持つ `UpdateVerificationCoordinator`（名称は実装時に固定）へ委譲する。

1. `UpdateStateStore` から `Available + NotVerified` の candidate identity を atomic に claim する。active phase があれば no-op / busy を返す。
2. state が proof / URL を保存していないため、provider-neutral manifest を fresh fetch し、current target に対して `select_update` を再実行する。
3. selected release の identity（version、channel、architecture、artifact、size、sha256、keyId）が state candidate と一致することを確認する。異なる場合は stale candidate として `update-candidate-changed` を返し、new candidate を `Available + NotVerified` として保存して終了する。古い version を勝手に download しない。
4. staging root を `StorageLayout` から受け取り、`download_and_verify_artifact` を呼ぶ。既存の `UpdateRelease`、`VerifiedArchive`、`ExtractedArchive`、`VerifiedAppBundle` をそのまま使う。
5. raw package checkpoint、extraction checkpoint、最終 `Verified` transition を `UpdateStateStore` の atomic transition API へ渡す。
6. 失敗は fixed error mapping と exact cleanup を実行して `Failed` へ遷移する。command response は sanitized outcome / snapshot だけを返す。

manifest fetch は explicit verification の内部依存であり、startup / manual `run_update_check` の package side effect ではない。proof と URL を state に保存しない設計のため、apply 前の再検証でも fresh manifest が必要である。network を使えない場合は `update-revalidation` で停止し、persisted `Verified` marker だけで apply しない。

#### 5.2 DTO ownership

- release metadata は既存 `UpdateRelease` だけを使う。`PendingUpdate` は persisted projection であり、release DTO の duplicate ではない。
- raw package result は既存 `VerifiedArchive`、safe extraction result は既存 `ExtractedArchive`、bundle result は既存 `VerifiedAppBundle` を使う。
- `UpdateStateStore` は file I/O、download、tar parser、plist、Mach-O、signature algorithm を実行しない。state の validation、transition、atomic persistence、snapshot だけを担当する。
- coordinator は module results の identity を照合し、state transition と cleanup の順序を制御する。download / archive / bundle module 内に state JSON writer を追加しない。
- state transition API は既存 result DTO の reference またはその fields を受け取る。result DTO と同じ内容の `VerifiedPackageState` / `VerifiedBundleState` を新設しない。

#### 5.3 Atomic transition API の最小セット

後続 state coding task では、少なくとも次の operation を一つの `UpdateStateStore` API として実装する。各 method は in-memory mutation 後に validation、temp write、file fsync、same-directory rename、parent fsync を行い、write failure 時は前の in-memory state へ戻す。

```text
begin_manifest_check(trigger, now)
record_no_update(now)
record_available(selected_release, discovered_at)
begin_package_verification(candidate_identity, now)
record_package_staged(verified_archive)
record_extracted_app(extracted_archive)
record_verified(verified_app_bundle, verified_at)
record_verification_failure(mapped_code, retry_at)
begin_apply_preparation(candidate_identity, now)
record_apply_health_success(now)
record_apply_failure(mapped_code, retry_at)
```

実装時に `selected_release` と result DTO を再定義せず、既存 module types との依存方向を確認する。`record_verified` は次の全条件を同時に検証する。

- state candidate identity と release / archive / extracted / bundle identity が一致する。
- raw package file の expected size / SHA-256 / signature が通過している。
- archive safe extraction、single `.app` root、path / symlink / permission / resource limit が通過している。
- `CFBundleIdentifier` が `com.cornellmethod.notebook`、version が selected version、main executable と認識可能な Mach-O が arm64 thin である。
- canonical package / app relative paths が state fields と一致する。

### 6. Persisted `Verified` の再検証契約

`Verified` は「package download、raw size、raw SHA-256、Ed25519 proof、archive safe extraction、bundle ID / version / arm64 validation の全てを同一 candidate に対して通過した」という意味だけに固定する。署名だけ成功した raw archive、safe extraction だけ成功した app tree、persisted flag だけは `Verified` ではない。

apply preparation は次を必須にする。

| 再検証対象 | 失敗条件 | state / action |
|---|---|---|
| state schema / path | state tampering、schema invalid、path が relative でない、SHA-derived canonical path と不一致 | `state-invalid` または `update-revalidation`、apply 中止。state / current app / DB を維持 |
| selected identity | fresh manifest selection が version、channel、architecture、artifact、size、sha、keyId のいずれかで不一致 | `update-revalidation`。stale candidate を apply しない。fresh check / verify を要求 |
| trust store | key unknown、retired、revoked、fingerprint mismatch | `update-signature-key`。persisted Verified を無効化し、package を trusted 扱いしない |
| package path | deletion、missing file、symlink、non-regular file、size mismatch、SHA mismatch | `update-integrity` / `staging-path`。invalid package を cleanup、archive を開かない |
| signature | proof encoding / canonical payload / proof mismatch | `update-signature-proof`。proof を state / UI / log に出さない |
| archive tree | ready tree missing / symlink / mutated / wrong root / resource or permission failure | `update-archive` / `staging-path`。ready tree を trusted app として使わず、必要なら package から再展開 |
| bundle | Info.plist identity / version、executable、Mach-O arm64 thin の不一致 | `update-bundle`。apply 中止、new app tree を削除 |
| current version | selected version が current 以下、downgrade、current target mismatch | `update-revalidation`。selection contract を再利用し、署名が有効でも apply しない |

key revocation は embedded trust store の current process version に従う。remote manifest や state file から trust root を追加しない。proof を保存しないため、apply 前に manifest を取得できない場合も fail closed である。

### 7. Staging layout、retention、cleanup

#### 7.1 Canonical layout

```text
<Application Support>/staging/
├── incoming/
│   └── <sha256>.part
├── packages/
│   └── <sha256>.app.tar.gz
└── extract/
    ├── <sha256>.tmp/
    └── <sha256>/
        └── Cornell Method Notebook.app/
```

`sha256` は manifest validation 済み lowercase hex だけを使う。artifact ID、URL basename、Content-Disposition、version、absolute path は filename / directory component に使わない。`extract/<sha256>` は archive module が temporary directory から atomic rename した ready directory である。

#### 7.2 Retention / retry matrix

| object | 正常 retention | failure cleanup | same artifact retry |
|---|---|---|---|
| `.part` | 保持しない | download / startup recovery で exact file を削除 | resume はしない。最初から streaming し直す |
| `packages/<sha>.app.tar.gz` | `Available + Verified` から apply / rollback 結果確定まで保持 | size / digest / signature mismatch なら削除。state write / transient interrupted なら canonical regular file を untrusted cache として残してもよい | exact file を no-follow open し、size / SHA-256 / fresh signature を再検証。失敗なら削除して一回だけ再取得 |
| `extract/<sha>.tmp` | 正常 state に残さない | archive / bundle / crash recovery で exact temporary tree を削除 | ready tree がない場合だけ package から作り直す |
| `extract/<sha>/` | `Available + Verified` から apply / rollback 結果確定まで保持 | archive / bundle mismatch、tamper、apply failure 後は exact tree を削除。symlink / ambiguous target は削除せず fail closed | package が valid なら safe extraction と bundle validation を再実行 |
| old artifact tree | new candidate の state commit 後は current candidate ではない | exact old SHA target だけを cleanup queue に入れる | old version を downgrade candidate として再利用しない |

same artifact は identity に version / channel / architecture / artifact / size / sha / keyId を含める。同じ artifact ID でも digest 等が異なる場合は同一 artifact と扱わない。raw package cache を再利用するときも `Verified` marker を復活させず、full pipeline の最終 commit まで `NotVerified` のままとする。

新しい candidate が見つかった場合は、まず新 candidate を atomic state write し、その成功後に旧 candidate の `packages/<oldsha>.app.tar.gz` と `extract/<oldsha>/` を cleanup queue へ送る。state write 前に旧 tree を削除しない。cleanup failure は new state を `Failed` に戻さず、fixed local diagnostic `staging-cleanup` を記録して次回 exact orphan maintenance へ送る。旧 package を current app、live DB、backup の代わりに扱わない。

#### 7.3 Safe target validation

- staging root は runtime が返す Application Support root 配下の `<root>/staging` に固定し、absolute、親 directory non-symlink、root non-symlink、directory type を確認する。
- persisted `packagePath` / `extractedAppPath` は relative、normal component only、control / NUL / backslash / `.` / `..` なし、既知の canonical prefix と SHA-derived filename に完全一致するものだけを受理する。
- open は各 parent component の `symlink_metadata` と regular / directory type を確認し、Unix では `O_NOFOLLOW` を使う。bundle validator / archive extractor の no-follow boundary を bypass しない。
- delete は state / manifest の arbitrary path を受け付けず、検証済み lowercase SHA から再構成した exact path のみを対象にする。symlink、unexpected file type、root mismatch、canonical path mismatch があれば削除しない。
- `remove_dir_all` を使う場合も、事前に staging root からの exact descendant、expected directory、非 symlink を確認する。Application Support root、`live/`、`backups/`、repository、外部 export を recursive target にしない。
- startup orphan cleanup は `incoming`、`packages`、`extract` の直接 child だけを列挙し、既知の lowercase SHA filename / directory pattern と safe type を満たすものだけを対象にする。広い `staging/*`、user-supplied glob、absolute state path は使わない。

### 8. Concurrency、single instance、idempotency

#### 8.1 Concurrency

- 既存 single-instance authority は一つの primary process / primary window である。secondary process は update command を実行しない。
- primary 内では `UpdateStateStore` の Mutex に加えて、package verification / apply preparation の全 I/O を覆う `UpdateCoordinator` の operation mutex を持つ。state Mutex だけを握ったまま network / archive I/O を行わない。
- `phase != null` の persisted state は durable busy marker である。manifest check、explicit verification、apply preparation のいずれの command も active operation を二重開始しない。
- startup automatic check と manual check が競合した場合、最初の atomic `begin_manifest_check` だけが provider を呼び、後続は `AlreadyChecking`。manual は suppression を bypass するが、in-flight operation は bypass しない。
- explicit verification 中に manual manifest check が来た場合も `AlreadyChecking`。manifest check 中に verify が来た場合も provider / package work を追加しない。
- process crash 後は load recovery が phase を `Failed` へ確定してから、次の explicit operation を許可する。in-flight の古い thread を仮定して再開しない。

#### 8.2 Idempotency

- `begin_*` は identity / phase を確認し、同一 operation の二重開始を no-op / busy にする。
- existing final package があれば transport call を省略できるが、必ず raw size、SHA-256、fresh signature、selected identity を再検証する。検証失敗を cache hit 成功と扱わない。
- existing ready app tree があれば bundle validator を再実行する。mutation / symlink / missing entry は tree invalid とし、valid package から再展開するか fail closed する。
- `record_verified` は同一 identity、同一 canonical path、同一 evidence の既存 `Verified` なら idempotent no-op とする。異なる identity の `Verified` への上書きは拒否する。
- manifest check の同一 candidate 保存では、same identity の verified evidence / path を保持する。digest、key、version、channel、architecture のいずれかが変われば新 candidate として `NotVerified` に戻す。
- cleanup は exact target の `NotFound` を成功扱いにできるが、別の file type、symlink、permission error を成功扱いにしない。cleanup の再実行が current app / DB に波及しないことを保証する。

### 9. Error mapping と privacy boundary

#### 9.1 Persisted state / UI / local log

`UpdateFailure.code` は任意の内部 error string をそのまま保存せず、固定 allowlist の sanitized code へ map する。現行 manifest check の provider code は既存互換のため `provider-*` を維持し、新しい package pipeline は coarse stable category を使う。

| 内部 error family | persisted `failure.code` | UI response / snapshot | local diagnostic log |
|---|---|---|---|
| provider transport / response / invalid manifest | 既存 `provider-network`、`provider-timeout`、`provider-redirect`、`provider-http-status`、`provider-content-type`、`provider-empty-response`、`provider-response-too-large`、`provider-invalid-*` | `update-check-failed` 相当の一般文言。既存 command enum / snapshot の fixed code 境界を維持 | fixed code、phase、version / channel / architecture / artifact ID まで。URL、body、headers、absolute path は出さない |
| selection | `update-selection` | compatible update を選べなかった一般文言 | fixed code と safe release identity |
| package network / HTTP / content type / staging download | `update-download` | package を取得できなかった。再試行導線 | fixed code と phase / safe identity。URL、redirect location、response body は出さない |
| size / SHA-256 mismatch | `update-integrity` | package 検証失敗、現在の app を維持 | fixed code、expected / actual size / digest を許可する場合も raw path は出さない。user data は出さない |
| key lookup / retired / revoked | `update-signature-key` | 署名検証失敗。key bytes は出さない | fixed code、keyId、key status、safe identity。public key bytes は出さない |
| proof encoding / canonical payload / proof mismatch | `update-signature-proof` | 署名検証失敗。proof / payload は出さない | fixed code、keyId、safe identity。proof、payload、public key は出さない |
| gzip / tar / path / root / limit / symlink / permission | `update-archive` | archive 検証失敗、current app を維持 | fixed code、phase、safe identity。archive path は相対値も原則出さない |
| bundle layout / plist / identity / version / executable / architecture | `update-bundle` | app bundle 検証失敗、current app を維持 | fixed code、比較した safe field 名。absolute path、plist raw body、user data は出さない |
| staging path / read / write / rename / cleanup | `staging-path`、`staging-read`、`staging-write`、`staging-rename`、または cleanup 用 `staging-cleanup` | staging を使えない。current app / DB を維持 | fixed code、safe identity。OS error text、absolute path は出さない |
| persisted marker / selected identity / key status 再検証 | `update-revalidation` | apply を中止し、再確認を促す | fixed code、phase、safe identity、比較 field 名。URL / proof / payload / absolute path は出さない |
| interrupted | `check-interrupted`、`verification-interrupted`、`update-interrupted` | 更新処理を再開せず、再試行を促す | fixed code、phase、safe identity まで |
| health / rollback | `update-health-check`、`update-rollback` | current app 維持、必要なら recovery 導線 | fixed code と transaction phase。DB content、backup content、absolute path は出さない |
| state storage / migration | `update-state`、`state-migration-write-failed` | update state unavailable。current app / DB は継続 | fixed code、schema version、phase まで。raw JSON / path / user data は出さない |

UI は既存 snapshot の `version`、`channel`、`architecture`、`artifact`、`verificationState`、`discoveredAt` のみを allowlist に従って受け取る。size / hash / keyId / path / verifiedAt / phase を UI へ足さない。persisted state には size / hash / keyId と relative paths を保存するが、proof、public key、canonical payload、URL、HTTP body、headers、token、absolute path、notebook content、SQLite、backup、user data は保存しない。

`retryAt` は現行 top-level `failure.retryAt` を維持する。manifest provider failure は既存どおり automatic daily interval と retryAt の両方を満たすまで startup check を抑制する。explicit package verification failure は package download を automatic startup に接続しないため `retryAt=now` とし、user action の再試行を妨げない。deterministic integrity / archive / bundle failure を無限 automatic retry にしない。

### 10. Current app、DB、backup、MVP boundary

- package download、archive extraction、bundle validation、state migration のいずれも current `.app` の場所を置換・削除・chmod しない。
- `live/notebook.sqlite` は SQLite の operational source of truth のまま。verification failure、state tampering、staging cleanup failure を理由に live DB を開いて変更、migration、restore しない。
- app-managed `backups/` は apply / DB migration task が明示的に作成・保持する領域であり、package verification cleanup の対象外である。
- Application Support 外のユーザー指定 SQLite export は update cleanup / rollback / complete data deletion の対象にしない。
- 旧 app bundle retention、DB staging copy、migration、restart、health check、rollback の実装は separate apply task に置く。検証が成功しただけでは切り替えない。
- `/notes`、`/notes/new`、`/notes/[id]`、`/backup`、明示保存、確認付き物理削除、CanvasDocumentV1、legacy Markdown の route / API / DB 契約は変更しない。update state は user note data と別の settings file である。

### 11. 後続 coding task

#### Task A: state v2 / migration

対象は `update_state.rs`、必要最小限の `main.rs` wiring、desktop state tests。完了条件は次のとおり。

- v2 schema、phase、PendingUpdate evidence / canonical relative path、`snapshotVersion=1` allowlist を実装する。
- valid v1 state の migration fixture（NotChecked、NoUpdate、Available NotVerified、legacy Verified、Failed、Checking）を v2 へ変換する。
- invalid / unsupported / symlink state、partial fields、path injection、digest mutation、unknown field を fail closed する。
- migration / recovery / transition の atomic write failure で元 state と in-memory rollback を確認する。
- temp file、file fsync、rename、parent fsync、stale temp の safe handling を確認する。
- `Available + NotVerified`、`Available + Verified`、`Failed` の UI snapshot に forbidden fields が出ないことを確認する。
- この task は provider、package、archive、bundle、network、apply を呼ばない。

#### Task B: explicit package verification coordinator

対象は新規 coordinator / command、既存 `update_download.rs`、`update_archive.rs`、`update_bundle.rs`、`main.rs`、state bridge tests。完了条件は次のとおり。

- `manual_update_check` / startup function からは package work を呼ばず、別 command だけが explicit verification を開始する。
- fake manifest transport、fake artifact transport、signature verifier、archive / bundle fixtures で full pipeline をテストする。GitHub / real package は使わない。
- same artifact cache reuse、invalid cache deletion、`.part` cleanup、partial tree cleanup、state checkpoint、crash recovery、double invocation を確認する。
- raw package、archive、bundle の existing DTO を使い、duplicate result DTO を作らない。
- error mapping が fixed persisted code / generic UI / safe local log になることを確認する。
- `StorageLayout` から staging root を受け取る最小 accessor を追加し、module ごとに Application Support path を再計算しない。

#### Task C: apply preparation / DB staging

apply は別 task とする。完了条件は、fresh manifest / trust store / raw package / archive / bundle / selected identity の再検証、migration 前 backup、live DB を直接 mutate しない isolated DB staging、reopen、失敗時の old app / live DB / backup 維持である。`Verified` marker 単独で apply しない。

#### Task D: restart / health / rollback

explicit restart、new app first launch、health check、old app retention、atomic switch、health failure、rollback success / rollback failure の state transition を実装する。success 後だけ old bundle / consumed staging を cleanup し、rollback failure は自動削除・無限 retry をしない。

#### Task E: packaged Apple Silicon QA / docs sync

real `.app.tar.gz` round-trip、Info.plist、arm64 thin、state restart、staging cleanup、current app / DB preservation を disposable environment で確認する。既存 docs の「archive extension 未固定」記述と、実装済み `.app.tar.gz` contract の authoritative source は、別の docs sync task で整合させる。本 task では既存仕様書本文を変更しない。

### 12. Facts、assumptions、unknowns

| ID | 種別 | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 現行 state は schema 1、snapshot は version 1、automatic manifest check は 24 時間制限、manual は bypass、package pipeline は未接続である | `update_state.rs`、`update_check.rs`、`main.rs`、desktop tests |
| F-002 | fact | download は raw compressed bytes を SHA-256 / signature 検証後に sha-based package path へ publishし、archive は `extract/<sha>.tmp` → `extract/<sha>` を atomic rename する | `update_download.rs`、`update_archive.rs`、実装 summary |
| F-003 | fact | bundle validator は selected version、product ID、executable、thin arm64 と no-follow path を検証するが、state へ記録しない | `update_bundle.rs` |
| F-004 | fact | state snapshot は size / hash / signature / proof / URL / response / absolute path を出さない。v2 でも snapshot allowlist を広げない | `update_state.rs`、state / check tests |
| A-001 | assumption / decision | schema 2 migration は、v1 extension の optional ambiguity より explicit evidence / phase invariant の安全性を優先する | 本 summary §3 |
| A-002 | assumption / decision | relative paths は state に保存するが SHA-derived canonical path と完全一致させ、利用時は再構成・照合する | docs の approved relative metadata、既存 result DTO、path safety |
| A-003 | assumption / decision | `Failed` は top-level に集約し、新規 `Available + verificationState=Failed` は出さない。legacy enum は read compatibility として残す | current state の failure invariant と duplicate failure source 回避 |
| A-004 | assumption / decision | explicit verification の fresh manifest fetch は package verification command の内部依存であり、startup / manual manifest check への implicit package side effect ではない | proof / URL を state に保存しない privacy boundary |
| U-001 | unknown | production trusted key table の承認済み値は現行 source にない。signature integration の production verification は key approval 後に必要 | `update_signature.rs` の embedded table と signature summary |
| U-002 | unknown | real packaged Apple Silicon `.app` の最終サイズが既存 archive hard caps に収まるかは未検証 | archive summary の packaged QA boundary |
| U-003 | unknown | apply の OS-level atomic app switch、DB migration protocol、health endpoint、rollback recovery UI は未設計実装である | current MVP / Desktop Alpha scope |
| U-004 | unknown | local diagnostic log module / retention は未実装。ただし本 summary の safe field allowlist を先に適用する | technical foundation の未実装 boundary |
| U-005 | unknown | `MVP_CONTRACT.md` / foundation docs 本文には archive extension 未固定の記述が残り、実装済み `.app.tar.gz` summary と文面が未同期 | docs 本文変更禁止、既存 summaries |

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 既存の modified / deleted / untracked files を確認した。対象外の変更は保持した |
| handoff、canonical docs、指定 summary、対象 source / tests の read-only inventory | PASS | `rg`、`sed`、`nl`、`wc`、`date` のみ。GitHub、network、package、archive、bundle、live DB にはアクセスしていない |
| state v1 と update pipeline の責務照合 | PASS | manifest-only check、独立 DTO、atomic state write、existing privacy allowlist、staging path safety を確認した |
| schema / lifecycle / migration / cleanup / concurrency / error mapping の推奨案 | PASS | 本 summary に一案として固定した。apply / restart / migration / health / rollback の実装は残した |
| 変更範囲 | PASS | 新規 summary 以外の code、config、dependency、lockfile、existing docs、existing tests、generated artifact を変更していない |
| `git diff --check` | PASS | summary 作成後に実行済み。Git 管理対象の既存 worktree 差分に whitespace error はなかった |
| 新規 summary の trailing whitespace | PASS | `grep -n '[[:blank:]]$'` で該当行なし |
| `sh tools/check-summary.sh summary/20260823/0518-specify-desktop-update-state-lifecycle-contract.md` | PASS | 必須 headings、summary 配下、conflict marker なしを確認する |
| Rust / Node tests、lint、build、Prisma、package download | NOT RUN | task 制約。read-only specification task であり、コード・依存変更もないため実行していない |
| GitHub / external network / real package / archive / app bundle / live DB | NOT RUN | task 制約を維持した |
| 作業後 `git status --short` | PASS | 既存の modified / deleted / untracked files を保持し、今回追加した成果物は本 summary のみ |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| R-001 | production trusted key value と key approval / rotation の運用 | signature trust-store approval task。private key は repository に置かない |
| R-002 | real `.app.tar.gz` の size、permission、symlink、bundle resource が archive caps / bundle validator に収まるか | packaged Apple Silicon の disposable clean build / round-trip QA |
| R-003 | apply の atomic app replacement、DB staging / migration、reopen、health、rollback の OS / runtime protocol | apply / migration design task。current app、live DB、backup の preservation test が必要 |
| R-004 | log retention、diagnostic bundle の safe fields、起動時 recovery UI | local diagnostic task。ノート本文、SQLite、backup、URL、absolute path を含めない設計を維持する |
| R-005 | docs 本文の `.app.tar.gz` extension sync | docs-only sync task。今回の既存仕様書本文変更禁止を解除した上で authoritative source を更新する |

本 task で解消できる state lifecycle / persistence / cleanup の判断は残していない。上記は実装外部の値または明示的に separate task へ残した事項であり、後続 state / verification Worker は本 summary の schema、transition、cleanup、error mapping をそのまま入力にできる。

## Next Read

次回の state 実装 Worker は、以下をこの順で読む。

- `summary/20260823/0518-specify-desktop-update-state-lifecycle-contract.md`
- `src-tauri/src/update_state.rs`
- `test/desktop/desktop-update-state.test.js`
- `src-tauri/src/update_check.rs`
- `src-tauri/src/runtime.rs`

explicit verification Worker は上記に加えて次を読む。

- `src-tauri/src/update_download.rs`
- `src-tauri/src/update_archive.rs`
- `src-tauri/src/update_bundle.rs`
- `src-tauri/src/update_signature.rs`
- `src-tauri/src/main.rs`
- `summary/20260823/0312-specify-desktop-update-signature-contract.md`
- `summary/20260823/0259-specify-desktop-app-archive-contract.md`

apply / migration Worker は、state 実装と explicit verification の summary が完了した後に、`doc/implementation/MVP_CONTRACT.md` §9.4、`doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md` §Desktop Alpha の更新契約、`src-tauri/src/runtime.rs`、既存 live DB / backup contract を最小入力として読む。
