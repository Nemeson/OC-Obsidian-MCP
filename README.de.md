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

> Deine KI-Agenten vergessen alles, wenn die Session endet. ObMem behebt das.

[![npm](https://img.shields.io/badge/npm-v2.5.0-blue)](https://www.npmjs.com/package/obmem)
[![Tests](https://img.shields.io/badge/tests-257%2F257-brightgreen)](.)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-blue)](package.json)

**Zero Dependencies. Zero Config nach dem Setup. Cross-Platform.**

[Deutsch](README.de.md) | [English](README.md)

---

```
Agent Session ──Stop Hook──► Obsidian Vault ──MCP Tools──► Next Session
                                    │
                           ┌────────┼────────┐
                           │        │        │
                     Sessions  Decisions  Learnings
```

Wandle die Erkenntnisse jeder Session in eine **wachsende Wissensbasis** um, die deine Agenten automatisch lesen und schreiben.

---

## Warum ObMem?

Jede KI-Coding-Session beginnt bei Null. Der Bug, den du gestern gefixt hast? Vergessen. Die ADR von letzter Woche? Verloren. Das Pattern, das das knifflige Auth-Problem gelöst hat? Weg.

**ObMem persistiert das, was wichtig ist** — direkt in deinem Obsidian Vault.

- **Sessions** werden automatisch mit Dauer, Erfolgsrate und Effizienz-Score protokolliert
- **Architekturentscheidungen** werden mit Git-Traceability (`commit_hash`, `scope`) nachvollziehbar
- **Learnings & Patterns** entwickeln sich zu Skills, wenn sie ≥5 mal wiederverwendet werden
- **Konflikte** werden semantisch erkannt, bevor sie zuschlagen
- **Smart Search** nutzt hybrid Keyword + TF-IDF Scoring mit Relevance Boosting

---

## Was ist neu in v2.5

| Feature | Funktionsweise |
|---------|-------------|
| **Semantic Conflict Detection** 🔥 | NLP-Heuristiken erkennen widersprüchliche Learnings (Negation Pairs + Topic Overlap). Nie wieder "immer X verwenden / niemals X verwenden"-Chaos. |
| **Skill-Evolution** | Learnings mit `reuse_count >= 5` werden automatisch zu `OpenCode/Skills/{project}/` befördert. Bidirektionale Links verfolgen die Herkunft. |
| **Git-Traceability** | Jede ADR und jedes Learning speichert `scope: [betroffene-dateien]` und `commit_hash` für vollständige Nachverfolgbarkeit. |
| **Session-Analytics** | Automatisch berechnete `duration_minutes`, `success_rate` und `efficiency_score` in jedem Session-Log. |
| **`--semantic` Flag** | Reiner TF-IDF-Modus für `obmem related`. Schalte Keyword-Gewichtung aus für rein semantische Suche. |
| **244 Tests** | Vollständige Testabdeckung für Stemmer, Tokenizer, TF-IDF, Relevance Scoring und Hybrid Search. |

---

## Installation

### Via npm (empfohlen)

```bash
npm install -g obmem
```

Oder npx ohne Installation:

```bash
npx obmem session-log
npx obmem adr "Migration auf TypeScript strict mode"
```

### Via Git (für Entwicklung)

```bash
git clone https://github.com/Nemeson/OC-Obsidian-MCP.git
cd OC-Obsidian-MCP
npm test        # 244 Tests, zero dependencies
```

---

## Quick Start

### 1. Vault-Pfad setzen

```bash
# Linux/macOS
echo "OBSIDIAN_VAULT_PATH=/home/you/vault" > config/.mcp-env

# Windows (PowerShell)
Set-Content config/.mcp-env "OBSIDIAN_VAULT_PATH=C:\Users\You\vault"
```

### 2. Setup ausführen (einmalig)

```bash
npx obmem setup
```

Das erstellt die Ordnerstruktur in deinem Vault:
```
OpenCode/
├── Sessions/           # Automatisch protokollierte Session-Zusammenfassungen
├── Decisions/          # Architekturentscheidungen (ADRs)
├── Learnings/          # Wiederverwendbare Patterns & Lösungen
├── Skills/             # Automatisch beförderte Learnings (reuse_count >= 5)
├── Context/            # Session-Bootstrap-Notizen
└── _index.md           # Interaktives Projekt-Dashboard
```

### 3. Deine Agenten normal nutzen

Bei jedem Session-Ende wird eine Zusammenfassung an deine Daily Note angehängt. Führe `obmem gc` regelmäßig aus für:
- Beförderung reifer Learnings zu Skills
- Erkennung von Konflikten zwischen Learnings
- Bereinigung alter Sessions (Standard: 90 Tage)

---

## Sieh es in Aktion

### Ein Learning speichern

```bash
$ npx obmem remember "Zod Schema-Komposition für verschachtelte Configs"
✓ Gespeichert unter OpenCode/Learnings/zod-schema-composition.md
  Tags: #pattern #validation #typescript
```

Ergebnis in deinem Vault:
```yaml
---
type: learning
tags: [pattern, validation, typescript]
date: 2026-05-14
scope: []
commit_hash: 34cc505
---

# Zod Schema-Komposition für verschachtelte Configs

Nutze `.merge()` oder `.extend()`, um Basis-Schemas zu komponieren, statt Felder zu duplizieren.
```

### Eine Architekturentscheidung tracken

```bash
$ npx obmem adr "Redis statt Memcached für Session-Speicher"
✓ Gespeichert unter OpenCode/Decisions/ADR-007-redis-session-store.md
  Tags: #architecture #caching #redis
```

### Deinen Vault durchsuchen

```bash
$ npx obmem related "auth middleware" --max 3
🔍 3 passende Notizen gefunden:

  1. learning:jwt-caching-pattern.md     (Score: 0,87)
  2. decision:ADR-003-session-store.md   (Score: 0,71)
  3. session:2026-05-14.md               (Score: 0,65)
```

### Konflikte erkennen

```bash
$ npx obmem gc --project my-api
🗑️  2 veraltete Sessions bereinigt
🧠 1 Learning zu Skill befördert: zod-schema-composition.md
⚠️  Konflikt erkannt:
    learning:use-pnpm.md  ↔  learning:use-npm-only.md
    Typ: negation_pair | Schwere: hoch
```

### Semantische Suche

```bash
$ npx obmem related "error handling best practices" --semantic --project PCAP2KML --max 5
🔍 Semantische Ergebnisse (reiner TF-IDF):

  1. learning:try-catch-patterns.md       (Score: 0,92)
  2. decision:ADR-005-error-strategy.md    (Score: 0,84)
```

| Modus | Befehl | Wann verwenden |
|-------|--------|---------------|
| **Hybrid (Standard)** | `obmem related "auth"` | Schnell, Keyword-basiert mit Relevance Boosting |
| **Semantisch** | `obmem related "auth" --semantic` | Tiefe Ähnlichkeit via TF-IDF — ideal für vage Beschreibungen |
| **Hybrid + Projekt** | `obmem related "auth" --project PCAP2KML` | Auf ein Projekt eingrenzt, weiterhin hybrid |
| **Semantisch + Projekt** | `obmem related "auth" --semantic --project PCAP2KML` | Auf Projekt eingrenzte semantische Suche, ignoriert Keywords außerhalb |

---

## CLI-Befehle

| Befehl | Beispiel | Zweck |
|---------|---------|---------|
| `obmem session-log` | `npx obmem session-log` | Session manuell protokollieren |
| `obmem adr <titel>` | `npx obmem adr "Zod statt Joi"` | Architekturentscheidung speichern |
| `obmem remember <titel>` | `npx obmem remember "JWT Caching Pattern"` | Learning/Pattern speichern |
| `obmem related <query>` | `npx obmem related "auth" --max 5` | Hybride Suche über alle Notizen |
| `obmem related -s <q>` | `npx obmem related "error handling" --semantic` | Reine TF-IDF semantische Suche |
| `obmem digest` | `npx obmem digest --project my-api` | Wöchentlichen Digest generieren |
| `obmem gc` | `npx obmem gc --project my-api` | Garbage Collection + Skill-Evolution + Konflikterkennung |
| `obmem reflect` | `npx obmem reflect` | Täglicher Reflexions-Prompt |
| `obmem goal` | `npx obmem goal` | Wöchentlicher Zielplaner |
| `obmem update` | `npx obmem update` | Auf neueste Version updaten |
| `obmem setup` | `npx obmem setup` | Interaktives Erst-Setup |

**Umgebungsvariablen:**
- `OBSIDIAN_VAULT_PATH` — Pfad zu deinem Obsidian Vault Root
- `DRY_RUN=true` — GC-Änderungen anzeigen, ohne Dateien zu modifizieren

---

## So funktioniert es

### Automatische Session-Protokollierung

Wenn deine Agent-Session endet, hängt ObMem eine strukturierte Zusammenfassung an deine Daily Note an:

```markdown
## Session Log — 14.05.2026

- **Projekt:** my-api
- **Dauer:** 45m
- **Ziel:** Auth-Middleware auf Zod umstellen
- **Wichtige Entscheidungen:** 2
- **Learnings:** 1
- **Status:** ✅ Abgeschlossen
- **Effizienz-Score:** 8,4/10
```

### Architekturentscheidungen mit Git-Traceability

```bash
npx obmem adr "Redis statt Memcached für Session-Speicher"
```

Erstellt `OpenCode/Decisions/ADR-007-redis-session-store.md`:
```yaml
---
type: decision
tags: [architecture, caching, redis]
scope: [src/session.js, src/cache/redis.js]
commit_hash: a1b2c3d
---
```

### Learnings, die sich zu Skills entwickeln

```bash
npx obmem remember "Zod Schema-Komposition für verschachtelte Configs"
```

Nach 5 Wiederverwendungen (via `reuse_count`) wird dieses Learning automatisch befördert zu:
```
OpenCode/Skills/my-api/
└── zod-schema-composition.md
```

...mit bidirektionalen Links (`evolved_from`, `evolved_into`) zum Original.

### Semantische Konflikterkennung

Zwei widersprüchliche Learnings? ObMem markiert sie während der GC:

```yaml
conflict_detected: true
conflict_with: ["use-pnpm-over-npm.md"]
conflict_type: negation_pair
conflict_severity: high
```

Nie mehr "immer X verwenden" / "niemals X verwenden", die unbemerkt in deinem Vault herumgeistern.

---

## ObMem vs. Alternativen

| | **ObMem** | Continuum | mem0 | Supermemory |
|---|:---:|:---:|:---:|:---:|
| **Speicher** | Dein Obsidian Vault | Externe DB | Externe API | Externer Dienst |
| **Offline** | ✅ Ja | ❌ Nein | ❌ Nein | ❌ Nein |
| **Zero deps** | ✅ Ja | ❌ Benötigt DB | ❌ Benötigt SDK | ❌ Benötigt API-Key |
| **Dateneigentum** | ✅ Du besitzt alles | ⚠️ Cloud-hosted | ⚠️ Externe API | ⚠️ Externer Dienst |
| **Semantische Konflikterkennung** | ✅ Eingebaut | ❌ Nein | ❌ Nein | ❌ Nein |
| **Skill-Evolution** | ✅ Auto-Beförderung | ❌ Nein | ❌ Nein | ❌ Nein |
| **Git-Traceability** | ✅ Eingebaut | ❌ Nein | ❌ Nein | ❌ Nein |
| **Agent-agnostisch** | ✅ MCP-Standard | ⚠️ Spezifische Clients | ⚠️ Spezifische Clients | ⚠️ Spezifische Clients |

**Fazit:** Wenn du bereits Obsidian nutzt und möchtest, dass deine Agenten sich merken, ohne Vendor Lock-in — dann ist ObMem die reibungsloseste Wahl.

---

## Roadmap

| Version | Fokus | ETA |
|---------|-------|-----|
| **v2.6** | Web-Dashboard (read-only, kein Backend) | Q3 2026 |
| **v2.7** | Multi-Vault-Sync (Arbeit + Privat) | Q4 2026 |
| **v3.0** | WASM-basierte Vectorsuche (weiterhin zero npm deps) | Q1 2027 |
| **v3.x** | Plugin-Ökosystem (custom Konflikterkenner, Skill-Pipelines) | 2027 |

Möchtest du über Prioritäten abstimmen? [Eröffne ein Issue](https://github.com/Nemeson/OC-Obsidian-MCP/issues) oder schreib mir auf [X](https://x.com/NemesonOne).

---

## FAQ

### Wie unterscheidet sich das von MCP Memory oder anderen Memory-Servern?

Andere Memory-Server speichern deine Daten in externen Datenbanken oder APIs. ObMem schreibt direkt in dein Obsidian Vault — Markdown-Dateien, die dir gehören, mit Git versionierbar, und durchsuchbar mit jedem Tool (inklusive Obsidians eingebauter Suche).

### Muss ich einen Server betreiben?

Nein. ObMem ist CLI-Tool + MCP-Server. Die CLI schreibt direkt in dein Vault. Der MCP-Server stellt dieselben Operationen nur für deinen Agent-Client bereit.

### Geht das auch ohne Obsidian?

Technisch ja — ObMem schreibt Standard-Markdown mit YAML-Frontmatter. Aber die Ordnerstruktur und das `_index.md`-Dashboard sind für Obsidian optimiert. Wenn du ein anderes Markdown-Tool nutzt (Logseq, Dendron), funktionieren die meisten Features trotzdem.

### Was passiert mit meinen Daten, wenn ich deinstalliere?

Nichts. Deine Daten sind in deinem Vault. Deinstallieren von ObMem stoppt nur die automatische Protokollierung — deine Notizen bleiben.

### Wie funktioniert die Konflikterkennung?

Während der Garbage Collection scannt ObMem alle Learning-Notizen paarweise. Es erkennt:
- **Negation Pairs**: "immer X verwenden" vs "niemals X verwenden"
- **Topic Overlap**: Zwei Notizen zum gleichen Thema mit widersprüchlichen Empfehlungen
- **Severity Scoring**: Basierend darauf, wie zentral der Widerspruch für jede Notiz ist

### Kann ich den Threshold für Skill-Evolution anpassen?

Noch nicht (hardcoded bei `reuse_count >= 5`). In v2.6 wird das konfigurierbar sein. Bis dahin kannst du ein Learning manuell befördern, indem du es nach `OpenCode/Skills/{project}/` kopierst.

### Funktioniert das mit Claude Code / OpenCode / Codex?

Ja. ObMem implementiert den [Model Context Protocol (MCP)](https://modelcontextprotocol.io) Standard. Jeder Client, der MCP-Tools unterstützt, kann dein Vault lesen und schreiben.

---

## Konfiguration

Erstelle `config/.mcp-env`:

```bash
# Erforderlich
OBSIDIAN_VAULT_PATH=/pfad/zu/deinem/vault

# Optional
DRY_RUN=false          # Auf true setzen, um GC-Änderungen zu simulieren
```

Oder setze vor jedem Befehl via Umgebung:
```bash
OBSIDIAN_VAULT_PATH=/home/you/vault npx obmem gc
```

---

## Getestet

```bash
npm test
# 244 passed, 0 failed
```

Zero Runtime Dependencies. Node 20+ erforderlich.

---

## Buy Me a Coffee ☕

ObMem wird von einem Solo-Entwickler gepflegt, der glaubt, dass Agenten sich merken sollten, was du ihnen beibringst.

Wenn dir das erspart, denselben Bug zweimal zu erklären:

**[buymeacoffee.com/Nemeson](https://buymeacoffee.com/Nemeson)**

---

## Lizenz

MIT © [Nemeson](https://github.com/Nemeson)
