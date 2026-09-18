---
summary_type: task-summary
created_at: 2026-08-28 JST
task_kind: worker-task
task_status: done
---

## Objective

診断用 Web Inspector build の起動失敗について、same-origin / Web Inspector ではなく、アプリ独自の single-instance focus socket の確認処理で起きる可能性を source と locked Tauri 2.5.1 から整理する。コード、設定、依存関係、lockfile、生成物、既存 runtime directory は変更しない。

## Direct cause boundary

- `src-tauri/src/main.rs:593-609` の `main` は、Tauri を構築する前に `acquire_instance()` を呼ぶ。
- `src-tauri/src/main.rs:351-371` で Tauri builder を作り、`src-tauri/src/main.rs:372-377` の setup hook の最初の処理として `start_focus_listener()` を呼ぶ。
- `src-tauri/src/instance.rs:563-564` の `start_focus_listener` は、listener thread を spawn する前に `bind_focus_listener()` を同期実行する。
- `src-tauri/src/instance.rs:459-464` は `focus_socket_status()` の結果を `bind_focus_listener_with_status()` に渡す。
- `src-tauri/src/instance.rs:430-456` の `FocusSocketStatus::Unavailable` が `src-tauri/src/instance.rs:491-493` の `single-instance focus endpoint could not be checked` を生成する。
- locked Tauri 2.5.1 の `src/app.rs:1277-1284` は `Ready` event で setup が `Err` になると `panic!("Failed to setup app: {e}")` する。したがって提示された `error encountered during setup hook`、続く setup panic、abort の順序は、アプリ setup error を Tauri 2.5.1 が panic に変換したものと整合する。

ここまでで、問題は `WebviewWindowBuilder`（`main.rs:483-512`）、`.devtools(true)`（`main.rs:492-495`）、window の `show`（`main.rs:533-538`）、sidecar HTTP、same-origin request より前である。`main.rs:450-471` の sidecar 起動も focus listener 成功後なので、このエラーの直接経路には含まれない。Tauri invoke、Web Inspector、same-origin response、sidecar HTTP request は到達していない。

## FocusSocketStatus branches

`focus_socket_status` の source-level mapping は次のとおり。

| connect / metadata 結果 | status | bind 時の扱い |
|---|---|---|
| connect 成功し protocol が `focused` または `not-ready` | `Active` | active endpoint を置換せず error |
| connect 成功したが response が不明、または I/O timeout/read-write failure | `Unknown` | unknown protocol として error |
| connect が `NotFound` | `Missing` | bind を試行 |
| connect が `ConnectionRefused`、metadata が Unix socket | `Stale` | socket を削除して bind（実運用では削除前の確認が必要） |
| `ConnectionRefused`、metadata が regular file / directory 等 | `Unknown` | unknown endpoint として error |
| `ConnectionRefused`、metadata が `NotFound` | `Missing` | bind を試行 |
| metadata が `PermissionDenied` | `PermissionDenied` | permission error |
| 上記以外の metadata error | `Unavailable` | `could not be checked` |
| connect 自体が `PermissionDenied` | `PermissionDenied` | permission error |
| connect 自体のその他の OS error | `Unavailable` | `could not be checked` |

重要なのは、`src-tauri/src/instance.rs:455` の `_` が元の `io::Error` を捨てる点である。従って、提示された最終文字列だけから `Unavailable` の exact errno は確定できない。候補には、regular file に対する connect の `ENOTSOCK`、途中の regular component による `ENOTDIR`、symlink loop、path 長超過、その他の host/filesystem-specific error が含まれる。`EACCES` 相当は通常 `PermissionDenied` branch だが、metadata の二次確認で別 error が出た場合は `Unavailable` に落ちる。

## Path derivation and reuse risk

- `src-tauri/src/instance.rs:131-139` は `CORNELL_DESKTOP_HOME` を優先し、なければ `HOME` を使う。絶対 path が必要。
- `src-tauri/src/instance.rs:217-223` で settings directory は `<selected home>/Library/Application Support/<application id>/settings`。
- release build の application id は `com.cornellmethod.notebook`（`instance.rs:151-154`）。診断 launch command では `CORNELL_DESKTOP_HOME` が設定されるため `HOME` はこの path の選択には使われない。
- `src-tauri/src/instance.rs:166-185` は application id と settings directory の SHA-256 前半 12 bytes を identity にする。
- `src-tauri/src/instance.rs:187-206` は `env::temp_dir()`（Unix では launch 時の `TMPDIR`）を root とし、`<TMPDIR>/cmn-<24 hex>/ .instance.sock`（空白なしで `.../cmn-<hash>/.instance.sock`）を socket path にする。
- `src-tauri/src/instance.rs:225-233` は socket directory を作成し mode `0700` にする。`acquire_instance_at` は `instance.rs:506-508` で settings と socket directory を準備してから lock を取得する。

今回の command の論理 path は次のとおり。

```text
settings = /private/tmp/cornell-method-tauri-target-devtools-20260828/disposable-data/Library/Application Support/com.cornellmethod.notebook/settings
socket   = /private/tmp/cornell-method-tauri-target-devtools-20260828/disposable-tmp/cmn-<hash(settings, release application id)>/.instance.sock
```

同じ `CORNELL_DESKTOP_HOME`、application id、`TMPDIR` を複数回使うと socket path は同じになる。終了失敗や異常終了で socket、regular file、directory、権限変更が残ると次回に影響し得る。active process が同じ advisory lock を保持していれば通常は `acquire_instance_at` が secondary path に入り、socket へ focus request を送る。lock が free なのに active endpoint が残る、または lock/socket の状態が不整合な場合は primary が setup まで進み、`Active` / `Unknown` / `Unavailable` のいずれかで止まり得る。今回の fixed disposable directory の再利用はこの状態を区別できなくする。

作業中に行った read-only inventory では、対象 disposable path に settings の `.instance.lock` と socket directory が存在したが、`.instance.sock` は確認できなかった。これは提示された失敗後の残留状態の観測であり、失敗時の connect errno、active process、以前の socket type を証明しない。既存 artifact、lock/owner の内容、SQLite、ノート、backup、credential、crash report は読んでいない。

## Fact / inference / unknown

### Fact

- exact artifact は `aarch64-apple-darwin` arm64、bundle id `com.cornellmethod.notebook` である（diagnostic build summary の artifact identity）。
- source の setup hook は focus listener を sidecar、WebView builder、window show より先に開始する。
- Tauri 2.5.1 は setup hook の error を `Failed to setup app: ...` panic にする。
- `FocusSocketStatus::Unavailable` は connect / metadata のその他 OS error を含むが、errno を表示しない。
- ユーザー報告の exact launch では `single-instance focus endpoint could not be checked` と abort が観測された。

### Inference

- その観測の直接発生箇所は `bind_focus_listener_with_status` の `Unavailable` branch である可能性が極めて高く、same-origin / Web Inspector の失敗ではない。これは提示された message と call order からの source-based inference。
- fixed disposable `TMPDIR` の再利用は stale socket / regular file / socket directory の残留を再利用し得る。ただし、今回どの filesystem object と errno だったかは未確定。

### Unknown

- 実行時の `UnixStream::connect` errno、`symlink_metadata` の結果、socket の file type / mode、同一 artifact の active process / listener の有無。
- `Unavailable` が stale socket 以外の unsupported OS error、permission path、reused TMPDIR のどれだったか。
- permissive な macOS host でも同じ error が再現するか。Worker host の既知 `127.0.0.1` bind `EPERM` / direct startup abort は今回の endpoint errno の代替証拠ではない。

## Safe minimal user check

実データを使わず、毎回新しい disposable root を使う。runtime directory の削除・上書き、lock/owner の内容、SQLite、ノート、backup、credential、crash report の読み取りは行わない。

```sh
probe_root=$(mktemp -d /private/tmp/cornell-method-focus-probe.XXXXXX)
mkdir -p "$probe_root/home" "$probe_root/data" "$probe_root/tmp"
env HOME="$probe_root/home" \
  CORNELL_DESKTOP_HOME="$probe_root/data" \
  TMPDIR="$probe_root/tmp" \
  CORNELL_DESKTOP_DIAGNOSTIC_WEB_INSPECTOR=1 \
  "/private/tmp/cornell-method-tauri-target-devtools-20260828/release/aarch64-apple-darwin/release/bundle/macos/Cornell Method Notebook.app/Contents/MacOS/cornell-method-notebook"
```

起動前後に、同じ disposable root 内だけを names/types/mode の範囲で確認する。

```sh
find "$probe_root/data/Library/Application Support" "$probe_root/tmp" -maxdepth 6 -print 2>/dev/null | sort
find "$probe_root/data/Library/Application Support" "$probe_root/tmp" -maxdepth 6 -print 2>/dev/null | while IFS= read -r p; do stat -f '%HT %Sp %N' "$p"; done
pgrep -af 'cornell-method-tauri-target-devtools-20260828.*/Contents/MacOS/cornell-method-notebook' || true
```

`find`/`stat` の結果で `.instance.sock` が Unix socket か regular file か、親 directory の mode が読める。`pgrep` は Cornell executable の process identity だけを確認する。再試行時は同じ root を使わず、`mktemp` で新しい root を作る。ユーザーが実施した結果として、終了 code、標準 error の一行、socket path の object type/mode、該当 Cornell process の有無だけを返せば、次の分類に必要な最小証拠になる。

## Minimal remediation boundary (separate coding task)

この task では修正しない。修正 task を切り出す場合は、まず raw `io::ErrorKind` / raw OS error と対象 path の sanitized category を記録して、`Unavailable` を fail-closed のまま原因別に診断できるようにするのが最小 remediation。stale socket の自動削除、regular file の扱い、permission error、unsupported OS error の recovery 方針は、上記 evidence 後に別途決める。Web Inspector の有効化、same-origin guard、Tauri capability、sidecar HTTP、DB/API 契約は変更対象にしない。

検証条件は、fresh disposable root で (1) clean primary bind、(2) stale Unix socket の分類、(3) regular file / non-socket object の fail-closed、(4) active endpoint の非置換、(5) permission / unsupported OS error の分類、(6) 正常終了後の socket cleanup、を確認すること。permissive host で sidecar ready と window 表示まで到達した後に限り、Web Inspector / same-origin / invoke の別問題を別 task として扱う。

## Verification

- 作業前後に `git status --short` を確認した。既存の未コミット変更は保持され、今回の source/config/dependency/lockfile/generated artifact の変更はない。
- source、locked Tauri 2.5.1 source、Cargo manifest/lock、対象 summary、handoff を read-only で確認した。
- 対象 disposable path は names/types-only inventory を実施した。削除、上書き、process kill、DB/backup/crash report 読み取りは行っていない。
- コード変更を行っていないため、build/test/lint は実施していない。

## Changed files

- 意図して作成したのはこの summary のみ。
- `codex-queue/*`、source、設定、依存関係、lockfile、生成物、既存 artifact は変更していない。

## Next Read

- `summary/20260828/investigate-diagnostic-web-inspector-focus-endpoint-20260828-summary.md`
- `HANDOFF_2026-08-28.md`
- `src-tauri/src/instance.rs:430-498`
- `src-tauri/src/main.rs:351-381`
- `/Users/kazuya/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tauri-2.5.1/src/app.rs:1277-1284`
