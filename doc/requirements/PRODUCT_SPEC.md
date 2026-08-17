# Cornell Method Notebook 製品仕様書

確認日: 2026-08-12

## 文書の位置づけと正本ルール

この文書は、Cornell Method Notebook の製品概要、製品原則、現行 MVP、Desktop Alpha、Phase 2、Public Mac Release の境界を定めます。個別 API の request / response、Prisma の field、画面 selector、migration SQL、個別のテスト手順は、各詳細設計書で定義します。

文書の役割は次のとおりです。

| 文書 | 正本とする内容 |
| --- | --- |
| `AGENTS.md` | エージェントの作業指示、開発制約、Manager / Worker 運用、正本一覧、短い製品境界 |
| `doc/requirements/PRODUCT_SPEC.md` | 製品全体の方針、対象ユーザー、成功条件、MVP / Desktop Alpha / Phase 2 / Public Mac Release の境界、配布・保存方針 |
| `doc/requirements/MVP_SYSTEM_SPEC.md` | 現行 MVP の業務要件・機能要件 |
| `doc/implementation/MVP_CONTRACT.md` | 現行 MVP の canonical route、API、保存・削除・復習方式、実装・受け入れ契約 |
| `doc/implementation/POST_MVP_IMPLEMENTATION_PLAN.md` | Gate 0 後の Desktop PoC、Desktop Alpha、後続機能、Public Mac Release の依存順と受け入れ境界 |
| `doc/technical/`、`doc/data/`、`doc/api/`、`doc/screens/`、`doc/workflows/`、`doc/testing/` | 各領域の詳細設計、検証観点、実装状態 |

製品全体の方針とロードマップについては本書を参照します。現行 MVP の実装と受け入れの判断では `MVP_CONTRACT.md` を優先し、業務要件は `MVP_SYSTEM_SPEC.md` を起点にします。製品ロードマップと現行 MVP の契約が異なる場合も、現行 MVP の契約は変更しません。変更が必要なら、別の仕様更新として扱います。

## 製品概要、対象ユーザー、利用目的、成功条件

Cornell Method Notebook は、学習者が Cornell Method の形式で学習記録を作成し、後から検索、閲覧、復習できるローカル個人利用向けのノートアプリです。

- 対象ユーザーは、自分の学習記録を自分の端末で管理する個人です。認証、ユーザー管理、共有を前提にしません。
- 利用目的は、学習内容を Cue で問いに整理し、中央の本文領域へ自由に記録し、Summary で要点を振り返れるようにすることです。
- 初期テンプレートは Cornell のみとし、将来テンプレートを追加できる構造にします。
- 現行 MVP の成功条件は、ノートの作成、編集、閲覧、Cue / Summary の記録、Canvas 本文の保存と再表示、タグ・日付による検索、復習、手動バックアップまでの学習サイクルが一貫して利用できることです。
- Desktop Alpha の成功条件は、現行 MVP の route、API、明示保存、物理削除、復習契約を維持した Mac アプリとして、承認済みの lifecycle、更新、migration、backup / restore、診断、障害時挙動が成立することです。

## 製品原則

### Local-first と個人利用

- ノートデータの唯一の正本（canonical source of truth）は SQLite です。現行 MVP、Desktop Alpha、Phase 2、Public Mac Release のいずれでも、この境界を変更しません。
- ノートの作成、編集、閲覧、検索、復習、保存、backup / restore は完全 offline で動作させます。
- Desktop アプリがネットワークを使うのは、更新 manifest の確認と更新 package の取得だけです。端末固有 ID、利用状況、ノート内容を送信しません。
- クラウド DB、クラウド同期、外部推論 API、常時ネットワーク接続は製品スコープ外です。
- 認証、マルチユーザー、共有、コメント、共同編集は製品の基本スコープに含めません。

### 配布経路と開発形態

- 主な配布経路は、ユーザーがダウンロードして起動する Mac デスクトップアプリです。
- 開発、検証用の Next.js Web 起動形態は維持します。
- Desktop Alpha は最初の Desktop MVP です。対象 architecture は Apple Silicon とし、Intel 対応は Public Mac Release の検討時に再評価します。
- Desktop Alpha で検証済みと表明できる macOS は、PoC と Alpha を実行した開発 Mac の現行環境だけです。古い macOS の最低対応版を推測で保証せず、minimum deployment target は shell / runtime PoC 後に決めます。
- Desktop shell は Tauri + Node.js sidecar に決定しました。retry24 の native lifecycle / runtime HTTP / package 証跡を根拠に、2026-08-17 に発注者が Desktop Alpha の基盤として承認しています。renderer UI automation の BLOCKED は既知の PoC 測定境界として残し、Desktop Alpha の実装で製品 UI の受け入れを別途確認します。
- PoC では cold start、操作反応、shell の main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper、関連子 process の合計メモリ、成果物サイズ、SQLite / Prisma / migration / lifecycle、DMG とアプリ内更新の成立見通し、安全性、保守難度、総コストを同じ条件で比較します。framework が必要とする内部 process を許容し、OS process が複数存在することだけを不合格理由にしません。総コストには framework / dependency license、Apple 関連費用、配布 storage / bandwidth、CI、保守工数を含めます。再現可能な性能差が明確なら軽い候補を、差が小さい場合は保守しやすさと安全性を優先します。

### 学習体験と保存

- Cornell の Cue と Summary（要約・次の行動）は Markdown を基本とし、本文は自由配置 Canvas を中心に扱います。
- Canvas の保存形式は共有 `CanvasDocumentV1` 契約を使い、描画ライブラリの内部形式を製品仕様そのものにしません。
- 既存の Markdown 本文データは互換表示のために保持し、Canvas 化を理由に既存データを自動変換しません。
- 現行 MVP と Desktop Alpha は明示保存を維持します。draft / autosave、version、競合処理は後続 Phase 2 で採用を判断します。
- SQLite backup は正本データを保全・復元する単位です。ノート内容をアプリ外へ持ち出す外部出力とは分けます。
- Desktop Alpha 後の最初の外部出力は Canvas 本文の PNG とします。PNG は編集用 backup ではなく、保存済み Canvas の用紙を画像として保存する機能です。PDF と packaged Playwright / Chromium は Desktop shell 選定および Desktop Alpha の必須条件にしません。

## 現行 MVP / Desktop Alpha / Phase 2 / Public Mac Release の境界

### 現行 MVP

現行 MVP は、ローカル個人利用で学習記録の基本サイクルを成立させる範囲です。

- route は `/notes`、`/notes/new`、`/notes/[id]`、`/backup` を中心とします。
- ノートの新規作成、一覧、詳細閲覧、編集、確認付き削除を提供します。
- Cornell の Cue リスト、`CanvasDocumentV1` のフリー入力本文、Markdown の Summary、タイトル、学習日、学習元、タグ、次回復習日を記録します。
- Canvas 本文の保存・復元と、Canvas 内テキストを含む検索を提供します。
- タイトル、本文、Summary、Cue、日付、タグを使った一覧検索と、手動で管理する復習対象の確認を提供します。
- 詳細画面内に閲覧、編集、復習モードを持ちます。
- ユーザーが実行する明示保存、SQLite DB の手動バックアップ、最新 3 世代の確認を提供します。
- 削除確認後に物理削除します。削除後の復元は保証しません。

現行 MVP の canonical route、API、データモデル、保存、削除、復習、バックアップの受け入れ条件は `doc/implementation/MVP_CONTRACT.md` を正本とします。自動保存、起動時自動バックアップ、Undo、soft delete、専用復習タスク画面、外部出力は現行 MVP に含めません。

MVP Gate 0 は、発注者が完了と判断した人力結合テストを受け入れ境界として完了済みです。Browser runtime、mobile、wheel / trackpad、実 DB read-back、E2E、外部 Postgres、追加の build 証跡を blocker に戻しません。Desktop Alpha は現行 MVP の契約を遡及変更せずに包む配布段階です。

### Desktop MVP / Desktop Alpha

Desktop Alpha は、現行 MVP を Apple Silicon Mac の single application instance / 1 primary window アプリとして成立させる段階です。Phase 2 の新しい学習機能を shell 選定や Alpha の成立条件へ混ぜません。

#### Lifecycle と終了

- 二重起動時は新しい application instance / primary window を増やさず、既存 primary window を前面へ出します。
- Settings modal、確認 dialog、OS file dialog は primary window に数えず、新しい独立 primary window を作りません。
- shell の main / core、renderer / WebView、local runtime、Node.js sidecar、framework helper 等の内部 process を許容します。
- 最後の primary window を閉じると application instance を終了し、local runtime と app-owned child process をすべて停止して orphan process を残しません。
- 起動時は前回の route を復元せず、常にノート一覧から始めます。
- window の size と position を保持します。保存位置が現在の画面領域外にある場合は、見える位置へ補正します。
- 未保存内容がある状態で終了する場合は、「保存して終了」「保存せず終了」「戻る」を提示します。「保存せず終了」は未保存内容を破棄します。「戻る」、Escape、dialog 外操作は終了を取り消します。「保存して終了」の保存に失敗した場合は終了せず、編集内容と dirty 状態を保持します。
- 明示保存を維持します。異常終了用 draft / autosave は Desktop Alpha に含めません。

#### Settings

- Settings の基本区分は General、Updates、Data and Backup とします。
- Mac アプリでは Settings menu、開発用 Web では gear から開ける方針を維持します。
- 正確な文言、項目配置、画面遷移は実装 task で決めます。
- `/backup` は Settings の Data and Backup が現行機能を代替するまで維持します。代替の受け入れ確認後、Desktop UI では段階的に廃止します。この移行前に現行 MVP の route を削除しません。
- app 管理 backup からの復元と外部 backup file からの復元は別の入口として表示します。正確なボタン文言は実装 task で決めます。

#### 更新

- 初期インストールは DMG を使います。
- 起動完了後に更新を非同期確認します。自動確認は最大 1 日 1 回とし、ユーザーによる手動確認も提供します。
- 更新確認の ON / OFF 設定は設けません。
- VS Code に近いアプリ内更新を採用し、更新 package はバックグラウンドで取得できるようにします。取得後も自動適用せず、ユーザーが「再起動して更新」を選んだ場合だけ、明示的な再起動を経て適用します。
- 更新確認や取得に失敗しても現行版を利用可能にします。失敗を「更新あり」として通知せず、手動確認または次回の確認で再試行できるようにします。
- package の署名・完全性検証に失敗した場合は取得物を破棄し、現行版を維持します。検証方式は PoC と更新設計で決めます。
- 同じ保留更新を modal で繰り返し通知しません。保留状態は Settings 等から確認できるようにします。
- 複数版を飛ばす更新では利用可能な最新 compatible version を選び、DB migration は古い順に実行します。
- 共通の静的 manifest を取得し、version、architecture、OS compatibility を端末内で判断します。manifest と package の取得時に、端末固有 ID、利用状況、ノート内容、検索内容を送りません。
- Desktop Alpha では独自ドメインを取得しません。GitHub Releases 等の低コストな配布先を候補とし、採用 shell と更新機構との互換性を PoC で確認します。更新 provider はこの段階では確定しません。
- App Store 配布を前提にしません。
- Developer ID、notarization、Apple Developer Program、一般公開用配布サイトは Public Mac Release で判断し、Desktop Alpha の blocker にしません。

#### 更新適用時の未保存内容

- 更新を適用する時点で未保存内容がある場合は、「保存して更新」「保存せず更新」「戻る」を提示します。この契約は通常終了時の 3 選択肢とは別の操作契約です。
- 「保存して更新」は、保存成功後に再起動して更新します。保存に失敗した場合は更新せず、編集内容と dirty 状態を保持します。
- 「保存せず更新」は、未保存内容を破棄して再起動し、更新します。
- 「戻る」、Escape、dialog 外操作は更新を中止し、編集へ戻ります。

#### DB、migration、backup、restore

- app bundle と macOS Application Support 配下の user data directory を分離します。ユーザーの Mac 内にある live SQLite をノートデータの唯一の正本とし、app 管理 backup、設定、local log も user data directory 側に置きます。更新や reinstall で live DB、app 管理 backup、設定を暗黙に削除しません。
- 更新に pending migration がある場合だけ、更新適用前に app 管理 safety backup を作成します。staging copy 上で migration を古い順に完了し、migration と reopen の検証に成功した場合だけ新しい app と DB へ切り替えます。DB schema が現行アプリと compatible で pending migration がない場合は migration を実行しません。
- migration に失敗した場合は live DB と現行アプリを変更せず、更新失敗として現行版を利用可能にします。
- app 管理 safety backup は migration 前と restore 前だけに作成し、migration 前の safety backup を含めて最新 3 世代を保持します。定期、日次、通常起動時、データ変更時の自動 backup は Desktop Alpha に含めません。
- 手動 backup は、ユーザーが保存先を選択する平文 SQLite export とします。app 管理 backup の 3 世代 retention は外部 export file に適用しません。
- restore は app 管理 backup の一覧と外部ファイル選択を別入口にし、どちらも staging validation、明示確認、atomic switch、restart の同じ pipeline へ流します。
- restore の開始前に現在の live DB を app 管理 safety backup として保存します。
- restore file は、SQLite integrity、foreign key、schema / migration compatibility、必須データ、存在する全 `CanvasDocumentV1`、切り替え後の reopen を検証します。legacy Markdown note は互換対象として保持します。
- validation または reopen に失敗した場合は restore を中止し、現在の live DB を変更しません。
- 古い形式の backup は staging copy に migration を古い順に適用してから restore します。現在のアプリより新しい形式はその場で restore せず、先に compatible なアプリへの更新を求めます。
- 外部 file を選択済みの状態でアプリ更新が必要になった場合は、選択した file の staging copy を Application Support 内の保留復元領域へ保存し、更新と再起動後に復元再開を案内します。更新後も自動 restore は行わず、ユーザーの明示確認後に再開します。

#### 完全なデータ削除

- アプリのアンインストールと user data 削除は別操作です。更新、reinstall、通常の uninstall を完全なデータ削除として扱いません。
- Settings の完全なデータ削除は、live DB、app 管理 backup、設定を対象とします。ユーザーが任意の場所へ保存した外部 SQLite export は削除しません。
- 完全なデータ削除は入力確認を伴う明示操作とし、完了後は初回利用時と同じ状態へ戻します。正確な確認文言は実装 task で決めます。

#### 起動、保存、障害時挙動

- 通常起動では DB open と schema 状態を確認します。全件 integrity check は毎回実行しません。
- 詳細 integrity check は、異常終了後、migration 後、restore 後など必要な場合に限定します。
- 初回利用で DB が存在しない場合は新規作成します。
- 過去の利用記録があるのに live DB がない場合は空 DB を自動作成せず、restore を主操作とする復旧画面へ案内します。
- DB が破損している、または読み取れない場合は自動修復しません。「診断情報を書き出して終了」を主操作とし、「そのまま終了」「backup から復元」を補助操作として提示します。
- 利用可能な backup がない場合は、明示確認後に空 DB で始める選択肢を提示します。
- 利用中の save 失敗では編集内容と dirty 状態を保持し、再試行または編集へ戻れるようにします。保存成功として扱わず、自動終了もしません。
- 異常終了後の次回手動起動で DB open と schema 確認が成功した場合は、通常のノート一覧を開き、非 blocking 通知を一度だけ表示します。アプリを自動再起動しません。
- 異常終了後に DB open または schema 確認が失敗した場合は、ノート一覧を開かず DB recovery 画面を優先します。

#### 診断、privacy、権限、暗号化

- 外部 telemetry と crash report の自動送信は行いません。
- Application Support に本文等を含まない local log を保持します。保持上限は 14 日かつ合計 20 MB とし、上限を超える場合は古い log から削除します。
- ユーザーが明示作成する診断 ZIP には、error log、時刻、component、sanitized stack、app version、macOS version、CPU architecture、DB schema version を含めます。
- 診断 ZIP に title、body、Cue、Canvas、query、DB 本体、token、user path、crash dump を含めません。
- Full Disk Access を要求しません。Application Support と、backup / restore / export でユーザーが明示選択した file だけを扱います。
- app 独自 DB encryption と app 専用 password / Touch ID lock は Desktop Alpha に含めません。macOS file permission を利用し、端末では FileVault の使用を推奨します。
- 手動 export backup は平文 SQLite であることを保存時に案内します。暗号化 backup の採否は後続段階で判断します。

### Desktop Alpha 後の Phase 2

Desktop shell と基盤が成立した後、Canvas PNG、データ保全の追加判断、検索改善、draft / autosave、soft delete / Undo 等を別 task で扱います。Canvas PNG の外部出力契約と検索改善の UX・規模要件は決定済みです。API、index、保存先等の実装詳細は後続 task で決めます。定期 backup、暗号化 backup、autosave、Undo、専用復習タスク、NoteCard / D&D は、この決定だけで採用済みとは扱いません。

#### Canvas PNG

- Desktop Alpha 後の最初の外部出力として実装します。目的は編集用 backup の作成ではなく、Canvas 本文を画像として保存することです。
- 出力対象は Canvas の用紙全体です。アプリの header、sidebar、toolbar、Cue、Summary、Settings 等の UI は含めません。
- 保存済み `CanvasDocumentV1.page` の幅と高さを出力寸法に使い、現在の `page.background=paper` の背景を含めます。
- 用紙外にある Canvas 要素は用紙境界で切り取り、画像を用紙外まで広げません。
- legacy `bodyMode=markdown` の本文は PNG 出力の対象にしません。
- 初期ファイル名は `[タイトル]_[学習日].png` とします。ファイル名の文字列を画像内へ描画しません。
- ファイル名に使えない文字、同名 file、保存先、失敗時 UI、色管理は PNG 仕様 task で決めます。上記の決定済み項目は再検討の対象へ戻しません。
- PDF は採用済み機能として扱いません。将来再検討する場合は、PNG と分けた仕様、PoC、採用判断を必要とします。

#### 検索改善と一覧の規模対応

- 現行 MVP のフリーワード検索は対象範囲が広いため、検索対象を単一選択の select で指定できるようにします。複数選択式にはしません。
- 既定の検索対象はタイトルです。タイトル、学習元、本文、Cue、全てを選べる契約を基礎とします。Summary 等、現行検索対象の細かな分類と表示文言は、検索仕様 task で既存互換を確認して決めます。
- タグは既存の専用フォームを使うため、検索対象 select とサジェストから除外します。
- サジェストは検索結果 card の一覧ではなく、入力中の単語候補です。「全て」を選んだ場合は、少なくともタイトルと学習元の候補を含めます。
- 候補の根拠はローカルの保存済みデータに存在する語に限り、外部辞書や外部 API、根拠のない一般語を使いません。
- サジェストは入力 1 文字目から取得可能とし、最大 5 件に制限します。前方一致を優先し、前方一致だけで 5 件に満たない場合の部分一致、tokenization、同点順位は検索仕様 task で決めます。
- 10,000 note 規模で検索結果のリアルタイム更新が重い場合は debounce を使います。サジェストの最大 5 件を検索全体の性能保証とはみなしません。検索 API、index、query schema、表示文言、keyboard 操作は検索仕様 task で決めます。
- 製品は 5,000 note を最低限の長期利用目安とし、それを超えて使い続けられる設計にします。性能検証には deterministic な 10,000 note fixture を使い、この fixture を 5,000 件で利用を打ち切る上限とは解釈しません。
- 一覧は全件を一度に取得・描画しません。下端へ近づいたときに次のまとまりを読み込む無限スクロールを採用し、仮想化または同等の方式で DOM 要素とメモリの増加を表示中付近に抑えます。
- 取得単位、cursor / offset、仮想化 library、事前読み込み距離は、10,000 note fixture の実測後に決めます。現行 MVP の API とページング契約は、後続の検索・一覧仕様 task が更新されるまで変更しません。

#### 採否を別途決める機能

1. データ保全の追加機能。定期・日次 backup、履歴、retry、暗号化 backup 等は、必要性と運用負荷を確認して採否を決めます。
2. draft / autosave、version、競合処理。現行の明示保存を変更するため、保存契約と障害時挙動を別途承認します。
3. soft delete、短時間 Undo、purge。現行の確認付き物理削除を変更するため、復元期限と整合性を別途承認します。
4. 専用復習タスク、タグ管理、Mac keyboard 操作、A11y、モバイル向け編集の拡張。
5. NoteCard、Cue と本文の ID link、hidden flag、D&D。`CanvasDocumentV1` との所有関係を決めるまで採用しません。

各 coding task は既存依存関係と発注者承認を確認してから作成します。Canvas PNG と検索改善では、上記の決定済み契約を採否未決へ戻さず、残る実装詳細だけを仕様 task で決めます。

### Public Mac Release

Public Mac Release では、一般公開に必要な配布範囲と信頼性を確定します。

- Intel 対応を再検討し、Apple Silicon 専用、architecture 別 artifact、universal binary のいずれにするか決めます。
- 検証対象 macOS と minimum deployment target を、shell / runtime PoC と利用可能な検証環境を根拠に確定します。
- Developer ID、notarization、Apple Developer Program、署名方式、一般公開用配布サイトを決めます。
- install、update、reinstall、uninstall と user data retention の公開向け契約、release checklist、support 手順を確定します。

### 将来構想

- Local LLM を使った復習クイズや Cue / キーワード候補を検討します。ユーザーの想起・判断を補助する機能として扱い、Cue の自動入力や外部 API 依存を前提にしません。
- 復習クイズはユーザーの明示操作で生成する候補とし、初期案では生成結果の自動保存や自動採点を前提にしません。答え合わせ、根拠、解説を重視します。
- Cue 候補は、ユーザーが先に Cue を書いた後に不足候補を提示する補助とします。自動採用せず、追加、編集して追加、無視を選べることを前提にします。
- 過去に検討したクラウド基盤、オンライン公開、端末間同期の案は採用しません。製品ロードマップや実装予定として保持しません。

## 高レベル機能マップ

| 領域 | 製品上の役割 | 現在の位置づけ |
| --- | --- | --- |
| ノート作成・編集・閲覧 | 学習記録を作成し、保存済みノートを読み返す中心機能 | 現行 MVP。Desktop Alpha でも契約を維持 |
| Cue / Summary | Cue で問いを整理し、Summary で要点と次の行動を振り返る | 現行 MVP |
| Canvas 本文 | 文字、図形、線、ストロークを自由配置する | 現行 MVP。`CanvasDocumentV1` を正本として維持 |
| タグ・検索 | タグ、日付、タイトル、本文、Cue、Summary 等からノートを見つける | 基本機能は現行 MVP。検索対象 select、local suggestion、規模対応は Desktop Alpha 後の決定済み要件 |
| 復習 | 手動の次回復習日と詳細画面内の想起モードで復習する | 現行 MVP。自動タスクは Desktop Alpha 後の採否未決候補 |
| Desktop shell / lifecycle | 現行 MVP を single application instance / 1 primary window の Mac アプリとして動かす | Desktop Alpha |
| 更新 | 静的 manifest を使い、ユーザーの選択で更新を適用する | Desktop Alpha |
| backup / restore | SQLite の手動 export、migration / restore 前 safety backup、安全な restore | Desktop Alpha。定期 backup 等は後続候補 |
| 診断 | privacy を保った local log と手動診断 ZIP を提供する | Desktop Alpha |
| 外部出力 | Canvas 本文をアプリ外へ持ち出す | Desktop Alpha 後の最初の外部出力として Canvas PNG を採用。PDF は未採用 |
| テンプレート | Cornell を初期テンプレートとし、追加テンプレートを将来受け入れる | Cornell は現行 MVP、拡張は将来 |

## 配布・保存方針

Desktop 配布では、実行環境と書き込み可能なユーザーデータを分離します。全設計書で次の用語を使います。

| 境界 | 保存するもの | 方針 |
| --- | --- | --- |
| `app bundle` | 実行コード、Next.js 資産、Prisma Client / migration、必要な runtime / driver、配布資産 | `.app` 内は配布物として扱い、live SQLite DB やユーザー編集データを書き込まない |
| `user data directory` | SQLite の live DB、app 管理 safety backup、設定、local log | `~/Library/Application Support/com.cornellmethod.notebook/` 配下を使い、app bundle や同期フォルダから分離する。`live`、`backups`、`settings`、`logs`、`pending-restore` に分ける |
| ユーザー選択 file | 手動 SQLite export、外部 restore file、Desktop Alpha 後の Canvas PNG | OS の file dialog 等でユーザーが明示選択した file だけへアクセスする |
| 更新配布先 | 静的 manifest と更新 package | Desktop Alpha では独自ドメインを前提にせず、候補 provider との互換性を PoC で確認する |

SQLite の live DB は user data directory 内の唯一の正本です。app bundle の更新と user data migration を分け、更新や reinstall で user data を暗黙に削除しません。アンインストールと user data 削除は別操作として扱います。

## 非目標・制約

- 認証、ユーザー管理、マルチユーザー、共有、コメント、共同編集は対象外です。
- 画像やファイルの添付は対象外とし、基本はテキストと Canvas 要素を扱います。
- クラウド DB、クラウド同期、外部推論 API、ノート操作時のネットワーク接続は対象外です。
- Phase 2 の Canvas PNG、検索改善、autosave、Undo / soft delete、専用復習タスク、NoteCard / D&D を Desktop shell 選定へ持ち込みません。
- PDF と packaged Playwright / Chromium を Desktop PoC、Desktop Alpha、Public Mac Release の既定要件にしません。
- Desktop Alpha で定期・日次・通常起動時 backup、異常終了用 draft、app 独自 DB encryption、app 専用 password / Touch ID lock を実装しません。
- Desktop Alpha で Intel、推測した古い macOS 対応、Developer ID、notarization、Apple Developer Program、一般公開用配布サイトを blocker にしません。
- `.app` 内や同期フォルダへ live SQLite やユーザー編集データを書き込みません。
- 製品全体の方針書で API payload、DB field、CSS selector、migration SQL、個別テスト手順を再定義しません。

## 製品レベルの未決事項・ロードマップ

以下は現時点で決定していない事項です。発注者の判断なしに実装方針を固定しません。

| ID | 未決事項 | 判断のタイミング |
| --- | --- | --- |
| U-001 | 開発用識別子と開発用 `user data directory` の具体的な path | Desktop Alpha 実装後 |
| U-002 | 更新 provider、manifest / package の具体的な配置先、取得方式、package の署名・完全性検証方式 | Desktop PoC と更新設計 |
| U-003 | minimum deployment target と Desktop Alpha 後の対応 macOS 範囲 | shell / runtime PoC 後 |
| U-004 | Intel 対応と artifact 方式、Developer ID、notarization、Apple Developer Program、一般公開用配布サイト、公開用 code signing 方式 | Public Mac Release |
| U-005 | Settings の正確な表示文言と項目配置、完全なデータ削除の確認文言 | Desktop Alpha の各 UI 実装 task |
| U-006 | Canvas PNG の使用不可文字、同名 file、保存先、失敗時 UI、色管理。PDF を将来再検討するか | Desktop Alpha 後の PNG 仕様 task |
| U-007 | 検索の Summary 分類、tokenization、同点順位、API / index、取得単位、仮想化実装 | Desktop Alpha 後の検索・一覧仕様 task |
| U-008 | 定期 backup、暗号化 backup、autosave、Undo、専用復習タスク、NoteCard / D&D の最終採否と詳細 | Desktop Alpha 後の個別仕様 |

将来の学習支援機能は、Local LLM による復習クイズを復習時の想起支援、Cue 候補提案をノート整理時の補助として分けて検討します。どちらもユーザーの判断を必須とし、現行 MVP と Desktop Alpha の実装 task には含めません。

## 詳細設計書へのリンク

### 現行 MVP の要件・契約

- [MVP システム仕様](MVP_SYSTEM_SPEC.md)
- [現行 MVP 契約](../implementation/MVP_CONTRACT.md)
- [実装状況](../implementation/IMPLEMENTATION_STATUS.md)
- [MVP テストシナリオ](../testing/TEST_SCENARIOS.md)

### Desktop Alpha と後続計画

- [Post-MVP 依存関係付き実装計画](../implementation/POST_MVP_IMPLEMENTATION_PLAN.md)
- [ターゲットアーキテクチャ](../technical/TARGET_ARCHITECTURE.md)

### 領域別の詳細設計

- [データ設計](../data/MVP_DATA_DESIGN.md)
- [API 設計](../api/MVP_API_DESIGN.md)
- [画面設計](../screens/MVP_SCREEN_DESIGN.md)
- [NTE-020 新規ノートレイアウト方針](../screens/NTE_020_NEW_NOTE_LAYOUT_POLICY.md)
- [業務フロー](../workflows/MVP_WORKFLOW_DESIGN.md)
- [MVP 技術設計](../technical/MVP_TECHNICAL_DESIGN.md)
- [設計ツール運用ガイド](../technical/MVP_DESIGN_TOOLING_GUIDE.md)

### 履歴・レビュー資料

- [MVP / Phase 2 分類案](MVP_CLASSIFICATION_DRAFT.md)
- [設計レビュー計画](../review/DESIGN_REVIEW_PLAN.md)
- [As-Is 設計棚卸し](../review/AS_IS_DESIGN_INVENTORY.md)

これらのレビュー・分類資料は、作成時点の判断や棚卸し結果を保持する履歴資料です。現在の製品全体方針の正本は本書、現行 MVP の実装と受け入れの判断の正本は `MVP_CONTRACT.md` です。
