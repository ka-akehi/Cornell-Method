# Post-MVP 依存関係付き実装計画

作成日: 2026-08-08

更新日: 2026-08-24

状態: MVP Gate 0 完了。Tauri + Node.js サイドカーを Desktop Alpha 基盤として承認済み。製品識別子 `com.cornellmethod.notebook`、製品実装ディレクトリ `src-tauri/`、Application Support の保存構成は承認済みである。user data / SQLite bootstrap、single-instance recovery、既存 primary lifecycle、Settings shell / bridge / entrypoint の部分実装と責務 audit は完了している。更新 apply、staged migration、rollback / recovery、candidate health、checkpoint persistence、cleanup の backend pipeline も実装済みであるが、Desktop Alpha 全体と実 macOS packaged runtime の受け入れは未完了である。

## 1. 位置づけ

この文書は、MVP Gate 0 後に Desktop Alpha を先行し、その後に Phase 2 と Public Mac Release を進める順序、依存関係、受け入れ境界、Worker task の分割方針を定める。現行 MVP の route、API、保存、削除、復習契約は変更しない。

判断の正本は次のとおりとする。

- 製品全体方針、MVP / Desktop Alpha / Phase 2 / Public Mac Release の境界: [`PRODUCT_SPEC.md`](../requirements/PRODUCT_SPEC.md)
- 現行 MVP の実装・受け入れ契約: [`MVP_CONTRACT.md`](MVP_CONTRACT.md)
- 現在の実装状態: [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)
- 現行 MVP のテスト観点と証跡: [`TEST_SCENARIOS.md`](../testing/TEST_SCENARIOS.md)
- 将来の責務境界: [`TARGET_ARCHITECTURE.md`](../technical/TARGET_ARCHITECTURE.md)
- 最新の再開地点: [`HANDOFF_2026-08-22.md`](../../HANDOFF_2026-08-22.md)

本計画の task 名は、Manager が別途作成する 1 task 1 file の分割例である。task file の作成、enqueue、実装着手、実装完了を示さない。

日数、工数、release date、性能の合格数値は、根拠となる実測と承認がないため定義しない。

## 2. 変更しない製品境界

全段階で次の境界を維持する。

- ノートデータの唯一の正本は、Mac の user data directory に置く SQLite とする。
- 現行 MVP の `/notes`、`/notes/new`、`/notes/[id]`、`/backup`、API、明示保存、確認付き物理削除、詳細画面内の復習を遡及変更しない。
- `CanvasDocumentV1` を Canvas 本文の正本とし、legacy Markdown note を自動変換しない。
- DB backup は SQLite の保全・復元用コピーであり、ノートの外部出力形式と区別する。
- ノート操作は完全 offline とし、ネットワーク利用は更新 manifest の確認と更新 package の取得に限る。
- クラウド DB、クラウド同期、外部推論 API、Postgres への移行、認証、共有、共同編集は対象外とする。
- 主な配布経路は Mac desktop とし、開発・検証用の Next.js Web 起動経路を維持する。
- app bundle は実行コードと配布資産、user data directory は live SQLite、app 管理 backup、設定、local log を置く領域として分離する。live DB を `.app` 内や同期フォルダへ置かない。
- Phase 2 の機能を Desktop shell 選定へ混ぜない。
- PDF と packaged Playwright / Chromium を Desktop PoC、Desktop Alpha、Public Mac Release の必須条件にしない。
- モバイル向けの本格最適化は Desktop Alpha に含めない。開発用 Web の既存 responsive contract は回帰確認を続ける。

## 3. 現在地と release boundary

### 3.1 現在地

MVP Gate 0 は完了済みである。発注者が実施した人力結合テストは、テスト中に見つかった問題の修正と再確認を含めて完了している。この判断を現行 MVP の受け入れ境界とし、Browser runtime、mobile、wheel / trackpad、実 DB read-back、E2E、外部 Postgres、追加の build 証跡や明示承認を Desktop 着手前の blocker に戻さない。

現行コードには、ノート CRUD、Cue、タグ候補と検索、`CanvasDocumentV1` 本文、Summary、詳細画面内の復習、確認後の物理削除、SQLite の手動 backup が存在する。製品側 `src-tauri/` には user data / SQLite bootstrap、stable advisory lock を使う single-instance recovery、primary lifecycle、window state、dirty close bridge、sidecar cleanup が実装されている。更新系には provider、manifest、selection、download、signature / SHA-256、archive / bundle validation、update state、pending verification、`ApplyPreparation` を起点とする staged migration、rollback / recovery、candidate health、checkpoint persistence、cleanup の backend 実装と static / disposable test 証跡がある。`apply_verified_update`（引数なしの明示 command）は verified artifact を再検証して `ApplyPreparation` の atomic state transition と explicit restart handoff へ渡す。これは実 provider / package runtime、macOS packaged app の health / switch / rollback、packaged GUI の完了を意味しない。Settings は Mac menu と Web gear / mobile trigger の bridge、既存 primary WebView 内の 3カテゴリ modal shell までで、更新 UI 操作、backup / restore、完全削除などの操作は未実装である。

2026-08-21 の責務抽出と最終 audit では、Rust / UI ともに現時点で追加分割不要と判定した。Desktop Alpha 全体の完了とは扱わず、実 provider / package runtime、macOS packaged app の health / switch / rollback / cleanup、packaged Apple Silicon GUI、dynamic loopback の実 runtime、browser / DB read-back、backup / restore、完全なデータ削除、診断は未確認または未実装のまま残す。

### 3.2 Release boundary

| Release boundary | 含める範囲 | 含めない範囲 |
| --- | --- | --- |
| 現行 MVP | 現行 Web MVP の route、API、明示保存、物理削除、復習、手動 backup | Desktop shell、更新、restore、Phase 2 |
| Desktop PoC | Electron と Tauri + Node.js sidecar の同条件比較、shell 選定材料 | 製品機能の追加、PDF、Canvas PNG、Intel、古い macOS の保証 |
| Desktop MVP / Desktop Alpha | 現行 MVP、Desktop lifecycle、Settings、更新、migration safety、手動 backup / restore、診断、privacy、障害時挙動 | autosave、Undo、定期 backup、検索改善、Canvas PNG、PDF、Public 配布要件 |
| Desktop Alpha 後の Phase 2 | 決定済みの Canvas PNG と検索 UX・規模要件、データ保全の追加判断、autosave、Undo、復習・タグ等 | shell 選定条件への遡及追加 |
| Public Mac Release | 対象 architecture / macOS、署名、notarization、一般公開配布、公開向け release 運用 | 未採用の Phase 2 機能、Local LLM |
| Local Intelligence | 採用された場合の完全ローカル LLM 機能 | Public Mac Release の必須条件 |

後段の demo や調査結果を前段の完了扱いにしない。各 release boundary は、直前までの承認済み契約を継承する。

## 4. Gate 0 完了記録

Gate 0 は発注者判断で完了している。後続 Manager / Worker は次を守る。

- Gate 0 の再承認、Browser backend の復旧、追加の runtime 証跡を Desktop PoC の開始条件にしない。
- 任意 QA で新しい実測 FAIL が見つかった場合は、Desktop PoC と分けて 1 surface / 1 failure family の MVP 修正 task にする。
- 現行 MVP の契約変更が必要になった場合は `MVP_CONTRACT.md` と影響する詳細設計を別 task で更新し、Desktop shell の都合だけで暗黙変更しない。

## 5. Desktop PoC の比較契約

### 5.1 固定する入力と環境

Electron と Tauri + Node.js sidecar は、次の条件を揃えて比較する。

- 同じ現行 MVP baseline と同じ route / API / Canvas 契約を使う。
- PoC task の開始時に同じ baseline identifier を固定し、両候補の証跡へ記録する。
- 同じ deterministic な 10,000 note SQLite fixture を使う。両候補で生成条件と seed を揃え、fixture 自体を製品 DB や正式配布物として扱わない。
- 同じ Apple Silicon 開発 Mac と、その Mac の現行 macOS 環境で測定する。
- cold start 用の clean user data と、操作・メモリ測定用の同じ populated fixture を候補間で使い分ける。
- build mode、測定開始条件、測定手順、記録単位を揃える。片方だけに有利な cache、常駐 process、追加機能を持ち込まない。

Desktop Alpha の対象 architecture は Apple Silicon である。Intel は Public Mac Release で再検討し、PoC / Alpha の blocker にしない。

この PoC で検証済みと表明できる macOS は、使用した開発 Mac の現行環境だけである。minimum deployment target と古い macOS の保証は PoC 結果を確認してから別途決める。

### 5.2 両候補で成立を確認する経路

- shell が local runtime を起動し、ready 後に 1 primary window を開く。最後の primary window を閉じてアプリを終了すると、local runtime と app-owned child process をすべて停止し、orphan process を残さない。
- shell の main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper、関連子 process を許容する。OS process が複数存在することだけを PoC の不合格理由にしない。
- loopback の待受範囲、port 衝突、二重起動、通常終了、起動失敗、app-owned process tree cleanup を観測できる。
- PoC 専用 user data directory で Prisma Client、SQLite の新規作成、pending migration、read / write、終了、再起動後 persistence が成立する。
- app bundle に live DB を書き込まず、開発用 Next.js Web 経路も維持できる。
- 現行 MVP の主要 route を表示し、同じ fixture で一覧、詳細、編集、明示保存、再読込、検索、復習、物理削除、手動 backup の smoke を実行できる。破壊操作は disposable copy で行う。
- packaged app と DMG の作成可能性、Desktop Alpha の app 内更新契約を実装できる見通しを確認する。Developer ID、notarization、一般公開サイトの確定は要求しない。

### 5.3 必須比較軸

| 比較軸 | 記録する内容 |
| --- | --- |
| cold start | process 起動からノート一覧が操作可能になるまでの実測。測定条件、cache 状態、失敗を併記する |
| 操作反応 | 同じ 10,000 note fixture と同じ操作で、一覧表示、検索、詳細遷移、編集・保存等の反応を比較する。数値目標は PoC 前に追加しない |
| process 合計メモリ | shell の main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper、関連子 process を含む合計を同じ状態で記録する |
| 成果物サイズ | packaged `.app`、DMG、同梱 runtime / native resource のサイズと内訳を同じ基準で記録する |
| SQLite / Prisma / migration | clean DB、既存 fixture、pending migration、失敗時の非破壊性、再起動後 persistence が成立するか |
| lifecycle | ready、single application instance / 1 primary window、既存 primary window activation、shutdown、app-owned process tree cleanup、起動失敗を実装できるか |
| DMG・アプリ内更新の見通し | DMG 作成、静的 manifest、architecture / OS compatibility の端末内判定、取得、再起動時適用、rollback / recovery を実現できる見通しと制約 |
| 実装・保守難度 | shell 固有 code、sidecar 管理、native module、debug、test、release 作業、更新追従、障害切り分けの複雑さ |
| 安全性 | loopback 制限、権限、resource path、package integrity、更新と DB migration の分離、失敗時に現行版を維持できるか |
| 総コスト | framework / dependency の license、Apple 関連費用、配布 storage / bandwidth、CI の architecture / 実行時間、保守工数を含む見積りと不確実性 |

測定できなかった項目は未測定として残す。推測値で候補間の差を埋めない。

### 5.4 選定規則

- cold start、操作反応、process 合計メモリ、成果物サイズの差が再現可能な実測で明確な場合は、より軽い候補を優先する。
- 差が小さい、測定ごとに逆転する、指標ごとに優劣が分かれる場合は、保守しやすさと安全性を優先する。
- SQLite / Prisma / migration / lifecycle、DMG、更新の成立に blocker がある候補は、性能が軽くても採用しない。
- 比較結果には採用理由、却下理由、未測定、残る risk、総コストの前提を記録し、発注者が最終選定する。

「明確な差」を判定する数値 threshold はこの文書で新設しない。PoC の測定方法と結果を基に比較報告で判断する。

### 5.5 PoC の対象外

- PDF export、packaged Playwright / Chromium。
- Canvas PNG export と、その解像度、背景、保存先等の詳細。
- autosave、Undo、soft delete、専用復習タスク、検索改善、定期 backup、NoteCard / D&D。
- Intel artifact、universal binary、古い macOS の互換保証。
- 更新 provider の具体的な取得 URL、承認済み field allowlist 以外の manifest wire-level details、署名アルゴリズム名・encoding・canonicalization・鍵値、package archive の具体的な拡張子、具体的な user data path、minimum deployment target の確定。製品 bundle ID は承認済み。

### 5.6 Worker task 分割例と完了条件

| task file 例 | 1 task の目的 | queue |
| --- | --- | --- |
| `poc-electron-current-mvp-desktop.task.md` | Electron で共通 PoC contract と測定結果を作る | Common |
| `poc-tauri-sidecar-current-mvp-desktop.task.md` | Tauri + Node.js sidecar で同じ contract と測定結果を作る | Common |
| `verify-electron-prisma-sqlite-migration.task.md` | Electron 候補の Prisma / SQLite / migration 経路だけを検証する | API |
| `verify-tauri-sidecar-prisma-sqlite-migration.task.md` | Tauri 候補の同じ DB 経路だけを検証する | API |
| `qa-desktop-poc-current-mvp-smoke.task.md` | 同じ fixture と操作による packaged UI smoke を記録する | UI |
| `compare-desktop-shell-poc-evidence.task.md` | 全必須軸を比較し、選定 ADR の判断材料を作る | Common |

候補ごとの task は独立 directory、manifest、build artifact を使う。同じ root package / config を安全に分離できない場合は直列化する。

PoC は、両候補に同じ必須項目の結果があり、未測定と blocker が明示され、発注者が shell 選定を承認した時点で完了する。PoC artifact、fixture、DB を製品データや正式実装として再利用しない。

## 6. Desktop Alpha の承認済み契約

この節は発注者が承認した契約を記録するもので、全体が packaged runtime まで検証済みという意味ではない。provider normalization、manifest validation、compatible selection、download、signature verification、archive / bundle validation、update state、pending verification、verified artifact の明示 apply preparation、staged migration、apply 後の DB / app 切替、rollback / recovery、candidate health、checkpoint persistence、旧 bundle cleanup は backend 実装済みで、focused static / disposable test の証跡がある。実 provider / package runtime、macOS packaged app の更新結合 QA、packaged Apple Silicon GUI は未検証である。

### 6.1 Lifecycle

- single application instance / 1 primary window とする。
- 二重起動時は新しい application instance / primary window を増やさず、既存 primary window を前面へ出す。
- Settings modal、確認 dialog、OS file dialog は primary window に数えず、新しい独立 primary window を作らない。
- shell の main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper 等の内部 process を許容する。
- 最後の primary window を閉じると application instance を終了し、local runtime と app-owned child process をすべて停止して orphan process を残さない。
- 次回起動は常にノート一覧から開始し、前回 route を復元しない。
- window size / position を保持し、現在の画面領域外なら見える位置へ補正する。
- 未保存状態で終了する場合は「保存して終了」「保存せず終了」「戻る」を提示する。
- 「保存せず終了」は未保存内容を破棄する。「戻る」、Escape、dialog 外操作は終了を取り消す。
- 「保存して終了」の save が失敗した場合は終了せず、編集内容と dirty 状態を保持する。
- 現行の明示保存を維持し、異常終了用 draft / autosave を含めない。

### 6.2 Settings

- 基本区分は General、Updates、Data and Backup とする。
- Mac では Settings menu、開発用 Web では gear から開く。
- 正確な表示文言と項目配置は実装時の別 task で決める。
- `/backup` は Settings の代替機能が完成して受け入れ確認を通るまで維持する。その後、Desktop UI では段階廃止する。現行 route の削除をこの計画更新では行わない。
- app 管理 backup からの復元と外部 backup file からの復元は別の入口にする。正確なボタン文言は実装 task で決める。

### 6.3 更新

- 初期 provider は GitHub Releases とする。provider adapter は応答を provider-neutral な manifest へ正規化してから strict validation へ渡し、provider の並び順、文字列順、raw response、release notes を候補選択の根拠にしない。具体的な取得 URL・payload 形式は固定しない。
- 初期インストールは DMG とする。DMG は初回配布用であり、アプリ内更新の適用 package とは役割を分ける。
- アプリ内更新の package は Apple Silicon 向け `.app archive` とする。archive の具体的な拡張子は未決定のまま残す。
- Desktop Alpha の artifact と packaged QA の対象 architecture は Apple Silicon の `aarch64-apple-darwin` だけとする。Intel は Public Mac Release で別途判断し、Alpha の blocker や成果物にしない。
- 起動後に非同期で更新を確認する。自動確認は最大 1 日 1 回とし、手動確認も可能にする。
- 更新確認の ON / OFF 設定は設けない。
- VS Code に近いアプリ内更新を採用し、更新 package はバックグラウンドで取得できるようにする。取得後も自動適用せず、ユーザーが「再起動して更新」を選んだ場合だけ、明示的な再起動を経て適用する。
- backend の `apply_verified_update` は引数なしの明示 invoke command とし、`Available` かつ `Verified` の candidate に対して manifest / candidate identity、signature・digest、canonical staging path、archive、bundle（bundle ID / version / architecture / arm64 Mach-O）を再検証する。検証後に `ApplyPreparation` を atomic に保存し、その state を explicit restart handoff へ渡す。自動 check、startup check、download 完了、pending notification だけでは apply / restart しない。
- persisted `ApplyPreparation` を起点に staged migration を実行し、pending migration がある場合だけ適用直前の safety backup、candidate bundle 内の `Contents/Resources/runtime` を migration source とする DB staging copy、古い順の migration、schema / integrity / foreign key / reopen を行う。pending migration がない場合は migration と migration 用 safety backup を実行しない。
- migration の read-back では既存 table の列、row、Notebook の legacy Markdown、NotebookCanvas の `CanvasDocumentV1` を保持していることを確認し、成功後だけ staged DB と live DB を atomic switch する。failure / interruption は fail-closed に保持し、自動 migration を再実行しない。
- `RestartHealthCheck` は `HealthPending`、`BundleSwitching`、`BundleSwitched`、`CleanupPending`、`RollbackPending` の checkpoint を atomic に永続化する。candidate/current の path、symlink、bundle identity、version、architecture を検証し、candidate health には app bundle root ではなく固定 runtime root `Contents/Resources/runtime` を渡す。
- candidate health 成功前は current app、live DB、app 管理 safety backup を保持する。失敗時は rollback、SQLite restore、旧 bundle 復帰、typed failure を fail-closed に扱い、成功後だけ旧 bundle、staged artifact、不要な safety backup を cleanup する。
- 更新確認・取得失敗時も現行版を利用可能にする。失敗を「更新あり」として通知せず、手動確認または次回の確認で再試行できるようにする。
- manifest は `releases[]` を持つ。端末側で channel、version、architecture、macOS compatibility を判定し、同一 channel の現行 version より新しい compatible version だけを選ぶ。downgrade は行わない。
- 各 release の `keyId` はアプリが保持する現行鍵または次期鍵を参照する。package は公開鍵署名と SHA-256 の両方を検証し、manifest から新しい信頼根や公開鍵を追加しない。
- package の署名・SHA-256 検証に失敗した場合は取得物を破棄し、現行版を維持する。
- 同じ保留更新を modal で繰り返し通知せず、Settings 等で状態を確認できるようにする。
- 複数版を飛ばす場合は、端末で利用できる compatible な最新 version へ更新し、DB migration は古い順に実行する。
- manifest はユーザー固有情報を持たず、端末固有 ID、利用状況、ノート内容、検索内容を送信しない。
- App Store 配布を前提にしない。
- Developer ID、notarization、Apple Developer Program、一般公開用配布サイトは Public Mac Release で判断し、Desktop Alpha の必須条件や blocker にしない。

#### Manifest validation boundary

manifest の検証は、provider の応答を正規化した後に、次の論理 field allowlist と値の境界で行う。root、release、artifact、signature の object に未知 field があれば、対象 release だけでなく manifest 全体を拒否する。

| object | 許可する field | 必須・値の境界 |
| --- | --- | --- |
| root | `productId`, `schemaVersion`, `releases` | `productId` は `com.cornellmethod.notebook` と一致する。`schemaVersion` は必須の `1` とし、未知 version は fail closed とする。`releases[]` は必須配列で、空配列は有効な「更新なし」とする。 |
| release | `channel`, `version`, `architecture`, `minVersion`, `maxVersionExclusive`, `artifact`, `signature` | `channel` は `stable` 固定、`version` は SemVer 互換、`minVersion` は必須の macOS 下限、`maxVersionExclusive` は任意の排他的上限とする。macOS version は数値 component で比較する。 |
| artifact | `artifactId`, `format`, `url`, `sizeBytes`, `sha256` | `artifactId` は必須の opaque immutable ID とし、同じ package には同じ ID を使う。`format` は抽象値 `app-archive`、`sizeBytes` は正の整数 byte 数、`sha256` は 64 文字の lowercase hexadecimal とする。 |
| signature | `keyId`, `proof` | `keyId` と opaque な `proof` を必須とする。proof は package digest と release metadata をまとめて署名した結果を表すが、署名アルゴリズム名、encoding、canonicalization、鍵値は固定しない。 |

実際の最低対応 macOS version と deployment target は、Apple Silicon の packaged PoC 後に決める。`minVersion` / `maxVersionExclusive` の validation boundary を先に固定することは、最低対応 version の数値を確定することを意味しない。

root、必須 field、型、SemVer、macOS range、artifact metadata、URL、signature proof、重複（duplicate）の検証に失敗した場合は manifest 全体を拒否する。`stable` 以外の channel、未知 architecture、未知 format はその release だけを対象外とし、他の有効な release を評価する。Desktop Alpha で評価する architecture は `aarch64-apple-darwin` である。

`version` は SemVer の precedence で比較し、`releases[]` の並び順や文字列順を使わない。prerelease は対象外とし、build metadata は version の大小判定に使わない。対象 channel、architecture、format、macOS range に適合し、現行 version より新しい候補のうち、最も高い SemVer precedence の release を選ぶ。空配列、または非対象 release だけの manifest は有効な「更新なし」とする。

同じ channel、version、architecture、macOS target（`minVersion` と `maxVersionExclusive` の組）の重複が manifest 全体にあれば、対象外 release を含めて manifest 全体を拒否する。`maxVersionExclusive` がない target は、上限なしの target として重複判定する。

artifact URL は公開 direct HTTPS とする。取得時に許可する redirect は HTTPS から HTTPS への redirect だけであり、HTTP への downgrade、credential、token、ユーザー固有 query を含む URL は拒否する。package format は `app-archive` という抽象値だけを契約に置き、archive の具体的な拡張子は固定しない。

manifest の root `schemaVersion: 1` は manifest の version namespace であり、local `settings/update-state.json` の schema version と分離する。update state には再起動後の検証に必要な artifact metadata、すなわち version、channel、architecture、`artifactId`、`sizeBytes`、`sha256`、`keyId`、verification state、app 管理 staging からの relative package path、時刻だけを保存する。URL、provider response 全体、token、DB、user path は保存しない。

### 6.4 更新適用時の未保存内容

- 更新を適用する時点で未保存内容がある場合は「保存して更新」「保存せず更新」「戻る」を提示する。通常終了時の 3 選択肢とは別の操作契約とする。
- 「保存して更新」は、保存成功後に再起動して更新する。保存失敗時は更新せず、編集内容と dirty 状態を保持する。
- 「保存せず更新」は、未保存内容を破棄して再起動し、更新する。
- 「戻る」、Escape、dialog 外操作は更新を中止し、編集へ戻る。

### 6.5 DB、migration、backup、restore

- app bundle と Application Support 内の user data を分離し、ユーザーの Mac 内にある live SQLite をノートデータの唯一の正本とする。
- アプリ更新や reinstall で live DB、app 管理 backup、設定を暗黙に削除しない。
- pending migration がある場合だけ、更新適用前に app 管理 safety backup を作る。
- 更新 package は Application Support 内の app 管理 staging に保管し、DB compatibility はユーザー固有情報を manifest へ載せず、端末内の DB staging copy で migration と reopen を検証する。
- `settings/update-state.json` は local state schema version を持つ独立した state とし、manifest root の `schemaVersion: 1` と混同しない。再起動後の検証に必要な version、channel、architecture、`artifactId`、`sizeBytes`、`sha256`、`keyId`、verification state、app 管理 staging からの relative package path、時刻、recovery checkpoint、typed failure を atomic に保存する。URL、provider response 全体、token、DB、user path、ノート本文などの user data は保存しない。checkpoint は `HealthPending`、`BundleSwitching`、`BundleSwitched`、`CleanupPending`、`RollbackPending` を使い、failure / interruption 後も candidate を保持する。
- migration は persisted `ApplyPreparation` を起点に DB staging copy 上で古い順に実行し、package 検証、migration、schema、integrity、foreign key、reopen、read-back に成功した場合だけ新しい app / DB へ切り替える。既存列と Notebook / Canvas / legacy Markdown のデータ保持を read-back で確認する。
- 旧 app が新しい DB schema を検出した場合は live DB を変更せず、現行版への更新または backup restore を案内する。旧 app が live DB を直接 migration しない。
- package または DB staging の検証、切り替え、更新後の起動・health check のいずれかに失敗した場合は、現行 app、live DB、app 管理 backup を維持して rollback する。rollback では必要に応じて SQLite safety backup を atomic restore し、旧 bundle へ復帰する。
- candidate/current の path、symlink、bundle identity、version、architecture を検証し、candidate health には固定の `Contents/Resources/runtime` を渡す。app bundle root を runtime root として扱わない。
- `RestartHealthCheck` / `Rollback` / `Cleanup` の checkpoint は `HealthPending`、`BundleSwitching`、`BundleSwitched`、`CleanupPending`、`RollbackPending` として atomic に永続化する。failure / interruption 後に staged migration を自動再実行せず、typed failure を fail-closed に保持する。
- 新版の初回起動と health check が成功するまで旧 app bundle を保持し、成功後にだけ旧 bundle、不要な staged artifact、migration safety backup を cleanup する。
- DB schema が現行アプリと compatible で pending migration がない場合は migration を実行しない。
- app 管理 safety backup は migration 前と restore 前だけに作成する。保持世代数などの retention policy は未決定のまま残す。
- 定期、日次、通常起動時、データ変更時の自動 backup は Desktop Alpha に含めない。
- 手動 backup はユーザーが保存先を選ぶ平文 SQLite export とする。app 管理 backup の retention policy を外部 export file へ適用しない。
- restore は app 管理 backup 一覧と外部ファイル選択を別入口にする。両入口を staging validation、明示確認、atomic switch、restart の同じ pipeline へ流す。
- restore 前に現在の live DB を app 管理 safety backup として保存する。
- restore file は SQLite integrity、foreign key、schema / migration compatibility、必須データ、存在する全 `CanvasDocumentV1` を検証する。
- atomic switch 後に DB を reopen できることまで検証する。validation または reopen に失敗した場合は restore を中止し、現在の live DB を変更しない。
- 古い backup は staging copy に必要な migration を古い順に適用してから restore する。アプリより新しい形式はその場で restore せず、先に compatible なアプリへの更新を求める。
- 外部 file を選択済みの状態でアプリ更新が必要になった場合は、選択した file の staging copy を Application Support 内の保留復元領域へ保存し、更新と再起動後に復元再開を案内する。
- 更新後も自動 restore は行わず、ユーザーの明示確認後に再開する。
- legacy Markdown note は互換対象として維持し、restore を理由に Canvas へ自動変換しない。

### 6.6 完全なデータ削除

- アプリのアンインストールと user data 削除は別操作とする。更新、reinstall、通常の uninstall を完全なデータ削除として扱わない。
- 通常のアンインストールでは live DB を削除しない。Settings の完全なデータ削除だけが、明示確認を経て app 管理 data を削除する操作である。
- Settings の完全なデータ削除は、live DB、app 管理 backup、設定を対象とする。
- ユーザーが任意の場所へ保存した外部 SQLite export は削除しない。
- 入力確認を伴う明示操作とし、誤操作で実行できないようにする。正確な確認文言は実装 task で決める。
- 完了後は初回利用時と同じ状態へ戻す。

### 6.7 診断、privacy、権限、暗号化

- 外部 telemetry と crash report の自動送信を行わない。
- Application Support に本文等を含まない local log を保持する。保持期間、容量、世代整理の細則は未決定とし、実装 task で別途定める。
- 手動生成する診断 ZIP には error log、時刻、component、sanitized stack、app version、macOS version、CPU architecture、DB schema version を含める。
- 診断 ZIP に title、body、Cue、Canvas、query、DB 本体、token、user path、crash dump を含めない。
- Full Disk Access を要求せず、Application Support と、backup / restore / export でユーザーが明示選択した file だけへアクセスする。
- note 操作は完全 offline とし、network は更新確認と更新取得だけに使う。
- app 独自 DB encryption と app 専用 password / Touch ID lock は Desktop Alpha に含めない。macOS file permission を前提とし、FileVault を推奨する。
- 手動 export backup は平文 SQLite であることを案内する。暗号化 backup は後続判断とする。

### 6.8 DB startup と failure

- 通常起動は DB open と schema 状態だけを確認し、全件 integrity check を毎回行わない。
- 詳細 integrity check は異常終了後、migration 後、restore 後等の必要時に限定する。
- 初回利用で DB がない場合は新規作成する。
- 過去の利用記録があるのに live DB がない場合は空 DB を自動作成せず、restore を主操作とする復旧画面へ誘導する。
- DB が破損・読み取り不能の場合は自動修復しない。「診断情報を書き出して終了」を主操作、「そのまま終了」「backup から復元」を補助操作とする。
- backup が一つもない場合は、明示確認後に空 DB で始める選択肢を用意する。
- 利用中の save 失敗は編集内容と dirty 状態を保持し、再試行または編集へ戻れるようにする。保存成功扱いや自動終了を行わない。
- 異常終了後の次回手動起動で DB open と schema 確認が成功した場合は、通常のノート一覧を開いて非 blocking 通知を一度だけ表示する。自動再起動しない。
- 異常終了後に DB open または schema 確認が失敗した場合は、ノート一覧を開かず DB recovery 画面を優先する。

## 7. Desktop Alpha の実装順と task 分割

| 順序 | 段階 | 依存理由 |
| --- | --- | --- |
| 0 | MVP Gate 0 | 完了済み。再判定しない |
| 1 | Electron / Tauri + Node.js sidecar PoC | 同じ MVP、fixture、Mac で shell 固有の成立性と費用を比較する |
| 2 | shell 選定 ADR | 完了。2026-08-17 に Tauri + Node.js sidecar を Desktop Alpha 基盤として承認済み。renderer UI automation の BLOCKED は既知の PoC 測定境界として残す |
| 3 | Desktop shell、user data、lifecycle、Settings 基盤 | user data / SQLite bootstrap、single-instance recovery、primary lifecycle、Settings shell / bridge / entrypoint の部分実装と責務 audit は完了。後続の update、migration、backup / restore、診断が使う process と path の境界を固定する |
| 4 | 更新 apply preparation（backend 実装済み・static PASS） | 既存の provider / manifest / selection / download / signature / validation / state / pending verification の実装を再利用し、verified artifact を明示 invoke から再検証して `ApplyPreparation` と explicit restart handoff へ渡す。自動 apply / restart は行わない。 |
| 5 | staged migration（backend 実装済み・runtime 未検証） | persisted `ApplyPreparation` を起点に、pending migration がある場合だけ safety backup、DB staging copy の migration / read-back / reopen、既存列・Notebook / Canvas / legacy Markdown の保持確認、atomic switch を行う。 |
| 6 | rollback / recovery（backend 実装済み・runtime 未検証） | candidate health、bundle switch、interrupted state、migration / switch / health failure に対し、checkpoint、現行 app / live DB / backup 保持、rollback / SQLite restore / 旧 bundle 復帰 / cleanup を行う。 |
| 7 | 手動 backup / restore | 同じ user data と safety backup を使い、staging validation、保留復元、atomic switch を実装する |
| 8 | 完全なデータ削除、診断、privacy、startup / failure UI | 部分実装の Settings shell、lifecycle、DB pipeline に破壊操作の確認と failure handling を接続する |
| 9 | Packaged Desktop Alpha 結合 QA | 現行 MVP と Desktop 固有契約を同じ Apple Silicon artifact で確認する |
| 10 | Desktop Alpha 後の Phase 2 | 決定済みの Canvas PNG と検索 UX・規模要件を保持し、未決の実装詳細と他機能の採否を個別 task で扱う |
| 11 | Public Mac Release | architecture、macOS、署名、notarization、一般公開配布を確定する |

次の Manager action は、backend 実装済みの update pipeline を Apple Silicon packaged app で検証することである。candidate health、bundle switch、rollback / recovery、SQLite restore、旧 bundle cleanup、interrupted checkpoint の再開を disposable / packaged fixture で確認し、static / Node PASS から packaged runtime PASS へ繰り上げない。その後に手動 backup / restore、完全削除、診断、Alpha 結合 QA を依存順に投入する。

Desktop Alpha の coding task は次の粒度を基本とする。

| 区分 | task file 例 | 1 task の目的 | queue |
| --- | --- | --- | --- |
| 仕様 / 調査 | `record-desktop-shell-selection-adr.task.md` | PoC 証跡から shell 選定と残 risk を記録する | Common |
| API / DB | `implement-desktop-user-data-sqlite-bootstrap.task.md` | user data で初回 DB 作成と schema 判定を行う（実装済み） | API |
| Common / 配布 | `implement-desktop-single-window-lifecycle.task.md` | single application instance / 1 primary window、window state、app-owned process tree の終了処理を実装する（single-instance recovery / primary lifecycle 実装済み、packaged QA 未確認） | Common |
| UI | `implement-desktop-unsaved-exit-dialog.task.md` | 未保存終了の 3 選択肢と save failure 時の dirty 保持を実装する（close coordinator / bridge 実装済み、GUI QA 未確認） | UI |
| UI | `implement-desktop-settings-entrypoints.task.md` | Settings menu / Web gear、3 区分の modal shell を実装する（shell / bridge / entrypoint 実装済み、操作機能は後続） | UI |
| UI | `implement-desktop-unsaved-update-dialog.task.md` | 更新時の未保存内容に対する 3 選択肢と save failure 時の dirty 保持を実装する | UI |
| Common / 配布 | `implement-desktop-update-apply.task.md` | 既存の provider / manifest / selection / download / signature / archive・bundle validation / update-state / pending verification を再実装せず、verified artifact を引数なしの明示 invoke から再検証し、`ApplyPreparation` と explicit restart handoff へ渡す（backend 部分実装済み、static QA 済み） | Common |
| API / DB | `implement-staged-update-migration.task.md` | migration 前 backup、DB staging copy の migration / read-back / reopen、既存列・Notebook / Canvas / legacy Markdown の保持確認、atomic switch を実装する。provider、manifest、download、signature の重複実装は行わない（実装済み、runtime 未検証） | API |
| Common / 配布 | `implement-desktop-update-rollback-recovery.task.md` | package / DB staging、candidate health、切替、interrupted state の失敗時に、現行 app、live DB、app 管理 backup を維持して rollback / recovery、checkpoint persistence、cleanup を実装する（実装済み、runtime 未検証） | Common |
| API / DB | `implement-desktop-manual-sqlite-export.task.md` | ユーザー選択先への平文 SQLite export を実装する | API |
| API / DB | `implement-desktop-restore-pipeline.task.md` | 両 restore 入口の validation と atomic switch を実装する | API |
| Common / 配布 | `implement-desktop-pending-restore-resume.task.md` | newer backup の保留 copy と更新後の明示的な復元再開を実装する | Common |
| UI | `implement-desktop-data-backup-settings.task.md` | Data and Backup の export / restore 操作を実装する | UI |
| UI / API | `implement-desktop-complete-data-deletion.task.md` | 入力確認、対象 data の削除、初回状態への復帰を実装する | Common |
| Common / 配布 | `implement-desktop-private-local-logging.task.md` | retention 付き local log と診断 ZIP を実装する | Common |
| Common / 配布 | `implement-desktop-crash-notification-state.task.md` | 異常終了の記録と次回手動起動時の一度だけの通知を実装する | Common |
| UI | `implement-desktop-db-recovery-ui.task.md` | missing / corrupt DB と save failure の導線を実装する | UI |
| QA | `qa-packaged-desktop-alpha-contract.task.md` | Apple Silicon の packaged app で Alpha 契約を結合確認する | Common |

- 仕様・調査 task と coding task を同じ task file に入れない。
- 1 task は 1 目的、1 task file とする。
- Prisma migration、共有 DTO、Desktop main process / sidecar、同一 UI surface の変更は並列投入しない。
- 先行 task の summary と `Next Read`、変更差分、承認済み contract を確認してから依存 task を投入する。
- 各 coding task は影響に応じて対象 test、lint、TypeScript、build、packaged smoke、`git diff --check` を完了条件に含める。

## 8. Desktop Alpha の完了条件

Desktop Alpha は、Apple Silicon の packaged app で次を確認し、発注者が Alpha として受け入れた時点で完了する。

2026-08-24 時点では、更新確認・取得・検証・state・pending verification、verified artifact の明示 apply、persisted `ApplyPreparation` を起点とする staged migration、read-back、DB / app 切替、rollback / recovery、candidate health、checkpoint persistence、cleanup の backend 境界は実装済みである。以下の完了条件のうち、実際の macOS packaged app による sidecar health、bundle switch、rollback / recovery、cleanup、packaged GUI、runtime QA は未検証である。static / disposable test の PASS を Alpha 受け入れや packaged runtime PASS と扱わない。

- 現行 MVP の route、API、`CanvasDocumentV1`、legacy Markdown、明示保存、物理削除、復習契約が変わっていない。
- clean first launch、existing DB、通常起動、終了、二重起動、window state、次回の一覧開始が lifecycle 契約どおりである。
- 未保存終了の 3 選択肢、Escape / dialog 外操作による取消し、save failure 時の dirty 保持が成立する。
- Settings の 3 区分、Mac / Web の入口、app 管理 backup と外部 file の別 restore 入口があり、`/backup` を代替確認前に削除していない。
- 初期配布 DMG と Apple Silicon 向け `.app archive` の役割が分かれ、`aarch64-apple-darwin` の packaged artifact / QA 境界が成立する。Developer ID / notarization は Alpha の必須条件にしない。
- GitHub Releases を初期 provider とする provider-neutral manifest interface、`releases[]`、channel / version / architecture / macOS compatibility の端末内判定、同一 channel の新しい compatible version のみの選択、downgrade 防止が成立する。
- `productId`、root `schemaVersion: 1`、strict field allowlist、空の `releases[]`、SemVer precedence、stable channel、prerelease 除外、build metadata の比較除外、数値 component による macOS range、artifact metadata、direct HTTPS URL、HTTPS → HTTPS redirect、signature proof、duplicate の manifest 全体拒否、非対象 release の release 単位除外が成立する。
- package の公開鍵署名と SHA-256、`keyId` による現行鍵・次期鍵の選択が成立し、manifest から信頼根を追加しない。
- 更新の非同期・手動確認、最大 1 日 1 回、確認 toggle なし、background download、保留状態、引数なしの `apply_verified_update` による verified artifact の再検証、`ApplyPreparation` の atomic state transition、explicit restart handoff、失敗時の現行版維持が成立する。自動 check、startup check、download 完了、pending notification だけでは apply / restart しない。
- 更新適用時の未保存内容に対する 3 選択肢と取消し操作が、通常終了時とは別の操作契約として成立する。
- Application Support 内の app 管理 staging、atomic な `settings/update-state.json`、persisted `ApplyPreparation`、pending migration の有無、順次 migration、pre-migration backup、pending がない場合の非実行、schema / integrity / foreign key / reopen、既存列と Notebook / Canvas / legacy Markdown の read-back、失敗時の fail-closed checkpoint を実装している。
- `RestartHealthCheck` の `HealthPending` / `BundleSwitching` / `BundleSwitched` / `CleanupPending` / `RollbackPending` を保持し、candidate/current の path・symlink・bundle identity・version・architecture を検証する。candidate health には `Contents/Resources/runtime` を渡し、health 成功前は current app / live DB / backup を保持する。
- 新版の初回起動と health check が成功するまで旧 app bundle を保持し、成功後にだけ旧 bundle、staged artifact、migration safety backup を削除する。実 packaged app の sidecar health / switch / rollback / cleanup は未検証である。
- manual SQLite export、両 restore 入口、restore 前 backup、全 validation、atomic switch、restart / reopen、newer backup の保留復元を disposable fixture で確認している。
- 通常起動と詳細 integrity check の条件が分離され、missing / corrupt / newer schema の recovery 導線が成立する。
- local log の user data 非含有、診断 ZIP の allowlist / denylist、異常終了後の一度だけの通知、offline note 操作を確認している。保持期間・容量などの retention policy は別途決定する。
- app bundle 更新や reinstall で live DB、backup、設定を暗黙に削除しない。
- 完全なデータ削除は入力確認を要求し、live DB、app 管理 backup、設定だけを削除して初回状態へ戻る。外部 SQLite export と通常の uninstall は対象外である。
- 開発用 Next.js Web 起動経路が維持されている。

次は Desktop Alpha の No-Go 条件とする。

- shell 選定に Phase 2 機能、PDF / Playwright / Chromium、Intel、未検証の古い macOS を必須条件としている。
- migration / restore failure で live DB または現行アプリが途中状態へ切り替わる。
- save failure を成功扱いにする、dirty 内容を失う、または自動終了する。
- 更新を自動適用する、未保存内容の確認なしに再起動する、または更新確認の ON / OFF 設定を追加する。
- note 内容、query、user path、DB、token、crash dump が log / 診断 ZIP / telemetry に出る。
- 通常起動時や日次の app 管理 backup、異常終了用 draft / autosave を Alpha 必須として実装している。
- 完全なデータ削除が外部 SQLite export を削除する、または更新、reinstall、通常の uninstall から暗黙に実行される。
- GitHub Releases 以外の provider、具体的な取得 URL、承認済み field allowlist 以外の manifest wire-level details、署名アルゴリズム名・encoding・canonicalization・鍵値、package archive の具体的な拡張子、deployment target、retention policy を承認なしで固定している。
- root、release、artifact、signature の未知 field、product ID 不一致、未知 manifest schema version、必須 field 欠落、invalid SemVer / macOS range / artifact metadata / URL / proof、または同一 target の重複を含む manifest を候補として扱っている。
- 同一 channel でない version、現行 version 以下の version、互換性のない architecture / macOS の version、または manifest から追加された信頼根を更新候補として適用している。
- package / DB staging の検証や新版の health check 前に現行 app bundle を削除している。

## 9. Desktop Alpha 後の Phase 2

Desktop shell と基盤が成立した後、次の順で別 task に分ける。Canvas PNG の採用と検索改善の UX・規模要件は決定済みである。その他の機能は発注者が採用を承認するまで coding task を投入しない。

| 順序 | 後続 task 群 | 現在の判断 | 後続 task で決める範囲 |
| --- | --- | --- | --- |
| 1 | Canvas 本文の PNG 外部出力 | Desktop Alpha 後の最初の外部出力として採用済み | file collision、使用不可文字、保存先、失敗時 UI、色管理 |
| 2 | データ保全の追加判断 | 採否未決 | 定期・日次 backup、履歴、retry、暗号化 backup 等の必要性と運用負荷 |
| 3 | 検索改善と一覧の規模対応 | 検索対象 select、local suggestion、5,000 / 10,000 note、無限スクロール、表示要素数の抑制を採用済み | Summary 分類、tokenization、同点順位、API / index、取得・仮想化方式 |
| 4 | draft / autosave / version・競合 | 採否未決 | 保存の原子性、race、crash recovery、現行の明示保存との境界 |
| 5 | soft delete / Undo / purge | 採否未決 | 復元期限、関連 row、autosave との競合、物理削除からの移行 |
| 6 | 専用復習タスク、タグ管理、Mac keyboard、A11y、モバイル向け編集 | 個別に採否未決 | 各機能の contract と依存関係 |
| 7 | NoteCard / Cue link / hidden / D&D | 採否未決 | `CanvasDocumentV1` との所有関係、検索、migration |

前の候補を採用しない判断でも、依存がなければ次の項目を扱える。各 coding task は既存依存関係と発注者承認を確認してから作成する。Canvas PNG と検索改善については、決定済み部分の採否を再質問せず、残る実装詳細だけを仕様 task で決める。

### 9.1 Canvas PNG の仕様 task

PNG 仕様 task は [`PRODUCT_SPEC.md`](../requirements/PRODUCT_SPEC.md) の決定済み契約を継承し、次を受け入れ条件から外さない。

- 目的は編集用 backup ではなく、Canvas 本文を画像として保存することである。
- Canvas の用紙全体だけを出力し、header、sidebar、toolbar、Cue、Summary、Settings 等の UI を含めない。
- 保存済み `CanvasDocumentV1.page` の幅と高さを出力寸法に使い、現在の `page.background=paper` の背景を含める。
- 用紙外の Canvas 要素を用紙境界で切り取り、画像を用紙外まで広げない。
- legacy `bodyMode=markdown` の本文を対象にしない。
- 初期ファイル名を `[タイトル]_[学習日].png` とし、その文字列を画像内へ描画しない。

仕様 task では、ファイル名に使えない文字、同名 file、保存先、失敗時 UI、色管理を決める。PDF は採用済み機能として扱わず、将来再検討する場合は PNG と分けた仕様、PoC、採用判断を必要とする。

### 9.2 検索・一覧仕様 task

検索・一覧仕様 task は次の決定済み UX と規模要件を継承する。

- 検索対象は単一選択の select とし、既定値をタイトルにする。タイトル、学習元、本文、Cue、全てを選択肢の基礎とする。
- タグは既存の専用フォームを使い、検索対象 select とサジェストから除外する。
- サジェストは検索結果 card ではなく、ローカルの保存済みデータに存在する単語候補とする。外部辞書、外部 API、根拠のない一般語を使わない。
- 「全て」では少なくともタイトルと学習元の候補を含める。入力 1 文字目から取得可能とし、最大 5 件、前方一致優先とする。
- 製品は 5,000 note を最低限の長期利用目安とし、deterministic な 10,000 note fixture で性能を検証する。5,000 件を利用上限にしない。
- 一覧は全件を一度に取得・描画せず、下端へ近づいた時に次のまとまりを読む無限スクロールとする。仮想化または同等の方式で、長時間スクロール後も DOM 要素とメモリを無制限に増やさない。
- 10,000 note でリアルタイム検索が重い場合は debounce を使う。サジェスト最大 5 件だけを性能保証とみなさない。

仕様 task では、Summary 等の現行検索対象の分類と表示文言、前方一致だけで 5 件に満たない場合の部分一致、tokenization、同点順位、検索 API、index、query schema、keyboard 操作、取得単位、cursor / offset、仮想化 library、事前読み込み距離を決める。現行 MVP の API と 1 ページ 50 件の契約は、検索・一覧仕様が承認されるまで変更しない。

### 9.3 採否を別途決める機能

定期 backup、暗号化 backup、autosave、Undo、専用復習タスク、NoteCard / D&D は、この計画だけで採用済みとは扱わない。既存の保存、削除、復習、Canvas 契約への影響を確認し、発注者が各機能を承認した後に仕様 task と coding task を分けて作成する。

## 10. Public Mac Release

Public Mac Release は Desktop Alpha の後に別 Gate として扱う。

- Intel 対応を再検討し、Apple Silicon 専用、architecture 別、universal の配布方式を決める。
- shell / runtime PoC と検証環境を根拠に、対応 macOS と minimum deployment target を決める。
- Developer ID、notarization、Apple Developer Program、署名方式、一般公開用配布サイトを決める。
- install、update、複数版を飛ばす migration、reinstall、uninstall、user data retention の公開向け regression を行う。
- release artifact、source commit、migration、checksum を追跡できる release checklist を作る。

Desktop Alpha では上記を未決のまま残せる。Alpha で使用した低コスト配布先や内部向け DMG を、そのまま Public Mac Release の確定方式とみなさない。

## 11. 並行可能範囲と直列化する範囲

### 11.1 並行可能な作業

| 作業 | 並行条件 |
| --- | --- |
| Electron PoC と Tauri sidecar PoC | 共通 contract、fixture、測定環境を先に固定し、独立 directory / manifest / artifact を使う |
| PoC の runtime 測定と license / cost 調査 | 測定項目と費用の対象範囲を固定し、選定は両結果が揃ってから行う |
| Settings の wire / acceptance と shell 非依存の DB validation 設計 | 状態と error contract を先に固定し、同じ実装 file を編集しない |
| Public Release の Apple 手続き調査と、Alpha 後の Phase 2 仕様調査 | Desktop Alpha の coding file や未決事項を先に固定しない read-only 調査に限る |

### 11.2 直列化が必要な作業

| 競合点 | 直列化する理由 |
| --- | --- |
| Desktop main process / sidecar / packaging config | process、port、resource、path、update hook を共有する |
| Prisma schema と migration history | migration 順序、backup、restore compatibility、rollback が競合する |
| live DB を扱う update、migration、backup、restore | staging と atomic switch の不変条件を同時変更すると failure 原因を分離できない |
| Settings / recovery の同一 UI surface | update、backup、restore、DB failure の状態と focus が競合する |
| Phase 2 の save / delete contract | autosave と Undo が現行 MVP の共有 DTO、transaction、editor state を変更する |
| 正本文書と詳細設計 | 正本の決定後に詳細書を追従させ、同じ決定を並行して別表現へ固定しない |

## 12. 検証と証跡

### Desktop PoC

- 候補ごとに同じ測定手順、環境情報、fixture identifier、artifact 内訳、成功・失敗・未測定を記録する。
- Prisma / SQLite / migration は clean DB と fixture copy で検証し、live DB を使わない。
- build、PoC 固有 test、`git diff --check` を実行する。検証できない項目は理由を残す。
- 比較報告は数値だけで選定せず、lifecycle、保守、安全性、license / Apple / 配布 / CI を含む総コストを併記する。

### Desktop Alpha

- update、migration、restore、DB corruption、permission、容量不足相当、process interruption は disposable path と fixture copy で failure injection する。
- backup / restore では SQLite integrity、foreign key、schema、必須データ、Canvas、reopen を確認する。
- 診断 ZIP は allowlist で構築し、禁止データが含まれないことを test する。
- packaged Desktop smoke と既存 Web regression を分けて記録する。
- 文書確認では Markdown link、見出し構造、`git diff --check` を確認する。
- 2026-08-24 の Desktop update Node suite は `node --test test/desktop/desktop-update-*.test.js` 54/54 PASS。rollback/recovery focused tests は 6/6 PASS で同 suite に含まれる。これは provider / manifest / selection / 公開 URL 境界 / download / signature・SHA-256 / archive・bundle validation / update state / pending verification と、apply、staged migration、read-back、checkpoint、health、switch、rollback、cleanup の disposable / static 境界の証跡であり、実 provider / package runtime や packaged GUI の証跡ではない。
- 同日の lifecycle/runtime tests は 15 PASS、7 SKIP（loopback / packaged runtime 依存）。対象 ESLint、対象 Desktop test / launcher / runtime helper の `node --check`、`cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`、`git diff --check` は PASS。Rust `cargo test --offline` は環境に `base64 0.22.1` crate がなく compile 前に実行不能だった。
- browser / DB read-back、実 provider / package runtime、実際の macOS packaged app による sidecar health / bundle switch / rollback / cleanup、GUI の dirty close、packaged Apple Silicon GUI は未検証として記録し、static / disposable PASS から runtime PASS へ繰り上げない。

## 13. 未決事項

U-001 の shell 選定は 2026-08-17 に解決済みである。次の事項はこの計画更新で決めない。

| ID | 未決事項 | 次の判断時点 |
| --- | --- | --- |
| U-001 | 開発用識別子と開発用 user data の保存先 | Desktop Alpha 実装後 |
| U-002 | GitHub Releases を初期 provider とする provider-neutral manifest interface、manifest / package の具体的な取得 URL・配置・承認済み field allowlist 以外の wire-level details、署名アルゴリズム名・encoding・canonicalization・鍵値、package archive の具体的な拡張子 | 更新実装 contract |
| U-003 | minimum deployment target と Desktop Alpha 後の対応 macOS | shell / runtime PoC 後 |
| U-004 | Intel の artifact 方式、Developer ID、notarization、Apple Developer Program、公開用 code signing 方式、一般公開用配布サイト | Public Mac Release |
| U-005 | Settings の正確な表示文言と項目配置、完全なデータ削除の確認文言 | Desktop Alpha の各 UI 実装 task |
| U-006 | Canvas PNG の使用不可文字、同名 file、保存先、失敗時 UI、色管理。PDF を将来再検討するか | Desktop Alpha 後の PNG 仕様 task |
| U-007 | 検索の Summary 分類、tokenization、同点順位、API / index、取得単位、仮想化実装 | Desktop Alpha 後の検索・一覧仕様 task |
| U-008 | 定期 backup、暗号化 backup、autosave、Undo、専用復習タスク、NoteCard / D&D の最終採否と詳細 | Desktop Alpha 後の個別 contract |
| U-009 | app 管理 backup と local log の retention policy の保持期間、容量、世代数、整理手順 | Desktop Alpha の privacy / data management task |

## 14. 次の Manager action

2026-08-24 の検証 summary により、現時点で追加の責務分割 coding task は投入しない。更新確認・取得・検証・staged migration・rollback / recovery の重複実装を次 task にせず、実装済み backend pipeline の packaged/runtime QA と残る Desktop Alpha 機能を依存順に進める。

1. `summary/20260824/1026-fix-desktop-update-recovery-candidate-runtime-root-20260824-6fd3c80a-summary.md` と `HANDOFF_2026-08-22.md` を起点に、dynamic loopback / sidecar、candidate health、bundle switch、rollback / recovery、cleanup、dirty close / save failure の実挙動を追検証する。packaged GUI が必要な項目は未検証のまま記録する。
2. 手動 SQLite export、app 管理 backup / 外部 file restore、pending restore、完全なデータ削除を実装する。
3. startup failure、local log、diagnostic bundle、privacy 境界を実装する。
4. Apple Silicon の packaged app で、現行 MVP と Desktop Alpha の残る lifecycle / Settings / update / data contract を結合 QA し、Alpha の受け入れ判定を行う。
5. Electron の追加対称比較、署名・notarization、Phase 2 は Desktop Alpha の残課題と混ぜない。

PDF / Playwright / Chromium、Intel、古い macOS の保証、Canvas PNG、autosave、Undo は、PoC task の blocker や受け入れ条件へ追加しない。
