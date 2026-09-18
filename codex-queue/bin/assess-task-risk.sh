#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <task-file>" >&2
  exit 1
fi

task_file="$1"

if [ ! -f "$task_file" ]; then
  echo "Task file not found: $task_file" >&2
  exit 1
fi

read_field() {
  name="$1"
  values="$(sed -n "s/^[[:space:]]*$name:[[:space:]]*//p" "$task_file" | sed 's/[[:space:]]*$//')"
  count="$(printf '%s\n' "$values" | awk 'NF { count += 1 } END { print count + 0 }')"
  if [ "$count" -ne 1 ]; then
    echo "Task risk assessment requires exactly one $name field." >&2
    exit 1
  fi
  printf '%s\n' "$values"
}

validate_score() {
  name="$1"
  value="$2"
  case "$value" in
    0|1|2|3) ;;
    *)
      echo "$name must be an integer from 0 to 3." >&2
      exit 1
      ;;
  esac
}

impact="$(read_field CODEX_RISK_IMPACT)"
reversibility="$(read_field CODEX_RISK_REVERSIBILITY)"
verification="$(read_field CODEX_RISK_VERIFICATION)"
flags_raw="$(read_field CODEX_RISK_FLAGS)"

validate_score CODEX_RISK_IMPACT "$impact"
validate_score CODEX_RISK_REVERSIBILITY "$reversibility"
validate_score CODEX_RISK_VERIFICATION "$verification"

score=$((impact + reversibility + verification))

case "$score" in
  0|1|2)
    risk="low"
    risk_rank=1
    ;;
  3|4|5)
    risk="normal"
    risk_rank=2
    ;;
  6|7)
    risk="high"
    risk_rank=3
    ;;
  8|9)
    risk="critical"
    risk_rank=4
    ;;
  *)
    echo "Unexpected task risk score: $score" >&2
    exit 1
    ;;
esac

high_reasons=""
critical_reasons=""
normalized_flags=""

append_reason() {
  current="$1"
  value="$2"
  if [ -z "$current" ]; then
    printf '%s\n' "$value"
  else
    printf '%s,%s\n' "$current" "$value"
  fi
}

flags="$(printf '%s' "$flags_raw" | tr '[:upper:]' '[:lower:]' | tr ',' '\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | awk 'NF')"

if [ -z "$flags" ]; then
  echo "CODEX_RISK_FLAGS must be 'none' or a comma-separated list of supported flags." >&2
  exit 1
fi

saw_none=0
saw_real_flag=0
for flag in $flags; do
  case "$flag" in
    none)
      saw_none=1
      ;;
    persisted-state|security|concurrency)
      saw_real_flag=1
      normalized_flags="$(append_reason "$normalized_flags" "$flag")"
      high_reasons="$(append_reason "$high_reasons" "$flag")"
      ;;
    destructive|migration-restore|crypto-trust|data-loss)
      saw_real_flag=1
      normalized_flags="$(append_reason "$normalized_flags" "$flag")"
      critical_reasons="$(append_reason "$critical_reasons" "$flag")"
      ;;
    *)
      echo "Unsupported CODEX_RISK_FLAGS value: $flag" >&2
      exit 1
      ;;
  esac
done

if [ "$saw_none" -eq 1 ] && [ "$saw_real_flag" -eq 1 ]; then
  echo "CODEX_RISK_FLAGS cannot combine 'none' with another flag." >&2
  exit 1
fi

if [ "$saw_none" -eq 1 ]; then
  normalized_flags="none"
fi

if [ -n "$critical_reasons" ] && [ "$risk_rank" -lt 4 ]; then
  risk="critical"
  risk_rank=4
elif [ -n "$high_reasons" ] && [ "$risk_rank" -lt 3 ]; then
  risk="high"
  risk_rank=3
fi

reason="score=$score(i=$impact,r=$reversibility,v=$verification);flags=$normalized_flags"
if [ -n "$critical_reasons" ]; then
  reason="$reason;floor=critical:$critical_reasons"
elif [ -n "$high_reasons" ]; then
  reason="$reason;floor=high:$high_reasons"
fi

printf '%s\n' "$risk"
printf '%s\n' "$reason"
