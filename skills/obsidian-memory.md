# Obsidian Memory Skill v2.0

Intelligenter, projekt-isolierter, bidirektionaler Speicher für OpenCode / Claude Code / Codex CLI Agent-Sessions — basierend auf Hermes-Agent-Architektur.

## Requirements

- Node.js v20+
- Obsidian Vault (lokal)
- `mcp-obsidian-vault` (via npx)

## Vault Folder Structure (projekt-isoliert)

```
MyVault/
└── OpenCode/
    ├── Sessions/
    │   ├── PCAP2KML/          ← Sessions nur für dieses Projekt
    │   │   ├── 2026-05-12.md
    │   │   └── index.md       ← laufende Zusammenfassung
    │   ├── HomeAssistant/
    │   └── _global/           ← fallback wenn Projekt unbekannt
    ├── Decisions/
    │   └── PCAP2KML/          ← ADRs pro Projekt
    │       └── ADR-001-title.md
    ├── Learnings/
    │   └── PCAP2KML/          ← Patterns pro Projekt
    ├── Context/
    │   ├── _bootstrap.md      ← globale Agent-Anweisungen
    │   └── PCAP2KML/          ← Projekt-Kontext
    │       └── context.md
    └── Archive/
        ├── Sessions/          ← archiviert >30 Tage
        └── Learnings/         ← archivierte Learnings
```

## Commands

### `oc-obsidian-mcp adr "Titel"` — Architecture Decision Record

```
/adr "Redis als Cache-Layer für API-Responses" --project MyApp --status accepted
```

Erstellt automatisch:
- ADR-NNN-Nummerierung
- Status (Vorgeschlagen/Akzeptiert/Verworfen)
- Kontext, Entscheidung, Alternativen, Konsequenzen
- Auto-verknüpfte Related Notes via Keyword-Overlap

### `oc-obsidian-mcp remember "Titel"` — Learning speichern

```
/remember "Memory leak in React useEffect cleanup" --type Bugfix
/remember "Kafka Consumer Group pattern" --type Pattern --code "const consumer = kafka.consumer({ groupId: 'my-group' })"
```

- Auto-Typ-Erkennung (Bugfix, Pattern, Code-Snippet, Architektur, Testing)
- Auto-Importance-Detection (#high, #medium, #low)
- Duplikat-Check vor Speicherung
- Related Notes Verlinkung

### `oc-obsidian-mcp related "query"` — Verwandte Notizen finden

```
/related "auth pattern"
/related "JWT authentication" --project MyApp --limit 10
```

Durchsucht Decisions, Learnings und Sessions projekt-übergreifend mit:
- Keyword-Matching + Title-Boost
- Recency-Bonus (neuere Notes ranken höher)
- Relevanz-Snippets

### `oc-obsidian-mcp digest` — Weekly/Monthly Digest

```
/digest --project PCAP2KML --week
/digest --project PCAP2KML --month
/digest --project PCAP2KML --from 2026-05-01 --to 2026-05-12
```

Generiert strukturierten Markdown-Digest mit:
- Session-Anzahl und Zeichenstatistik
- Tool-Nutzungs-Übersicht
- Session-Details (Datum, Tasks)
- Neue Learnings mit Typ und Relevanz

### `oc-obsidian-mcp session-log` — Manueller Session-Log

```
/session-log
```

Liest neueste Session-Datei, extrahiert ECC:SUMMARY, speichert projekt-isoliert.

### `oc-obsidian-mcp load-context` — Kontext laden

```
/load-context --project PCAP2KML
```

Lädt bei Session-Start:
1. `OpenCode/Context/_bootstrap.md`
2. Projekt-Kontext (`OpenCode/Context/{project}/`)
3. Letzte 5 ADRs
4. Top-10 Learnings (nach Relevanz)
5. Letzte 3 Sessions

Formatiert als `🧠 Obsidian Context for {project}`-Block.

### `oc-obsidian-mcp gc` — Garbage Collection

```
/gc --dry-run                    # Preview was gelöscht würde
/gc --project PCAP2KML           # Nur ein Projekt
```

Regeln:
- Sessions >30 Tage → Archive
- Learnings `#low` >60d → Löschen
- Learnings `#medium` >180d → Archivieren
- Learnings `#high` → Nie löschen
- Duplikate >80% Similarity → Mergen

### `oc-obsidian-mcp setup` — Setup

```
/setup
```

Interaktives Setup (PowerShell).

## Automation

### Stop Hook (Claude Code)

Nach jeder Session wird automatisch:
1. Session-Summary gespeichert (projekt-isoliert)
2. Neue Learnings aus der Session extrahiert (Bugs, Patterns, Tools)
3. Projekt-Index aktualisiert
4. GC getriggert (1x pro Tag)

### Auto-Learning (passiv)

Der Hook analysiert jede Session auf:
- Bugfixes → `"Typ: Bugfix"` Learning
- Refactorings → `"Typ: Pattern"` Learning
- Neue Tools/Libraries → `"Typ: Code-Snippet"` Learning

Keine manuelle `/remember` Eingabe nötig für Routine-Erkenntnisse.

## MCP Tools (mcp-obsidian-vault)

| Tool | Beschreibung |
|---|---|
| `read_note(path)` | Note lesen |
| `write_note(path, content)` | Note erstellen |
| `append_note(path, content)` | An Note anhängen |
| `search_notes(query)` | Volltextsuche |
| `list_notes(path)` | Ordner auflisten |
| `delete_note(path)` | Note löschen |
| `read_daily_note(date)` | Daily Note lesen |
| `append_daily_note(content)` | An Daily Note anhängen |
| `git_sync(action)` | Git Sync |

## CLI (npm scripts)

```bash
npm test              # 151 Tests
npm run session-log   # Manueller Session-Log
npm run adr -- "Titel"
npm run remember -- "Titel"
npm run related -- "query"
npm run digest -- --week
npm run load-context
npm run gc -- --dry-run
npm run setup
```

## Roadmap

**v2.5 (Agent Autonomy):** Embedding-Suche, Auto-Tagging, Relevanz-Scoring, Konflikt-Erkennung, Skill-Evolution
**v3.0 (Multi-Agent):** Agent-Profile, Handoff-Notes, Team-Learnings, Performance-Tracking
**v4.0 (Ecosystem):** Obsidian-Dashboard, Linear/Jira-Sync, Chrome Extension, Mobile Companion

Siehe `OpenCode/Decisions/ADR-001-intelligent-obsidian-memory-architecture.md` für die vollständige Architektur-Entscheidung.
