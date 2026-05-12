# OC-Obsidian-MCP

**Persistent memory for OpenCode agents — backed by your Obsidian vault.**

Turn your daily notes, architecture decisions, and reusable learnings into a cross-session knowledge base that every agent session can read and write.

```
Agent Session  ──Stop Hook──►  Obsidian Vault  ──MCP Tools──►  Next Session
                                     │
                            ┌────────┼────────┐
                            │        │        │
                       Sessions  Decisions  Learnings
```

## How It Works

This project wraps `mcp-obsidian-vault` (the leading Obsidian MCP server) with setup automation, agent hooks, and documentation so it works as a self-contained OpenCode addon.

**Three layers of integration:**

| Layer | What | How |
|---|---|---|
| **MCP Server** | Read/write files in your vault | `mcp-obsidian-vault` via npx |
| **Stop Hook** | Auto-save session summaries | `obsidian-session-save.js` |
| **Agent Skill** | In-session memory commands | `skills/obsidian-memory.md` |

## Prerequisites

- **Node.js v20+** – [nodejs.org](https://nodejs.org/)
- **An Obsidian vault** – local directory on disk
- **OpenCode** (or any MCP-compatible client)

## Quick Start

### 1. Clone or copy

```bash
# Clone (if git)
git clone <this-repo> OC-Obsidian-MCP

# Or just copy the directory
xcopy /E /I OC-Obsidian-MCP C:\PythonTools\OC-Obsidian-MCP
```

### 2. Run setup

```powershell
# Windows
.\setup.ps1 -VaultPath "C:\Users\You\Obsidian\YourVault"

# Unattended (no prompts)
.\setup.ps1 -VaultPath "C:\Users\You\Obsidian\YourVault" -Unattended
```

```bash
# macOS / Linux
./setup.ps1 -VaultPath "~/Obsidian/YourVault"
```

**What setup does:**

1. Checks Node.js and npx are installed
2. Creates `config/.mcp-env` with your vault path and folder settings
3. Copies the MCP wrapper to a spacesafe path (`C:\temp` on Windows)
4. Registers the Obsidian MCP server in your OpenCode configs
5. Guides you through the remaining manual steps

### 3. Restart OpenCode

Close and reopen OpenCode. The Obsidian tools should now appear in the agent's tool list.

### 4. Verify

```bash
# Check the MCP server starts
npx -y mcp-obsidian-vault --version

# Look for startup in OpenCode logs
# You should see: "Obsidian MCP Server started. Vault: ..."
```

## Manual Installation

If the automated script doesn't fit your setup:

### a) Configure the MCP Server

**OpenCode (global config)** – `~/.opencode/mcp.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "C:\\temp\\obsidian-mcp.cmd",
      "args": []
    }
  }
}
```

**OpenCode (project config)** – `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "obsidian": {
      "type": "local",
      "command": ["C:\\temp\\obsidian-mcp.cmd"],
      "enabled": true
    }
  }
}
```

> **Note:** OpenCode does not support `env` in MCP configs. The wrapper script sets environment variables before launching `mcp-obsidian-vault`. Edit `config/.mcp-env` to change settings.

**Claude Desktop** – `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "mcp-obsidian-vault"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "C:\\Users\\You\\Obsidian\\YourVault",
        "GIT_AUTO_SYNC": "true",
        "DAILY_NOTE_FOLDER": "OpenCode/Sessions",
        "DECISIONS_FOLDER": "OpenCode/Decisions",
        "DISCOVERIES_FOLDER": "OpenCode/Learnings",
        "AGENTS_FOLDER": "OpenCode/Context"
      }
    }
  }
}
```

**Codex CLI** – `Codex.toml`:

```toml
[mcp_servers.obsidian]
command = "npx"
args = ["-y", "mcp-obsidian-vault"]

[mcp_servers.obsidian.env]
OBSIDIAN_VAULT_PATH = "C:/Users/You/Obsidian/YourVault"
GIT_AUTO_SYNC = "true"
DAILY_NOTE_FOLDER = "OpenCode/Sessions"
DECISIONS_FOLDER = "OpenCode/Decisions"
DISCOVERIES_FOLDER = "OpenCode/Learnings"
AGENTS_FOLDER = "OpenCode/Context"
```

See `config/` for ready-to-use templates.

### b) Create the vault folder structure

Your vault needs these folders (adjust names via the config variables above):

```
YourVault/
├── OpenCode/
│   ├── Sessions/
│   ├── Decisions/
│   ├── Learnings/
│   └── Context/
```

### c) Install the Stop Hook (optional)

For automatic session logging, add this to your OpenCode hook config:

Add to the `"Stop"` array in `~/.claude/hooks/hooks.json`:

```json
{
  "matcher": "*",
  "hooks": [
    {
      "type": "command",
      "command": "node \"C:\\PythonTools\\OC-Obsidian-MCP\\hooks\\obsidian-session-save.js\"",
      "async": true,
      "timeout": 15
    }
  ],
  "description": "Save session learnings to Obsidian vault",
  "id": "stop:obsidian-session-save"
}
```

The hook runs asynchronously and never blocks the agent response.

## Vault Folder Reference

| Folder | Environment Variable | Default | Purpose |
|---|---|---|---|
| Sessions | `DAILY_NOTE_FOLDER` | `OpenCode/Sessions` | Auto-generated session logs via `append_daily_note` |
| Decisions | `DECISIONS_FOLDER` | `OpenCode/Decisions` | Architecture Decision Records |
| Learnings | `DISCOVERIES_FOLDER` | `OpenCode/Learnings` | Reusable patterns, fixes, snippets |
| Context | `AGENTS_FOLDER` | `OpenCode/Context` | Project context for agent bootstrap |

### Recommended note templates

**Decision Record** (`Decisions/ADR-001-title.md`):

```markdown
# ADR-001: Title

**Status:** Accepted | Proposed | Deprecated
**Date:** 2026-05-12

## Context
Why was this decision needed?

## Decision
What was decided?

## Consequences
What tradeoffs were accepted?
```

**Learning** (`Learnings/pattern-name.md`):

```markdown
# Pattern Name

**Type:** Bugfix | Pattern | Code-Snippet | Architecture
**Project:** project-name
**Date:** 2026-05-12

## Problem
What happened?

## Solution
How was it fixed?

## Code
```python
# relevant example
```
```

## Environment Variables

The MCP server and hook script read these from `config/.mcp-env` or process environment:

| Variable | Required | Default | Description |
|---|---|---|---|
| `OBSIDIAN_VAULT_PATH` | **Yes** | — | Absolute path to your vault |
| `DAILY_NOTE_FOLDER` | No | `OpenCode/Sessions` | Daily notes subfolder |
| `DECISIONS_FOLDER` | No | `OpenCode/Decisions` | ADR subfolder |
| `DISCOVERIES_FOLDER` | No | `OpenCode/Learnings` | Learning notes subfolder |
| `AGENTS_FOLDER` | No | `OpenCode/Context` | Context notes subfolder |
| `GIT_AUTO_SYNC` | No | `true` | Auto-commit+push after every write |
| `TRASH_ON_DELETE` | No | `true` | Move to `.trash` instead of permanent delete |
| `MCP_TIMEOUT_MS` | No | `15000` | MCP call timeout in ms |

## Cross-Platform Support

| Feature | Windows | macOS | Linux |
|---|---|---|---|
| MCP Wrapper | `obsidian-mcp-wrapper.cmd` | `obsidian-mcp-wrapper.sh` | `obsidian-mcp-wrapper.sh` |
| Setup Script | `setup.ps1` | `setup.ps1` | `setup.ps1` |
| Hook Script | ✓ | ✓ | ✓ |

On Windows, the wrapper is copied to `C:\temp\obsidian-mcp.cmd` to avoid spaces in the path, which OpenCode cannot handle.

## Architecture

```
┌────────────────────────────────────────────────────┐
│                   OpenCode Agent                    │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ MCP Tools   │  │ Stop Hook    │  │ Skill     │  │
│  │ (read/write)│  │ (auto-save)  │  │ (prompts) │  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬─────┘  │
└─────────┼────────────────┼────────────────┼─────────┘
          │                │                │
          ▼                ▼                ▼
┌────────────────────────────────────────────────────┐
│              mcp-obsidian-vault (MCP Server)        │
│              ┌──────────────────────┐               │
│              │   27 Tools            │               │
│              │   read/write/search   │               │
│              │   git sync, tags      │               │
│              └──────────┬───────────┘               │
└─────────────────────────┼───────────────────────────┘
                          │
                          ▼
           ┌──────────────────────────┐
           │    Obsidian Vault        │
           │   (markdown files on     │
           │    local filesystem)     │
           └──────────────────────────┘
```

## Troubleshooting

### "OBSIDIAN_VAULT_PATH is required"

The MCP server needs the vault path. Make sure:
- `config/.mcp-env` exists and has the path set
- The path is absolute (e.g. `C:\Users\...`)
- You've restarted OpenCode after editing

### MCP tools not appearing in OpenCode

1. Check `~/.opencode/mcp.json` has the obsidian entry
2. Verify the wrapper path has no spaces
3. Run the wrapper manually to see startup errors:
   ```bash
   C:\temp\obsidian-mcp.cmd --version
   ```
4. Restart OpenCode fully (not just the window — kill the process)

### The Stop hook isn't saving sessions

1. Verify `OBSIDIAN_VAULT_PATH` is set in the environment
2. Set `DEBUG_HOOK=1` and check stderr output
3. Check the hook is registered in `hooks.json` under `"Stop"`
4. Make sure `obsidian-session-save.js` exists at the registered path

### Git sync errors

If `GIT_AUTO_SYNC=true` causes errors:
1. Make sure your vault is a git repository:
   ```bash
   cd /path/to/vault && git init
   ```
2. Set `GIT_AUTO_SYNC=false` to disable auto-commits

### Windows: Spaces in username path

If your username contains spaces (e.g. `C:\Users\Kevin Seipel\`), OpenCode cannot pass it as a command argument. The workaround:
- Use the batch wrapper in a spacesafe path (`C:\temp\obsidian-mcp.cmd`)
- The wrapper sets env vars before launching the MCP server

## Files

```
OC-Obsidian-MCP/
├── README.md                          ← This file
├── setup.ps1                          ← Automated installer (Win/Mac/Linux)
├── config/
│   ├── .mcp-env                       ← Your vault config (generated by setup)
│   ├── .mcp-env.template              ← Config template
│   ├── mcp-config-opencode-global.json
│   ├── mcp-config-opencode-project.json
│   ├── mcp-config-claude-desktop.json
│   ├── mcp-config-codex.toml
│   └── mcp-config-hooks.json
├── scripts/
│   ├── obsidian-mcp-wrapper.cmd       ← Windows wrapper
│   └── obsidian-mcp-wrapper.sh        ← Unix wrapper
├── hooks/
│   └── obsidian-session-save.js       ← Stop hook for auto-save
└── skills/
    └── obsidian-memory.md             ← Agent skill documentation
```

## License

MIT — use freely, modify, share.
