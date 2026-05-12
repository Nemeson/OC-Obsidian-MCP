# Obsidian Memory Skill

Use Obsidian as a persistent memory layer for OpenCode agent sessions.

## Requirements

- Node.js v20+
- An Obsidian vault directory
- `mcp-obsidian-vault` (installed automatically via npx)

## Vault Folder Structure

```
MyVault/
└── OpenCode/
    ├── Sessions/          ← Auto-generated session logs (via DAILY_NOTE_FOLDER)
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

## Usage

### 1. Auto Session Logging (via Stop Hook)

After setup, every session's summary is automatically appended to:

```
OpenCode/Sessions/YYYY-MM-DD.md
```

This runs as an async Stop hook — it never blocks the agent.

### 2. Save a Decision (`/adr`)

Trigger the agent to save an Architecture Decision Record:

```
/adr "Why we chose SQLite over PostgreSQL for the embedded database"
```

The agent writes a structured ADR to `OpenCode/Decisions/`.

### 3. Save a Learning (`/remember`)

When you solve something non-trivial:

```
/remember "Rust borrow checker workaround for self-referential structs"
```

The agent writes the pattern to `OpenCode/Learnings/`.

### 4. Load Context from Obsidian

Place project context notes in `OpenCode/Context/`. Agents can read them
explicitly, or they can be loaded automatically during session bootstrap.

## Integration Notes

- **OpenCode**: Register via `~/.opencode/mcp.json` or `~/.config/opencode/opencode.json`
- **Claude Desktop**: Register via `claude_desktop_config.json`
- **Claude Code**: Use `claude mcp add obsidian -- <command>`
- **Codex CLI**: Register in `Codex.toml`

See the [README](../README.md) for full setup instructions.
