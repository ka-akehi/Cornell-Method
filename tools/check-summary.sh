#!/bin/sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: sh tools/check-summary.sh <summary-file>" >&2
  exit 2
fi

file="$1"

if [ ! -f "$file" ]; then
  echo "missing file: $file" >&2
  exit 1
fi

status=0

for heading in \
  "## Objective" \
  "## Scope" \
  "## Inputs Read" \
  "## Changes Made" \
  "## Findings" \
  "## Verification" \
  "## Remaining Unknowns" \
  "## Next Read"
do
  if ! grep -Fq "$heading" "$file"; then
    echo "missing heading: $heading" >&2
    status=1
  fi
done

if grep -Eq '<<<<<<<|=======|>>>>>>>' "$file"; then
  echo "conflict marker found" >&2
  status=1
fi

case "$file" in
  summary/*|*/summary/*) ;;
  *)
    echo "summary file should be under summary/" >&2
    status=1
    ;;
esac

exit "$status"
