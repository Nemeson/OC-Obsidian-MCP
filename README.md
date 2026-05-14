# ObMem

<pre>
 ██████╗ ██████╗ ███╗   ███╗███████╗███╗   ███╗
██╔═══██╗██╔══██╗████╗ ████║██╔════╝████╗ ████║
██║   ██║██████╔╝██╔████╔██║█████╗  ██╔████╔██║
██║   ██║██╔══██╗██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║
╚██████╔╝██████╔╝██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║
 ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝
  Persistent Memory for AI Agents
</pre>

> Your AI agents forget everything when the session ends. ObMem fixes that.

[![npm](https://img.shields.io/badge/npm-v2.5.0-blue)](https://www.npmjs.com/package/obmem)
[![Tests](https://img.shields.io/badge/tests-284%2F284-brightgreen)](.)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-blue)](package.json)

**Zero dependencies. Zero config after setup. Cross-platform.**

[Deutsch](README.de.md) | [English](README.md)

---

```
Agent Session ──Stop Hook──► Obsidian Vault ──MCP Tools──► Next Session
                                    │
                           ┌────────┼────────┐
                           │        │        │
                     Sessions  Decisions  Learnings
```

Turn every session's insights into a **growing knowledge base** your agents read and write — automatically.

---

## Why ObMem?

Every AI coding session starts from zero. The bug you fixed yesterday? Forgotten. The ADR from last week? Lost. The pattern that solved that tricky auth issue? Gone.

**ObMem persists what matters** in your Obsidian vault — where it belongs.

- **Sessions** are automatically logged with duration, success rate, and efficiency scores
- **Architecture Decisions** are tracked with git traceability (`commit_hash`, `scope`)
- **Learnings & Patterns** evolve into Skills when reused ≥5 times
- **Conflicts** are detected semantically before they bite you
- **Smart Search** uses hybrid keyword + TF-IDF scoring with relevance boosting

---

## What's New in v2.5

| Feature | What it does |
|---------|-------------|
| **Semantic Conflict Detection** 🔥 | NLP heuristics detect contradictory learnings (negation pairs + topic overlap). No more "always use X / never use X" confusion. |
| **Skill-Evolution** | Learnings with `reuse_count >= 5` auto-promote to `OpenCode/Skills/{project}/`. Evolved with bidirectional links. |
| **Git Traceability** | Every ADR and Learning stores `scope: [affected-files]` and `commit_hash` for full lineage. |
| **Session Analytics** | Auto-computed `duration_minutes`, `success_rate`, and `efficiency_score` in every session log. |
| **`--semantic` Flag** | Pure TF-IDF mode for `obmem related`. Switch off keyword weighting when you need semantic-only search. |
| **284 Tests** | Full test coverage for stemmer, tokenizer, TF-IDF, relevance scoring, and hybrid search. |

---

## Installation

### Via npm (recommended)

```bash
npm install -g obmem
```

Or use npx without installing:

```bash
npx obmem session-log
npx obmem adr "Migrated to TypeScript strict mode"
```

### Via Git (for development)

```bash
git clone https://github.com/Nemeson/OC-Obsidian-MCP.git
cd OC-Obsidian-MCP
npm test        # 284 tests, zero dependencies
```

---

## Quick Start

### 1. Point to your vault

```bash
# Linux/macOS
echo "OBSIDIAN_VAULT_PATH=/home/you/vault" > config/.mcp-env

# Windows (PowerShell)
Set-Content config/.mcp-env "OBSIDIAN_VAULT_PATH=C:\Users\You\vault"
```

### 2. Run setup (once)

```bash
npx obmem setup
```

This creates the folder structure in your vault:
```
OpenCode/
├── Sessions/           # Auto-logged session summaries
├── Decisions/          # Architecture Decision Records
├── Learnings/          # Reusable patterns & solutions
├── Skills/             # Auto-promoted learnings (reuse_count >= 5)
├── Context/            # Session bootstrap notes
└── _index.md           # Interactive project dashboard
```

### 3. Use your agents normally

Every session end appends a summary to your daily note. Run `obmem gc` periodically to:
- Promote mature learnings to Skills
- Detect cross-learning conflicts
- Clean stale sessions (90d default)

---

## See It In Action

### Log a Learning

```bash
$ npx obmem remember "Zod schema composition for nested configs"
✓ Saved to OpenCode/Learnings/zod-schema-composition.md
  Tags: #pattern #validation #typescript
```

Result in your vault:
```yaml
---
type: learning
tags: [pattern, validation, typescript]
date: 2026-05-14
scope: []
commit_hash: 34cc505
---

# Zod schema composition for nested configs

Use `.merge()` or `.extend()` to compose base schemas instead of duplicating fields.
```

### Track an Architecture Decision

```bash
$ npx obmem adr "Use Redis over Memcached for session store"
✓ Saved to OpenCode/Decisions/ADR-007-redis-session-store.md
  Tags: #architecture #caching #redis
```

### Search Your Vault

```bash
$ npx obmem related "auth middleware" --max 3
🔍 3 related notes found:

  1. learning:jwt-caching-pattern.md     (score: 0.87)
  2. decision:ADR-003-session-store.md    (score: 0.71)
  3. session:2026-05-14.md              (score: 0.65)
```

### Detect Conflicts

```bash
$ npx obmem gc --project my-api
🗑️  Cleaned 2 stale sessions
🧠 Promoted 1 learning to skill: zod-schema-composition.md
⚠️  Conflict detected:
    learning:use-pnpm.md  ↔  learning:use-npm-only.md
    Type: negation_pair | Severity: high
```

### Semantic Search

```bash
$ npx obmem related "error handling best practices" --semantic
🔍 Semantic results (pure TF-IDF):

  1. learning:try-catch-patterns.md       (score: 0.92)
  2. decision:ADR-005-error-strategy.md (score: 0.84)
```

---

## CLI Commands

| Command | Example | Purpose |
|---------|---------|---------|
| `obmem session-log` | `npx obmem session-log` | Manually log current session |
| `obmem adr <title>` | `npx obmem adr "Use Zod over Joi"` | Log architecture decision |
| `obmem remember <title>` | `npx obmem remember "JWT caching pattern"` | Store a learning/pattern |
| `obmem related <query>` | `npx obmem related "auth" --max 5` | Hybrid search across all notes |
| `obmem related -s <q>` | `npx obmem related "error handling" --semantic` | Pure TF-IDF semantic search |
| `obmem digest` | `npx obmem digest --project my-api` | Generate weekly digest |
| `obmem gc` | `npx obmem gc --project my-api` | Run garbage collection + skill evolution + conflict detection |
| `obmem reflect` | `npx obmem reflect` | Daily reflection prompt |
| `obmem goal` | `npx obmem goal` | Weekly goal planner |
| `obmem update` | `npx obmem update` | Update to latest version |
| `obmem setup` | `npx obmem setup` | Interactive first-time setup |

**Environment variables:**
- `OBSIDIAN_VAULT_PATH` — Path to your Obsidian vault root
- `DRY_RUN=true` — Preview GC changes without modifying files

---

## How It Works

### Automatic Session Logging

When your agent session ends, ObMem appends a structured summary to your daily note:

```markdown
## Session Log — 14.05.2026

- **Project:** my-api
- **Duration:** 45m
- **Goal:** Refactor auth middleware to use Zod
- **Key Decisions:** 2
- **Learnings:** 1
- **Status:** ✅ Completed
- **Efficiency Score:** 8.4/10
```

### Architecture Decisions with Git Traceability

```bash
npx obmem adr "Use Redis over Memcached for session store"
```

Creates `OpenCode/Decisions/ADR-007-redis-session-store.md`:
```yaml
---
type: decision
tags: [architecture, caching, redis]
scope: [src/session.js, src/cache/redis.js]
commit_hash: a1b2c3d
---
```

### Learnings That Evolve Into Skills

```bash
npx obmem remember "Zod schema composition for nested configs"
```

After 5 reuses (tracked via `reuse_count`), this learning auto-promotes to:
```
OpenCode/Skills/my-api/
└── zod-schema-composition.md
```

...with bidirectional links (`evolved_from`, `evolved_into`) back to the original.

### Semantic Conflict Detection

Two contradictory learnings? ObMem flags them during GC:

```yaml
conflict_detected: true
conflict_with: ["use-pnpm-over-npm.md"]
conflict_type: negation_pair
conflict_severity: high
```

No more "always use X" / "never use X" drifting silently in your vault.

---

## ObMem vs. Alternatives

| | **ObMem** | Continuum | mem0 | Supermemory |
|---|:---:|:---:|:---:|:---:|
| **Storage** | Your Obsidian vault | External DB | External API | External service |
| **Offline** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Zero deps** | ✅ Yes | ❌ Requires DB | ❌ Requires SDK | ❌ Requires API key |
| **Data ownership** | ✅ You own everything | ⚠️ Cloud-hosted | ⚠️ External API | ⚠️ External service |
| **Semantic conflict detection** | ✅ Built-in | ❌ No | ❌ No | ❌ No |
| **Skill evolution** | ✅ Auto-promotion | ❌ No | ❌ No | ❌ No |
| **Git traceability** | ✅ Built-in | ❌ No | ❌ No | ❌ No |
| **Agent-agnostic** | ✅ MCP standard | ⚠️ Specific clients | ⚠️ Specific clients | ⚠️ Specific clients |

**Bottom line:** If you already use Obsidian and want your agents to remember without vendor lock-in, ObMem is the zero-friction choice.

---

## Roadmap

| Version | Focus | ETA |
|---------|-------|-----|
| **v2.6** | Web dashboard (read-only, no backend) | Q3 2026 |
| **v2.7** | Multi-vault sync (work + personal) | Q4 2026 |
| **v3.0** | WASM-based vector search (still zero npm deps) | Q1 2027 |
| **v3.x** | Plugin ecosystem (custom conflict detectors, skill pipelines) | 2027 |

Want to vote on priorities? [Open an issue](https://github.com/Nemeson/OC-Obsidian-MCP/issues) or DM me on [X](https://x.com/NemesonOne).

---

## FAQ

### How is this different from MCP Memory or other memory servers?

Other memory servers store your data in external databases or APIs. ObMem writes directly to your Obsidian vault — Markdown files you own, can version with Git, and search with any tool (including Obsidian's built-in search).

### Do I need to run a server?

No. ObMem is a CLI tool + MCP server. The CLI writes to your vault directly. The MCP server just exposes the same operations to your agent client.

### Can I use this without Obsidian?

Technically yes — ObMem writes standard Markdown with YAML frontmatter. But the folder structure and `_index.md` dashboard are designed for Obsidian. If you use another Markdown-based tool (Logseq, Dendron), most features will still work.

### What happens to my data if I uninstall?

Nothing. Your data is in your vault. Uninstalling ObMem just stops the automatic logging — your notes stay.

### How does conflict detection work?

During garbage collection, ObMem scans all learning notes in pairs. It detects:
- **Negation pairs**: "always use X" vs "never use X"
- **Topic overlap**: Two notes covering the same domain with contradictory advice
- **Severity scoring**: Based on how central the contradiction is to each note

### Can I customize the skill evolution threshold?

Not yet (hardcoded at `reuse_count >= 5`). This will be configurable in v2.6. For now, you can manually promote a learning by copying it to `OpenCode/Skills/{project}/`.

### Does this work with Claude Code / OpenCode / Codex?

Yes. ObMem implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) standard. Any client supporting MCP tools can read and write to your vault.

---

Create `config/.mcp-env`:

```bash
# Required
OBSIDIAN_VAULT_PATH=/path/to/your/vault

# Optional
DRY_RUN=false          # Set to true to preview GC without changes
```

Or set via environment before any command:
```bash
OBSIDIAN_VAULT_PATH=/home/you/vault npx obmem gc
```

---

## Tested

```bash
npm test
# 284 passed, 0 failed
```

Zero runtime dependencies. Node 20+ required.

---

## Buy Me a Coffee ☕

ObMem is maintained by a solo developer who believes agents should remember what you teach them.

If this saves you from explaining the same bug twice:

**[buymeacoffee.com/Nemeson](https://buymeacoffee.com/Nemeson)**

---

## License

MIT © [Nemeson](https://github.com/Nemeson)
