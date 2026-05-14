# ObMem — Persistent Memory for AI Agents

> Your AI agents forget everything when the session ends. ObMem fixes that.

[![npm](https://img.shields.io/npm/v/obmem)](https://www.npmjs.com/package/obmem)
[![Tests](https://img.shields.io/badge/tests-284%2F284-brightgreen)](.)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-blue)](package.json)

**Zero dependencies. Zero config after setup. Cross-platform.**

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

## Configuration

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
