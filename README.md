# OC-Obsidian-MCP

**Persistent memory for AI agents — backed by your Obsidian vault.**

Turn your daily notes, architecture decisions, and reusable learnings into a cross-session knowledge base that every agent session can read and write.

```
Agent Session  ──Stop Hook──►  Obsidian Vault  ──MCP Tools──►  Next Session
                                     │
                            ┌────────┼────────┐
                            │        │        │
                      Sessions  Decisions  Learnings
```

## Features

| Feature | Description |
|---------|-------------|
| **Auto Session Logging** | Every session ends with a summary appended to your daily note |
| **Architecture Decisions** | Save ADRs with `/adr` command |
| **Learnings & Patterns** | Store reusable solutions with `/remember` |
| **Context Loading** | Bootstrap sessions from `OpenCode/Context/` notes |
| **Cross-Platform** | Windows, macOS, Linux |
| **Zero Config** | Works out of the box after `npm install` + setup |

## Installation

### Via npm (recommended)

```bash
npm install -g oc-obsidian-mcp
```

Or use npx without installing:

```bash
npx oc-obsidian-mcp session-log
```

### Via Git (for development)

```bash
git clone https://github.com/yourusername/oc-obsidian-mcp.git
cd oc-obsidian-MCP
npm install
npm test        # verify everything works
```

## Quick Start

### 1. Set your vault path

```bash
# Create a config file (or set env var)
echo "OBSIDIAN_VAULT_PATH=/path/to/your/vault" > config/.mcp-env
```

### 2. Run setup

```bash
# Global install
oc-obsidian-mcp setup

# Or via npx
npx oc-obsidian-mcp setup

# Or use the PowerShell script directly
pwsh setup.ps1 -VaultPath "/path/to/your/vault"
```

### 3. Restart your agent client

Close and reopen OpenCode / Claude Code / Codex. The Obsidian tools will now appear in the tool list.

### 4. Verify

```bash
# Test MCP server starts
npx -y mcp-obsidian-vault --version

# Test manual session logging
npx oc-obsidian-mcp session-log
```

## CLI Commands

After `npm install -g oc-obsidian-mcp`:

| Command | Description |
|---------|-------------|
| `oc-obsidian-mcp setup` | Interactive setup (vault path, config, hooks) |
| `oc-obsidian-mcp session-log` | Manually save current session summary to vault |
| `npx oc-obsidian-mcp <command>` | Run without installing |

### npm Scripts (within project)

```bash
npm test              # run test suite
npm run test:watch    # run tests in watch mode
npm run lint          # run eslint on scripts/hooks/bin
npm run session-log   # manual session logging
npm run setup         # run setup.ps1
```

## In-Session Commands

### Save a Decision (`/adr`)

```
/adr "Why we chose SQLite over PostgreSQL"
```

Writes a structured ADR to `OpenCode/Decisions/`.

### Save a Learning (`/remember`)

```
/remember "Rust borrow checker workaround for self-referential structs"
```

Writes the pattern to `OpenCode/Learnings/`.

### Manual Session Log (`/session-log`)

```
/session-log
```

Reads the latest session file and appends the summary to `OpenCode/Sessions/YYYY-MM-DD.md`.

**Note:** For Claude Code, auto-logging via Stop Hook is preferred. For OpenCode, use `/session-log` manually (OpenCode does not support Stop hooks yet).

## Prerequisites

- **Node.js v20+** – [nodejs.org](https://nodejs.org/)
- **An Obsidian vault** – local directory on disk
- **Any MCP-compatible client** – OpenCode, Claude Code, Claude Desktop, Codex CLI

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OBSIDIAN_VAULT_PATH` | *(required)* | Path to your Obsidian vault |
| `DAILY_NOTE_FOLDER` | `OpenCode/Sessions` | Where session logs are stored |
| `DECISIONS_FOLDER` | `OpenCode/Decisions` | Where ADRs are stored |
| `LEARNINGS_FOLDER` | `OpenCode/Learnings` | Where patterns are stored |
| `GIT_AUTO_SYNC` | `true` | Auto-commit vault changes |
| `DEBUG_HOOK` | `0` | Enable verbose hook logging |

Set these in `config/.mcp-env` (project-local) or as system environment variables.

### MCP Client Config

**OpenCode** – `~/.opencode/mcp.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "mcp-obsidian-vault"]
    }
  }
}
```

**Claude Desktop** – `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "mcp-obsidian-vault"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/path/to/your/vault"
      }
    }
  }
}
```

See `config/` for templates for all supported clients.

## Vault Folder Structure

```
YourVault/
└── OpenCode/
    ├── Sessions/          ← Auto session logs (daily)
    ├── Decisions/         ← Architecture Decision Records
    ├── Learnings/         ← Patterns, fixes, snippets
    └── Context/           ← Project context notes
```

## Publishing to npm

1. **Set your token** in `secrets.yaml` (never committed):

   ```yaml
   npm:
     token: "npm_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```

2. **Login and publish**:

   ```bash
   npm login
   npm publish
   ```

3. **Or use GitHub Actions** (see `.github/workflows/ci.yml`):

   Set `NPM_TOKEN` as a repository secret.

## How It Works

This project wraps `mcp-obsidian-vault` (the leading Obsidian MCP server) with:

| Layer | What | How |
|---|---|---|
| **MCP Server** | Read/write vault files | `mcp-obsidian-vault` via npx |
| **Stop Hook** | Auto-save session summaries | `obsidian-session-save.js` (Claude Code only) |
| **CLI Tool** | Manual session logging | `bin/session-log.js` |
| **Agent Skill** | In-session memory commands | `skills/obsidian-memory.md` |

## License

MIT – See [LICENSE](LICENSE).

## Credits

- [mcp-obsidian-vault](https://github.com/cyanheads/mcp-obsidian-vault) — The underlying MCP server
- Obsidian — The best note-taking app for agents
