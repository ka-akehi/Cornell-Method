---
summary_type: task-summary
created_at: 2026-08-21 04:27 JST
task_kind: worker-task
task_status: done
---

## Objective

Desktop Alpha の single-instance marker recovery を調査し、壊れた marker、PID 再利用、focus socket 欠落でも正当な primary を二重起動しない安全な方針を、次の coding task へ転記できる受け入れ条件として固定した。

## Scope

| 項目 | 内容 |
|---|---|
| 対象領域 | Tauri shell の single application instance、marker、Unix focus socket、PID 判定、stale recovery |
| 対象ファイル / ディレクトリ | `src-tauri/src/main.rs`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`test/desktop/desktop-lifecycle.test.js`、`doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`、`doc/testing/TEST_SCENARIOS.md`、`doc/implementation/MVP_CONTRACT.md` |
| 対象外 | Settings、更新 provider / manifest、backup / restore pipeline、完全なデータ削除、diagnostic bundle、MVP の note/API/DB 契約変更 |

## Inputs Read

| 種別 | パス | 確認内容 |
|---|---|---|
| task | `codex-queue/tasks/running/specify-desktop-stale-instance-recovery-e8cee743.task.md` | 調査範囲、変更禁止、完了条件 |
| handoff | `HANDOFF_2026-08-17.md` | 承認済みの Tauri + Node.js sidecar、Application Support layout、PoC 境界 |
| prior summary | `summary/20260821/0313-implement-desktop-single-window-lifecycle-e5ce815e-summary.md` | 前段 lifecycle の実装内容と未検証範囲 |
| prior summary | `summary/20260821/0407-fix-desktop-summary-dirty-close-bridge-09f8862c-summary.md` | 前段 close bridge の変更を single-instance 調査から分離 |
| implementation | `src-tauri/src/main.rs:25-379` | marker 作成・読み取り、focus retry、PID 生存確認、stale removal、listener bind |
| implementation | `src-tauri/src/main.rs:935-1003` | primary setup、sidecar 起動後の listener 開始、guard lifetime |
| tests | `src-tauri/src/main.rs:1037-1141` | 現在の focus socket unit test と、instance recovery test が未追加であること |
| tests | `test/desktop/desktop-lifecycle.test.js:97-168` | 製品 identifier / dynamic port / sidecar cleanup の静的・fixture test。single-instance の実プロセス試験は未実装 |
| dependency | `src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` | `serde`、`serde_json`、Tauri 系のみを root dependency とし、`libc` は transitive に存在するが direct dependency ではないこと |
| contract | `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md:137-175` | single window、前面化、child process cleanup、既存 MVP と PoC の境界 |
| contract | `doc/testing/TEST_SCENARIOS.md:700-783` | Desktop lifecycle / update / backup / diagnostic の受け入れ境界 |
| contract | `doc/implementation/MVP_CONTRACT.md:22-48,276-289` | Desktop Alpha は MVP 外の後続段階であり、現行 route/API/DB/backup 契約を変更しないこと |

## Changes Made

| パス | 変更内容 | 理由 |
|---|---|---|
| `summary/20260821/0427-specify-desktop-stale-instance-recovery-e8cee743-summary.md` | 調査結果、採用案、受け入れ条件を記録 | 次の coding task の入力にするため |

production code、設定、依存関係、lockfile、test、通常の docs は変更していない。既存の未コミット変更（`src-tauri/`、desktop test/fixture、Summary dirty bridge 等）は保持した。

## Findings

| ID | fact / assumption / unknown | 内容 | 根拠 |
|---|---|---|---|
| F-001 | fact | 現在の `.instance.lock` は `OpenOptions::create_new(true)` で作る JSON marker であり、開いた `File` を保持しているだけで advisory OS lock を取得していない。 | `src-tauri/src/main.rs:114-127,306-324` |
| F-002 | fact | marker は空ファイル作成後に `write_all` して `sync_all` するため、書き込み途中の crash では JSON が壊れ得る。読み取り失敗はそのまま起動エラーになる。 | `src-tauri/src/main.rs:246-260,326-333` |
| F-003 | fact | `kill -0` は PID の存在しか見ず、同じアプリの owner か、marker の PID が再利用されたかを証明しない。現行実装は PID が生きていれば socket が無くても `Ok(None)` で新規起動を止める。 | `src-tauri/src/main.rs:267-278,335-343` |
| F-004 | fact | focus socket は sidecar、runtime、window の準備後（`setup` の後半）に bind され、secondary は最大 20 回 × 100ms だけ retry する。live owner の起動途中では socket 欠落と owner 生存が同時に起こる。 | `src-tauri/src/main.rs:280-294,354-379,940-972` |
| F-005 | fact | stale removal は marker 内容を前後で再読しているが、OS lock がないため確認と unlink の間に owner が変わる TOCTOU を解消しない。primary 取得時にも socket を無条件に remove している。 | `src-tauri/src/main.rs:296-304,316-343` |
| F-006 | fact | 現在の unit test は正常な focus request のみで、壊れた marker、schema/application mismatch、死んだ owner、PID 再利用、socket race、二つの `acquire_instance` の競合を検証していない。 | `src-tauri/src/main.rs:1088-1114` |
| F-007 | fact | `src-tauri/Cargo.lock` には `libc 0.2.189` が transitive dependency としてあるが、root package の direct dependency ではない。`fs2`、`fd-lock`、`interprocess`、Tauri single-instance plugin は現行 root dependency にない。 | `src-tauri/Cargo.toml`、`src-tauri/Cargo.lock:367-376,1599-1604` |
| F-008 | fact | 実行環境は Darwin arm64、Rust 1.98.0、Cargo 1.98.0、Node v24.14.0。製品方針は macOS / Tauri + Node.js sidecar で、PoC の固定 port・PoC identifier を製品へ持ち込まない。 | `uname -a`、`rustc --version`、`HANDOFF_2026-08-17.md`、`DESKTOP_ALPHA_TAURI_FOUNDATION.md` |
| F-009 | fact | foundation / MVP contract / test scenarios は single application instance と Desktop 境界を定義しているが、現時点の docs は Desktop Alpha 未実装・lifecycle 未実施の記述を保持している。次の coding task では実装と acceptance evidence を同期する必要がある。 | `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md:5,137-175`、`doc/implementation/MVP_CONTRACT.md:276-289`、`doc/testing/TEST_SCENARIOS.md:700-783` |
| A-001 | assumption | 現在の前段 lifecycle は Alpha の開発途中であり、旧実装を保持したプロセスとの hot upgrade 互換は必須条件にしない。ただし、既存 legacy marker を検出したときに PID だけで奪取しない fail-safe は必要。 | 未コミットの `src-tauri/` と今回 task の stale recovery scope |
| U-001 | unknown | 実機 packaged `.app` で、secondary 起動時の non-zero error を Finder / Dock がどう表示するかは未確認。初回 coding task では Tauri の二つ目の UI を作らず、stderr / sanitized error と no-duplicate を受け入れ、recovery UI は別 task とする。 | GUI / packaged app は前段 summary でも未検証 |

## Recommended Design

### 所有権の原則

`.instance.lock` を JSON として扱う方式を廃止し、同じ path を rename / unlink しない安定した lock file とする。owner の JSON は別の `settings/.instance.owner`（名称は coding task で固定）へ分離する。

1. primary は `OpenOptions::create(true).read(true).write(true)` で stable lock file を開き、macOS の `flock(LOCK_EX | LOCK_NB)` を取得する。取得した `File` を `InstanceGuard` が process lifetime の間保持する。
2. `flock` が `WouldBlock` の間は、相手が正当な application owner であるかを marker の内容や PID だけで再判定しない。socket focus を bounded retry し、成功なら secondary は focus 済みで停止する。
3. lock を取得できた process だけが owner marker の読み取り・atomic replace・socket の stale cleanup・listener bind を行う。lock が取れない process は marker/socket を削除しない。
4. owner marker は同じ settings directory の一時ファイルへ全 JSON を書き、`sync_all` 後に `rename` する。stable lock file 自体は rename しない。これで marker が古い JSON のまま残ることはあっても、partial JSON が現行 owner の判定を壊さない。
5. clean exit / crash のどちらでも advisory lock は OS が解放する。socket pathname は crash 後に残り得るが、次の owner が lock を取得した後だけ、接続不能な stale socket を除去して再 bind する。stable lock file は無条件削除しない。marker も最初に削除せず、atomic replace するか診断用に残す。

### 6 ケースの受け入れ判定

| ケース | 判定条件 | 期待する挙動 | 禁止する挙動 |
|---|---|---|---|
| 正常な live owner + focus socket | secondary の advisory lock が `WouldBlock`、socket が `focused` を返す | 既存 primary を unminimize / show / focus。secondary は新しい Tauri app/window を作らず正常停止 | marker/socket の削除、sidecar の起動、新 window |
| live owner の起動途中で socket 未作成 | secondary の advisory lock が `WouldBlock`、socket がまだ無い／`not-ready` | listener bind を owner setup の最初へ移し、secondary は短い bounded retry。期間内に focus できなければ「既に起動中だが準備中」の sanitized error として停止する。lock が解放された場合だけ acquire loop に戻る | PID が生きているだけを根拠に marker/socket を奪う、二重起動 |
| owner 終了済み、marker/socket だけ残る | advisory lock を取得できる | stale marker は削除せず atomic replace、接続不能な socket だけ lock 保持中に除去、primary 起動継続 | `kill -0` の結果だけで削除する、lock file を unlink する |
| marker JSON 破損、schema/application id 不一致 | lock を取得できるなら stale metadata、lock が `WouldBlock` なら live owner の可能性 | lock 取得後は旧 marker を直接 parse して起動を拒否せず、新 owner の marker を atomic replace。lock が取れない間は marker の破損／不一致を理由に削除せず、focus retry 後に停止 | 破損 marker を無条件削除、incompatible marker を根拠に二重起動 |
| PID が別プロセスへ再利用 | marker の PID と現在の process table が一致しない／一致して見える | PID は診断情報に降格。lock held なら既存 owner として停止、lock free なら stale metadata を置換して起動継続。PID reuse だけで owner を奪わない | `/bin/kill -0` だけで owner 認定または stale removal |
| marker と socket の競合・作成途中 | marker replace / socket bind と secondary 起動が重なる | lock → atomic marker → early listener の順にし、secondary は lock 先行で待つ。lock held 中の socket は触らない。lock free 後に接続不能な pathname だけ再 bind 対象とする | socket の有無だけで owner 判定、他 owner の socket を無条件 unlink、partial marker の読み取り |

### 失敗時の挙動

- advisory lock の `WouldBlock`: 既存 owner 扱い。focus 成功なら正常停止、期限切れなら sanitized な「既に起動中／準備中」エラーで停止。いずれも cleanup しない。
- advisory lock の permission / I/O / unknown error: ユーザー向け起動エラーとして停止。marker、socket、DB、backup は変更しない。
- lock 取得後の marker atomic write failure: Tauri window、sidecar、listener の本格起動へ進まず停止。旧 marker を残し、次回起動で再試行できる。
- lock 取得後に socket が接続可能だが protocol が `focused` / `not-ready` 以外: active endpoint を stale とみなさず、bind failure として停止。socket は残す。
- primary の bootstrap / sidecar / window setup failure: 既存 lifecycle の cleanup を維持し、guard の drop で advisory lock を解放する。DB の自動修復・削除・backup/restore は行わない。

### PID identity verification の位置づけ

新方式では advisory lock が owner identity の authority であり、PID identity verification は不要な経路へ降格する。marker の `pid`、`applicationId`、`schemaVersion` は診断と protocol version 用に残してよいが、PID の生存だけで primary を認定しない。

旧実装の marker を引き継ぐ必要がある場合も、`kill -0` 単独で奪取しない。macOS の executable path / process start identity を確認できない場合は、旧 owner の確認不能として停止し、明示的 recovery UI / ユーザー操作が別途決まるまで自動削除しない。旧実装との hot upgrade を受け入れない場合は、Alpha build 切替時に旧 process を終了してから新 build を起動することを acceptance note に残す。

## Options Compared

| 選択肢 | 評価 | 採否 |
|---|---|---|
| advisory OS lock (`flock`) + stable lock file | crash 時に kernel が解放し、PID reuse / corrupt marker / missing socket を ownership 判定から切り離せる。TOCTOU の cleanup も lock 保持中に限定できる | 採用 |
| process identity verification（`kill -0`、`ps`、macOS proc identity） | `kill -0` は不十分。executable path / start time は補助防御にはなるが、権限・macOS API・PID reuse 差異があり、lock の代替にならない | authority としては非採用。legacy fallback の fail-safe 補助に限定 |
| atomic marker only | partial JSON は防げるが、marker path の existence だけでは live owner と stale owner を区別できず、二重起動を防げない | advisory lock と併用。単独は非採用 |
| marker/socket の無条件削除 | stale cleanup はできるが、TOCTOU、active owner、foreign endpoint、PID reuse で正当な instance を壊す | 非採用 |
| recovery UI | ユーザーに marker corruption / startup conflict を説明できるが、secondary が先に Tauri window を作る設計を増やし、Settings / diagnostic scope へ広がる | 初回 recovery coding task では非採用。sanitized error と no-duplicate を先に固定 |
| `fs2` / `fd-lock` / `interprocess` / Tauri single-instance plugin | lock abstraction のために dependency / plugin surface を増やす。既存の Unix focus protocol と atomic marker を別途設計する必要も残る | 非採用 |

## Implementation Task Contract

### 対象ファイル

- `src-tauri/src/main.rs`
  - `InstanceOwner` と instance path を stable `.instance.lock` + separate owner marker へ分離。
  - macOS `flock(LOCK_EX | LOCK_NB)` wrapper と `InstanceGuard` lifetime を追加。
  - `acquire_instance` の戻り値を `Primary` / `Focused` / `AlreadyRunningNotReady`（名称は実装で固定）に区別し、lock held 中は cleanup しない。
  - marker atomic write、stale socket の lock-held cleanup、early focus listener、sanitized error を実装。
  - `/bin/kill -0` を primary ownership の判定から外す。
- `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock`
  - 推奨は macOS `libc` の direct dependency を追加して `flock` の定数・errno を使うこと。lockfile の既存 `libc 0.2.189` entry を再利用できる見込みだが、Cargo で生成して確認する。新しい lock crate / plugin は追加しない。
- `test/desktop/desktop-lifecycle.test.js`
  - fixed port / PoC identifier / fixture を追加せず、製品 path と recovery contract の静的 assertion を追加。
  - 実際の ownership semantics は Rust unit test を正本にする。
- `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md`
  - 起動順、stable advisory lock、separate atomic marker、focus socket、stale recovery、PoC 境界を追記。現状の「実装未着手」は実装済み範囲と同期する。
- `doc/testing/TEST_SCENARIOS.md`
  - Desktop lifecycle に 6 ケース、crash / corrupt marker / PID reuse / missing socket / concurrent creation、failure behavior を追加し、実機 packaged app の未確認境界を保持。
- `doc/implementation/MVP_CONTRACT.md`
  - §9 の Desktop Alpha status と single-instance acceptance を更新する。ただし現行 MVP の route、API、SQLite/Canvas/Markdown、manual backup、physical delete 契約は変更しない。

### API / test seam

- production path を直接読む関数と ownership state machine を分け、`acquire_instance_at(paths, owner, ...)` のように temp settings directory を注入できる形にする。`CORNELL_DESKTOP_HOME` に依存するだけの test は避ける。
- focus client、clock / retry budget、process identity probe は必要なら trait / closure で注入する。新方式の ownership 判定に process liveness を入れないため、PID の fake process を shell command で作らない。
- Rust unit test で、(1) lock held、(2) invalid marker + lock free、(3) schema/application mismatch + lock free、(4) stale socket + lock free、(5) lock held + corrupt marker/socket absent、(6) PID value が変わっても lock state だけが判定を決める、を temp directory で再現する。
- marker は temp file → `sync_all` → same-directory `rename` を検証し、partial JSON を reader が観測しないことを確認する。stable `.instance.lock` が rename / unlink されないことも assertion にする。
- `test/desktop/desktop-lifecycle.test.js` は `node --test` で実行できる静的契約と dynamic loopback fixture に限定し、固定 port、PoC identifier、10,000 note fixture を製品 recovery test へ移さない。

### Acceptance commands

次の coding task の最小受け入れコマンド:

```sh
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --offline -j 1 --manifest-path src-tauri/Cargo.toml
node --test test/desktop/desktop-lifecycle.test.js
npm run lint
git diff --check
```

加えて Apple Silicon の packaged `.app` で、primary 起動中の二重起動、起動途中の二重起動、正常終了後の marker/socket 残留、SIGKILL 後の再起動、壊れた marker、PID reuse 相当、focus、process tree cleanup を実機確認する。`npm run build` は前段 summary に既知の `fabric`、`konva`、`@prisma/adapter-pg` 等の依存解決 failure が残るため、この調査 task の PASS 根拠にはしていない。

## Verification

| 確認項目 | 結果 | 備考 |
|---|---|---|
| 作業前 `git status --short` | PASS | 前段の未コミット変更を確認し、変更せず保持 |
| 現行経路の静的確認 | PASS | `main.rs`、Cargo、lifecycle test、3 docs、prior summary を確認 |
| macOS/Tauri 実行環境確認 | PASS | Darwin arm64、Rust/Cargo、Node version を確認 |
| dependency inventory | PASS | root Cargo dependency と lock の `libc` transitive 状態を確認 |
| production code/config/test/doc diff | PASS | 本 summary 以外は変更していない |
| runtime test execution | 未実施 | 調査 task の変更禁止と既存 generated target を増やさない制約のため。前段 summary の既存検証結果を参照 |

## Remaining Unknowns

| ID | 未確認事項 | 次に必要な根拠 |
|---|---|---|
| U-001 | `flock` を direct `libc` dependency で呼ぶか、小さな macOS FFI にするかの最終実装選択 | 次の coding task で安全性・lint・cargo check を比較。推奨は direct `libc` |
| U-002 | 旧 `create_new` 実装で起動した live process との hot upgrade | packaged Alpha の切替手順を決め、旧 process は終了してから実機検証。自動奪取はしない |
| U-003 | secondary の non-zero error が Finder / Dock 上で見えるか | packaged `.app` の実機確認。recovery UI は別 task |
| U-004 | socket pathname の stale 判定と foreign endpoint の扱い | coding task の Unix socket bind test。active protocol response があれば削除せず停止 |

## Next Read

次の coding task は以下だけを最初に読む。

- `summary/20260821/0427-specify-desktop-stale-instance-recovery-e8cee743-summary.md`
- `src-tauri/src/main.rs:25-379`
- `src-tauri/src/main.rs:935-1003`
- `src-tauri/Cargo.toml`
- `test/desktop/desktop-lifecycle.test.js:97-168`
- `doc/technical/DESKTOP_ALPHA_TAURI_FOUNDATION.md:137-175`
- `doc/testing/TEST_SCENARIOS.md:720-783`
- `doc/implementation/MVP_CONTRACT.md:276-289`
