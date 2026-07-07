# Manager Fix: Worker Coding Model Fallback

## Objective

coding task は `GPT-5.3-Codex-Spark` を優先し、Spark がこのアカウントや環境で使えない場合だけ model 指定なしの通常実行へフォールバックするようにした。

## Background

`GPT-5.3-Codex-Spark` は ChatGPT account の Codex 実行で unsupported となり、coding task が実行前に failed になっていた。本来の運用は「Spark を使用し、無ければ既定モデルを使用する」だったため、自動フォールバックを実装した。

## Changes Made

| Path | Change |
|---|---|
| `codex-queue/bin/worker-run.sh` | `CODEX_CODING_WORKER_MODEL` 未指定時は `GPT-5.3-Codex-Spark` を使う。model unavailable 系の失敗を検出した場合だけ、model 指定なしの通常実行へ再試行するようにした。 |
| `codex-queue/README.md` | coding task は Spark 優先、使えない場合は通常実行へフォールバックする説明へ更新した。 |
| `codex-queue/prompts/manager-codex.md` | Manager 運用ルールを Spark 優先 + unavailable 時 fallback に更新した。 |

## Verification

| Command | Result |
|---|---|
| `sh -n codex-queue/bin/worker-run.sh` | PASS |
| `sh -n codex-queue/bin/worker-run.sh` | PASS |

## Next Read

- `codex-queue/bin/worker-run.sh`
- `codex-queue/README.md`
- `codex-queue/prompts/manager-codex.md`
