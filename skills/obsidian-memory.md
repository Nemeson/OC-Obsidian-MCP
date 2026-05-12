# Obsidian Memory Skill

Use Obsidian as a persistent memory layer for OpenCode / Claude Code / Codex CLI agent sessions.

## Requirements

- Node.js v20+
- An Obsidian vault directory
- `mcp-obsidian-vault` (installed automatically via npx)

## Vault Folder Structure

```
MyVault/
└── OpenCode/
    ├── Sessions/          ← Session logs (auto via Stop Hook in Claude Code, manual via /session-log)
    ├── Decisions/         ← Architecture Decision Records (ADRs)
    ├── Learnings/         ← Reusable patterns, fixes, code snippets
    └── Context/           ← Project context notes (read by agents at session start)
```

## Available MCP Tools

All tools are provided by `mcp-obsidian-vault`:

| Tool | Description |
|---|---|
| `read_note(path)` | Read a note from vault |
| `write_note(path, content)` | Create a new note |
| `append_note(path, content)` | Append content to an existing note |
| `search_notes(query)` | Full-text search across vault |
| `list_notes(path)` | List notes in a directory |
| `delete_note(path)` | Delete a note (requires `confirm: true`) |
| `read_daily_note(date)` | Read a daily note |
| `append_daily_note(content)` | Append to the daily note |
| `search_tags(tag)` | Search notes by tag |
| `resolve_wikilink(link)` | Resolve a `[[wikilink]]` |
| `backlinks(path)` | Find all backlinks to a note |
| `resolve_frontmatter(path)` | Read YAML frontmatter |
| `git_sync(action)` | Git operations (commit, push, pull, status) |

## Commands

### 1. Manual Session Log (`/session-log`)

Save the current session summary to the vault **now**:

```
/session-log
```

This reads the latest session file (Claude Code `.tmp` or OpenCode `.json`) and appends the extracted summary to:

```
OpenCode/Sessions/YYYY-MM-DD.md
```

**Note:** The session file must exist in one of these directories:
- Claude Code: `~/.claude/session-data/`
- OpenCode: `~/.opencode/sessions/` (if supported)

### 2. Auto Session Logging (via Stop Hook) — Claude Code Only

After setup, every session's summary is **automatically** appended to the daily note when Claude Code fires the `Stop` hook.

This requires:
1. Running `setup.ps1` and installing the hook
2. The hook script copied to `~/.claude/scripts/hooks/obsidian-session-save.js`
3. `hooks.json` containing the `stop:obsidian-session-save` entry

**Limitation:** OpenCode does not currently support a Stop hook. Use `/session-log` manually instead.

### 3. Save a Decision (`/adr`)

Trigger the agent to save an Architecture Decision Record:

```
/adr "Why we chose SQLite over PostgreSQL for the embedded database"
```

The agent writes a structured ADR to `OpenCode/Decisions/`.

Template:
```markdown
# ADR-NNN: Title

**Status:** Proposed | Accepted | Rejected
**Date:** YYYY-MM-DD

## Context
[Why was this decision needed?]

## Decision
[What was decided?]

## Consequences
[Positive and negative impacts]
```

### 4. Save a Learning (`/remember`)

When you solve something non-trivial:

```
/remember "Rust borrow checker workaround for self-referential structs"
```

The agent writes the pattern to `OpenCode/Learnings/`.

Template:
```markdown
# [Title]

**Type:** Bugfix | Pattern | Code-Snippet | Architecture
**Project:** [Project name]
**Date:** YYYY-MM-DD

## Problem
[Short description]

## Solution
[How was it solved?]

## Code
```[language]
// relevant code example
```
```

### 5. Load Context from Obsidian

Place project context notes in `OpenCode/Context/`. Agents can read them explicitly, or they can be loaded automatically during session bootstrap.

## Integration Notes

- **OpenCode**: Register via `~/.opencode/mcp.json` or `~/.config/opencode/opencode.json`
- **Claude Desktop**: Register via `claude_desktop_config.json`
- **Claude Code**: Use `claude mcp add obsidian -- <command>` + Stop hook via `setup.ps1`
- **Codex CLI**: Register in `Codex.toml`

## CLI Commands (npm scripts)

```bash
# Manual session log
npx oc-obsidian-mcp session-log

# Or via package script (after install)
npm run session-log
```

See the [README](../README.md) for full setup instructions.
