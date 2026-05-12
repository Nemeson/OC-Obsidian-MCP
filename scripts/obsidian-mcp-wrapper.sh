#!/usr/bin/env bash
# OC-Obsidian-MCP: MCP Server Wrapper (macOS / Linux)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/config/.mcp-env"

load_env() {
  if [ ! -f "$ENV_FILE" ]; then return; fi
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip comments and empty lines
    trimmed="${line#"${line%%[![:space:]]*}"}"
    [ -z "$trimmed" ] && continue
    [ "${trimmed#\#}" != "$trimmed" ] && continue
    # Only export if not already set
    key="${line%%=*}"
    if [ -n "${key:-}" ] && [ -z "${!key:-}" ] && [ -n "${line##*=*}" ]; then
      eval "export $line"
    elif [ -n "${key:-}" ] && [ -z "${!key:-}" ]; then
      eval "export \"$line\""
    fi
  done < "$ENV_FILE"
}

load_env

: "${OBSIDIAN_VAULT_PATH:="$HOME/Obsidian/MyVault"}"
: "${DAILY_NOTE_FOLDER:="OpenCode/Sessions"}"
: "${DECISIONS_FOLDER:="OpenCode/Decisions"}"
: "${DISCOVERIES_FOLDER:="OpenCode/Learnings"}"
: "${AGENTS_FOLDER:="OpenCode/Context"}"
: "${GIT_AUTO_SYNC:="true"}"
: "${TRASH_ON_DELETE:="true"}"

if [ -z "$OBSIDIAN_VAULT_PATH" ]; then
  echo '[ERROR] OBSIDIAN_VAULT_PATH is required.' >&2
  exit 1
fi
if [ ! -d "$OBSIDIAN_VAULT_PATH" ]; then
  echo "[ERROR] Vault path does not exist: $OBSIDIAN_VAULT_PATH" >&2
  exit 1
fi

export OBSIDIAN_VAULT_PATH DAILY_NOTE_FOLDER DECISIONS_FOLDER DISCOVERIES_FOLDER AGENTS_FOLDER GIT_AUTO_SYNC TRASH_ON_DELETE

npx -y mcp-obsidian-vault "$@"
