#!/usr/bin/env sh
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PY_OUT="${TMPDIR:-/tmp}/feed-parity-python.$$"
JS_OUT="${TMPDIR:-/tmp}/feed-parity-node.$$"
DIFF_OUT="${TMPDIR:-/tmp}/feed-parity-diff.$$"

cleanup() {
  rm -f "$PY_OUT" "$JS_OUT" "$DIFF_OUT"
}
trap cleanup EXIT

python3 "$HERE/parity_check.py" > "$PY_OUT"
node "$HERE/parity_check.js" > "$JS_OUT"

if diff -u "$PY_OUT" "$JS_OUT" > "$DIFF_OUT"; then
  echo "PASS: Python and Node routing parity match."
else
  echo "FAIL: Python and Node routing parity diverged." >&2
  cat "$DIFF_OUT" >&2
  exit 1
fi
