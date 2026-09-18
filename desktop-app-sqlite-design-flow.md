# デスクトップアプリにおけるローカルDB（SQLite）設計・設定フロー

## 1. 基本方針

デスクトップアプリでSQLiteなどのローカルDBを採用する場合、基本的には**ユーザーにDBそのものを設定させない**設計が適しています。

ユーザーに見せるのは、次のような「データ管理」に関する項目です。

- データ保存場所
- バックアップ
- 復元
- インポート / エクスポート
- データのリセット

一方、次のようなDB固有の実装詳細はアプリ側で管理します。

- SQLiteファイル名
- SQLiteのlive保存先
- DB接続先
- `DATABASE_URL`
- `journal_mode`
- Schema
- Migration
- Integrity Check

理想は、**アプリがSQLiteを使用していることをユーザーが意識しなくても使える状態**です。

---

## 2. 推奨する初回起動フロー

初回起動時は、ユーザーにDB設定を求めず、初期化マーカー等で未初期化と判定できる場合に限り、アプリ側で自動的に初期化します。保存領域、SQLiteのlive保存先、ファイル名、接続先（`DATABASE_URL`を含む）はアプリが内部管理し、ユーザー設定項目にはしません。既存インストールでは、SQLiteが存在しないことだけを理由に空のDBを作成しません。

```text
アプリ初回起動
      ↓
既存データ確認
      ↓
データなし
      ↓
保存領域作成
      ↓
SQLite DB作成
      ↓
Schema Migration
      ↓
初期データ投入
      ↓
Integrity Check
      ↓
アプリ起動
```

ユーザー向けの初回画面は、例えば次の程度で十分です。

```text
Welcome

[新しく始める]

[バックアップから復元]

[既存データをインポート]
```

「新しく始める」を選択した場合、内部では次の処理を自動実行します。

```text
Application Data Directory作成
        ↓
app.db作成
        ↓
SQLite初期設定
        ↓
Migration
        ↓
Integrity Check
        ↓
Ready
```

既存インストールで初期化マーカーが確認できるにもかかわらず、SQLiteが欠落・破損・読み取り不能、またはSchema不整合になった場合は、空のDBを自動作成して既存データを置き換えません。Recovery-only UIで状態を診断し、ユーザーの確認後にバックアップから復元する経路へ進みます。

---

## 3. DBの保存場所

### 一般的なデスクトップアプリ

通常は、OS標準のApplication Data領域に保存します。

macOS:

```text
~/Library/Application Support/<AppName>/
```

Windows:

```text
%APPDATA%\<AppName>\
```

Linuxでは、XDG Base Directory Specificationに従った保存先を利用する方法が一般的です。

内部構造の例:

```text
AppData/
├── app.db
├── attachments/
├── backups/
├── cache/
└── logs/
```

一般ユーザー向けアプリでは、初回起動時に保存先を選ばせる必要はありません。

### プロジェクト型アプリ

プロジェクト単位でデータを管理するアプリでは、次のような方式もあります。

```text
Project A
├── source/
└── .myapp/
    └── project.db
```

ただし、プロジェクトフォルダ内へDBを配置すると、Gitへの誤コミットなどが発生する可能性があります。

そのため、多くの場合はアプリのApplication Data領域にGlobal DBを置き、Project IDによって管理する構成が扱いやすくなります。

```text
Application Data
└── app.db
    ├── Project A
    ├── Project B
    └── Project C
```

---

## 4. 保存場所を変更できるようにする場合

保存場所変更は初回設定ではなく、Advanced設定として提供するのが適しています。

```text
Settings
└── Data
    ├── Data location
    │   ~/Library/Application Support/MyApp
    │
    ├── [Change location]
    ├── [Open data folder]
    ├── [Backup]
    └── [Restore]
```

保存場所を変更する場合は、単純にDBを移動するだけではなく、次のような安全な処理フローにします。

```text
新しい保存先選択
      ↓
書き込み可能確認
      ↓
現在DBのSnapshot
      ↓
DBコピー
      ↓
SQLite integrity_check
      ↓
新DBから読み込み確認
      ↓
保存先切替
      ↓
旧DBを一定期間保持
```

切り替え直後に旧DBを削除せず、復旧できる猶予を持たせる方が安全です。

---

## 5. DBファイル自体をユーザーに選択させない

次のようなUIは、開発者向けツールを除き、一般ユーザーには避けた方がよい設計です。

```text
SQLite Database Location:

[Browse...]

Database filename:
[database.sqlite]

[Create]
```

SQLiteはユーザーから見れば実装詳細です。

代わりに、次のような表現まで抽象化します。

```text
データの保存場所

○ このMacに保存（推奨）

○ 保存場所を指定する
```

---

## 6. Schema Migration

Schema Migrationは完全に自動化します。

例えば、アプリv1でSchema Version 1を使用し、v2でSchema Version 2へ変更する場合は、起動時に次の処理を行います。

```text
App Start
   ↓
DB Open
   ↓
Schema Version確認
   ↓
Current?
 ├─ Yes → Start
 └─ No
      ↓
   Backup
      ↓
   Migration
      ↓
   Validation
      ↓
   Start
```

特に重要なのは、**Migration前に自動バックアップを取得すること**です。

Migrationに失敗した場合でも、更新前の状態へ戻せるようにします。

---

## 7. DB初期化処理

内部の初期化処理は、例えば次のように構成します。

```text
1. Application Data Directory取得
2. Directory存在確認
3. 初期化マーカー確認
4. 未初期化の場合だけSQLite DB作成
5. SQLite Version / Format確認
6. PRAGMA設定
7. Migrations Table確認
8. Pending Migration実行
9. Integrity Check
10. Repository / Service Layer初期化
11. UI表示
```

初期化済みの場合、SQLiteの欠落・破損・読み取り不能・Schema不整合を検出したら、空のDBを作成せず、Recovery-only UI、診断、確認後のバックアップ復元へ進みます。

アプリケーション構造は、UIからSQLiteへ直接アクセスしない形が扱いやすくなります。

```text
┌───────────────────┐
│ Desktop App       │
├───────────────────┤
│ Application Layer │
├───────────────────┤
│ Repository        │
├───────────────────┤
│ SQLite            │
├───────────────────┤
│ app.db            │
└───────────────────┘
```

RepositoryやService Layerを介することで、DB構造の変更がUIへ直接波及しにくくなります。

---

## 8. WALモード

デスクトップアプリではSQLiteのWAL（Write-Ahead Logging）は相性の良い選択肢です。

WALを利用すると、通常は次のファイルが存在します。

```text
app.db
app.db-wal
app.db-shm
```

WALにより、例えば次のような読み取りとバックグラウンド書き込みを並行しやすくなります。

```text
UI Read
    │
    ├─────────┐
    │         │
Background Write
```

ただし、バックアップ時に`app.db`だけをファイルコピーする設計は避けます。

WAL利用時のバックアップには、SQLite Backup APIや適切なCheckpoint処理など、SQLiteの整合性を維持できる方式を使用します。

---

## 9. DBとユーザーファイルの分離

画像、動画、PDFなどの大容量データまでSQLiteのBLOBとして保存するより、DBとFilesystemを分離する構成が扱いやすい場合があります。

```text
App Data
├── app.db
└── objects/
    ├── abc123.pdf
    ├── def456.png
    └── ...
```

SQLite側には、ファイル本体ではなくMetadataを保存します。

```text
attachments

id
filename
path
sha256
created_at
```

役割分担は次のようになります。

```text
SQLite
  ↓
Metadata / Structured Data

Filesystem
  ↓
Large Binary Objects
```

この構成には次の利点があります。

- DB肥大化を抑えやすい
- バックアップを効率化しやすい
- ファイル操作が容易
- DB破損時の影響範囲を抑えやすい

---

## 10. データ種別ごとの保存先

すべての情報をSQLiteへ保存する必要はありません。

推奨する分離例は次の通りです。

| データ | 推奨保存先 |
|---|---|
| 業務・ユーザーデータ | SQLite |
| プロジェクト情報 | SQLite |
| 履歴 | SQLite |
| 大容量ファイル | Filesystem |
| UI設定 | Preferences / Config |
| APIキー | OS Keychain |
| Refresh Token | OS Keychain |
| Credentials | OS Keychain |
| Cache | Cache Directory |
| Logs | Logs Directory |
| Backup | Backup Directory |

秘密情報をSQLiteへ直接保存せず、OSのCredential Storeを利用する設計が適しています。

---

## 11. 設定方式の比較

ローカルDBの設定方法は、大きく3つに分類できます。

| 方式 | UX | 柔軟性 | 推奨度 |
|---|---:|---:|---:|
| アプリが完全自動管理 | ◎ | ○ | 最も推奨 |
| 初回に保存場所だけ選択 | ○ | ◎ | 特殊用途向け |
| DBファイル自体をユーザーが指定 | △ | ◎ | 開発者向け |

通常のデスクトップアプリでは、**アプリによる完全自動管理**を基本にするのが適しています。

---

## 12. ユーザー向け設定画面の例

ユーザーにはSQLiteそのものではなく、「Data & Recovery」として見せます。

```text
Data & Recovery

Data location
────────────────────────
On this Mac

Storage used
2.4 GB

[Open Data Folder]

Backup
Last backup: Today 08:14

[Back Up Now]
[Restore Backup]

Advanced
[Move Data Location]
[Export Data]
[Reset Application Data]
```

この構成なら、ユーザーはDBについて理解していなくてもデータを管理できます。

---

## 13. バックアップ・Recoveryとの統合

SQLite管理は、バックアップやRecovery機能と一体で設計すると安全性が高くなります。

```text
Desktop Application
        │
        ├── SQLite
        │     └── Structured Data
        │
        ├── Object Store
        │     └── Files / Attachments
        │
        ├── Preferences
        │     └── UI Settings
        │
        ├── Keychain
        │     └── Secrets
        │
        └── Recovery Manager
              ├── Automatic Snapshot
              ├── Pre-Migration Snapshot
              ├── Manual Backup
              └── Restore
```

特に次の処理は自動化しておくと安全です。

```text
自動DB作成
    ↓
自動Migration
    ↓
自動Integrity Check
    ↓
自動Backup
```

---

## 14. 推奨フローまとめ

### 初回起動

```text
アプリ起動
   ↓
Application Data Directory確認
   ↓
初期化マーカー確認
   ↓
未初期化
   ↓
DB作成
   ↓
Schema初期化
   ↓
Integrity Check
   ↓
アプリ開始
```

初期化済みの既存インストールでDBに問題がある場合は、空のDBを自動作成せず、Recovery-only UIで診断してから、確認後にバックアップを復元します。

### 通常起動

```text
アプリ起動
   ↓
DB Open
   ↓
Integrity Check
   ↓
Schema Version確認
   ↓
Migration必要?
 ├─ No → アプリ開始
 └─ Yes
      ↓
   Pre-Migration Backup
      ↓
   Migration
      ↓
   Validation
      ↓
   アプリ開始
```

### 保存場所変更

```text
変更先選択
   ↓
Write権限確認
   ↓
Snapshot
   ↓
DB / File Dataコピー
   ↓
Integrity Check
   ↓
新保存先へ切替
   ↓
旧データを一時保持
```

---

## 結論

デスクトップアプリでSQLiteを採用する場合は、**「SQLiteをユーザーに設定させる」のではなく、「アプリのデータ保存をユーザーに管理させる」設計**が適しています。

基本方針は次の通りです。

- SQLite DBは初回起動の未初期化状態に限ってアプリ側で自動作成する
- OS標準のApplication Data領域を使用する
- Schema Migrationを自動化する
- Migration前にバックアップを取得する
- 起動時にIntegrity Checkを行う
- 大容量ファイルは必要に応じてFilesystemへ分離する
- APIキーなどの秘密情報はOS Keychainへ保存する
- ユーザーには「保存場所」「バックアップ」「復元」「エクスポート」として見せる
- DBファイル名やSchemaなどの実装詳細は原則として見せない
- SQLiteのlive保存先、ファイル名、`DATABASE_URL`はアプリ内部で管理し、ユーザーに設定させない

最終的には、次の責務分離を目指すと管理しやすくなります。

```text
User
  ↓
Data & Recovery UI
  ↓
Application Layer
  ↓
Repository / Storage Layer
  ├── SQLite
  ├── Filesystem
  ├── Preferences
  ├── Keychain
  └── Recovery Manager
```
