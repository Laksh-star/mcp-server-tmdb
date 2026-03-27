#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../../.." && pwd)"

load_env_file() {
  local file="$1"

  if [[ ! -f "$file" ]]; then
    return
  fi

  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"

    if [[ -z "$line" || "$line" == \#* ]]; then
      continue
    fi

    if [[ "$line" != *=* ]]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"

    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"

    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi

    export "$key=$value"
  done < "$file"
}

if [[ -z "${TMDB_API_KEY:-}" ]]; then
  load_env_file "$REPO_ROOT/.env"
fi

if [[ -z "${TMDB_API_KEY:-}" ]]; then
  load_env_file "$REPO_ROOT/.tmdb.env"
fi

if [[ -z "${TMDB_API_KEY:-}" ]]; then
  echo "TMDB_API_KEY is required. Set it in the environment or in $REPO_ROOT/.env." >&2
  exit 1
fi

if [[ ! -f "$REPO_ROOT/dist/index.js" ]]; then
  echo "Missing build output at $REPO_ROOT/dist/index.js. Run 'npm install' or 'npm run build' first." >&2
  exit 1
fi

exec node "$REPO_ROOT/dist/index.js"
