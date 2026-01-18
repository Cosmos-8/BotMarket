#!/usr/bin/env bash
set -euo pipefail

if [ "${SKIP_SECRET_SCAN:-}" = "1" ]; then
  exit 0
fi

if ! command -v rg >/dev/null 2>&1; then
  echo "secret-scan: rg not found; skipping."
  exit 0
fi

staged_files=$(git diff --cached --name-only --diff-filter=ACMRT || true)
if [ -n "$staged_files" ]; then
  env_files=$(echo "$staged_files" | rg '(^|/)\.env(\..+)?$' | rg -v '\.env\.example$' || true)
  if [ -n "$env_files" ]; then
    echo "secret-scan: .env files are staged; remove them before commit:"
    echo "$env_files"
    exit 1
  fi
fi

pattern="(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|ghu_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}|ghr_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z\\-_]{35}|sk-ant-[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|gsk_[A-Za-z0-9]{20,}|-----BEGIN[ A-Z]*PRIVATE KEY-----|POLYMARKET_(API_KEY|BUILDER_API_KEY)\\s*[:=]\\s*[\"']?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|POLYMARKET_(API_SECRET|BUILDER_SECRET)\\s*[:=]\\s*[\"']?[-A-Za-z0-9_+/=]{20,}|POLYMARKET_(API_PASSPHRASE|BUILDER_PASSPHRASE|PASSPHRASE)\\s*[:=]\\s*[\"']?[0-9a-fA-F]{32,}|(?i)(private[_-]?key|api[_-]?key|secret|token)\\s*[:=]\\s*[\"']?0x[0-9a-f]{64})"

added=$(git diff --cached -U0 --no-color || true)
if [ -z "$added" ]; then
  exit 0
fi

matches=$(echo "$added" | rg '^\+' | rg -v '^\+\+\+' | sed 's/^+//' | rg -n "$pattern" || true)
if [ -n "$matches" ]; then
  echo "secret-scan: potential secrets detected in staged changes:"
  echo "$matches"
  echo "secret-scan: if this is a false positive, set SKIP_SECRET_SCAN=1 for this commit."
  exit 1
fi
