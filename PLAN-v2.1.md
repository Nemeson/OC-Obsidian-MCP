# OC-Obsidian-MCP v2.1: Smart Retrieval — Implementation Plan

> Status: Draft | Target: v2.1.0 | Date: 2026-05-14

---

## Context

oc-obsidian-mcp v2.0.0 is stable with:
- 7 CLI commands (`adr`, `remember`, `related`, `digest`, `session-log`, `load-context`, `gc`)
- 151 passing tests
- Project isolation via `Sessions/{project}/`, `Decisions/`, `Learnings/`
- Keyword-only `related` search with basic scoring

This plan extends the tool with **semantic similarity**, **auto-tagging**, and **relevance-aware ranking** — all without adding npm dependencies.

---

## Design Principles

1. **Zero new dependencies** — built-in Node.js only (no `npm install` required)
2. **Add-only migration** — existing notes keep working, new features are opt-in
3. **Offline-first** — no API keys, no network calls
4. **Fast at runtime** — TF-IDF index + score caching, not a full search engine
5. **Pluggable embedding slot** — TF-IDF today, ONNX model tomorrow

---

## Feature 1: Hybrid Search (TF-IDF Fallback)

### Problem
Current `related` uses only keyword overlap. It misses semantically similar content (e.g. "memory leak" vs "heap overflow").

### Solution: TF-IDF "Light" Semantic Layer

A simplified TF-IDF vector space built from the vault's content:

1. **Tokenization** — Split each note title + body into stemmed words (Porter-ish: strip `ing`, `ed`, `s`)
2. **Term Frequency** — How often a term appears in a document
3. **Inverse Document Frequency** — Rarer terms = more important
4. **Cosine Similarity** — Between query vector and document vectors

This gives us a **similarity score** that complements keyword matching.

### Hybrid Score Formula

```
score = 0.40 * keyword_match  
      + 0.30 * tfidf_similarity
      + 0.15 * recency_boost     (newer = higher)
      + 0.15 * reuse_boost       (higher reuse_count = higher)
      - 0.10 * too_old_penalty  (>90 days)
```

> Weights can be tuned later. Sum is normalized to 0-1.

### Files Changed

| File | Change |
|---|---|
| `lib/tfidf.js` | **NEW** — TF-IDF index: build, query, cosineSimilarity |
| `lib/stemmer.js` | **NEW** — Simple English stemmer (strip s/es/ing/ed), 50 lines |
| `bin/related.js` | Use `lib/tfidf.js` in `findRelatedNotes()`, replace old score |
| `bin/oc-obsidian-mcp.js` | Add `--semantic` flag to `related` command |
| `test/related.test.js` | **NEW** — test hybrid scoring, edge cases |

### TF-IDF Index Lifecycle

1. **On-demand rebuild** — `related` runs → check if `.cache/tfidf.json` older than 5 min → rebuild
2. **Incremental** — `remember` / `adr` create new note → append to index, don't rebuild
3. **Format** — `{ terms: ["tok1", "tok2"], vectors: { "file.md": [0.12, 0.56...] }, idf: {...} }`

This is stored in `vault/OpenCode/.cache/` so it sits inside the vault and survives reinstalls.

### Performance Budget
- Rebuild: ~50ms for 100 notes, ~300ms for 1000 notes
- Query: ~5ms per query (cosine sim against N vectors)
- Target: keep rebuild under 100ms for typical vault (<500 notes)

---

## Feature 2: Auto-Tagging

### Problem
Users often don't manually tag learnings. `/remember` creates notes without tags, making discovery harder.

### Solution: Two-Tier Tagging

| Tier | Tags | Source |
|---|---|---|
| **Fixed vocabulary** | `#bug`, `#pattern`, `#config`, `#api`, `#testing`, `#architecture`, `#security`, `#performance` | Regex/keyword matches in title + body |
| **Free-form** | Any `#token` already present in the note's text | Extracted inline (user already wrote them) |
| **Type** | `bugfix`, `pattern`, `code-snippet`, `architecture`, `testing` | Existing `detectType()` in `remember.js` |

### Detection Rules

```js
const FIXED = {
  '#bug':      /bug|fix|error|issue|crash|leak|exception|broken/,
  '#pattern':  /pattern|technique|approach|idiom|reusable/,
  '#config':   /config|setting|env|yaml|json|ini|dockerfile/,
  '#api':      /api|endpoint|rest|graphql|route|controller/,
  '#testing':  /test|spec|jest|mocha|pytest|coverage/,
  '#architecture': /architecture|design|struct|layer|component/,
  '#security': /security|auth|oauth|jwt|csrf|xss|injection/,
  '#performance': /performance|slow|fast|cache|optimize|memory/,
};
```

### Files Changed

| File | Change |
|---|---|
| `lib/tags.js` | **NEW** — `detectTags(title, body)` → `{ fixed: [...], free: [...], all: [...] }` |
| `bin/remember.js` | Call `detectTags()`, append tags to frontmatter |
| `bin/adr.js` | Add `#architecture` + project tag automatically |
| `test/tags.test.js` | **NEW** — test detection rules, dedup, edge cases |

### Frontmatter Format

```yaml
---
learning_type: Bugfix
tags: ['#bug', '#performance']
importance: high
reuse_count: 1
last_used: 2026-05-14
---
```

> `tags` is new. All other fields existed. `reuse_count` initialized to 1 on creation.

---

## Feature 3: Relevance Scoring

### Problem
Notes accumulate over time. Older, less-used notes should rank lower than fresh, frequently-used ones.

### Solution: Track + Boost Reuse

**Track reads:**
When `/related` or `/digest` returns a note → increment its `reuse_count`, update `last_used`.

**Track explicit references:**
When a user says "use pattern X" (detected in session context) → not yet, requires NLP. Skip for v2.1.

### Score Boost Formula

```js
function computeRelevanceBoost(note) {
  const daysOld = (Date.now() - parseDate(note.last_used)) / 86400000;
  const recency = Math.max(0, 1 - daysOld / 90);        // 1.0 → 0.0 over 90 days
  const reuse = Math.min(1, (note.reuse_count || 0) / 20); // 0 → 1, cap at 20
  return 0.5 * recency + 0.5 * reuse;  // range 0-1
}
```

This feeds directly into the Hybrid Score (see Feature 1).

### Files Changed

| File | Change |
|---|---|
| `lib/relevance.js` | **NEW** — `computeRelevanceBoost()`, `trackUsage(filePath)` |
| `bin/related.js` | Call `trackUsage()` on returned notes to update counts |
| `bin/remember.js` | Initialize `reuse_count: 1`, `last_used: today` |
| `test/relevance.test.js` | **NEW** — test boost math, decay, tracking |

---

## Feature 4: Related Notes v2.1 (Integration)

### Changes to `bin/related.js`

Current scoring: only keyword overlap (title=3, content=1, recency bonus).

New scoring: uses the 4-component hybrid formula.

### CLI Changes

```bash
oc-obsidian-mcp related "auth pattern" --project PCAP2KML --limit 10
# → now includes: Similarity score breakdown per result
# ├─ "auth" keyword match: 0.30
# ├─ TF-IDF similarity: 0.25
# ├─ Recency boost: 0.10
# └─ Reuse boost: 0.05
#   ──> Hybrid Score: 0.70
```

### Output Format

```
🔍 Related notes for: "auth pattern"

1. (0.83) JWT Authentication Pattern
   ├─ 📋 Decision  ·  PCAP2KML
   ├─ #security, #api, #pattern
   ├─ Last used: today  ·  Reused: 5×
   └─ ──────────────────
```

### Backward Compatibility

- Old notes without `reuse_count`/`last_used` → default `reuse_count=0`, `last_used=creation date` (file mtime)
- Old notes without `tags` → tags inferred from title/body during indexing
- No new CLI flags are required (`--semantic` is opt-in)

---

## Test Plan

| Test File | Coverage |
|---|---|
| `test/tfidf.test.js` | Tokenizer, stemmer, TF-IDF vector build, cosine similarity, edge cases (empty docs, docs with no overlap, identical docs) |
| `test/tags.test.js` | Fixed tag detection, free tag extraction, dedup, unknown text returns empty, collision (free+fixed) |
| `test/relevance.test.js` | Recency decay curve, reuse boost cap, trackUsage writes to file, backward compat for missing fields |
| `test/related.test.js` | Hybrid score > keyword-only score, ranking order, limit works, project filtering, --semantic flag |

### Test Count Target
- New tests: ~40-50
- Total target: 190-200 tests
- Test runner: `test/runner.js` (custom, no Mocha/Jest)

---

## File Tree Changes

```
oc-obsidian-mcp/
├── bin/
│   ├── oc-obsidian-mcp.js    (+ --semantic flag)
│   ├── related.js            (hybrid scoring)
│   ├── remember.js           (+ auto-tags init)
│   └── adr.js                (+ auto-tags init)
├── lib/                      [NEW DIRECTORY]
│   ├── tfidf.js              (TF-IDF index)
│   ├── stemmer.js            (simple stemmer)
│   ├── tags.js               (auto-tag detection)
│   └── relevance.js          (relevance scoring)
├── test/
│   ├── runner.js
│   ├── tfidf.test.js         [NEW]
│   ├── tags.test.js          [NEW]
│   ├── relevance.test.js     [NEW]
│   └── related.test.js       [NEW]
└── PLAN-v2.1.md              (this file)
```

---

## Performance Budget

| Operation | Target |
|---|---|
| TF-IDF index rebuild (500 notes) | < 100ms |
| Single query (all notes) | < 10ms |
| `related` end-to-end | < 200ms |
| `/remember` with tag detection | < 50ms extra |

---

## Migration Notes

- **For developers**: Nothing. `npm test` still works with `test/runner.js`.
- **For users**: Nothing. Existing vault notes keep working. New notes get auto-tagged. TF-IDF cache is created on first `related` call.
- **Cache invalidation**: `.cache/tfidf.json` uses 5-min TTL. Manual delete forces rebuild.

---

## Implementation Order

1. `lib/stemmer.js` → foundation, no deps
2. `lib/tags.js` + `test/tags.test.js` → independent
3. `lib/tfidf.js` + `test/tfidf.test.js` → uses stemmer
4. `lib/relevance.js` + `test/relevance.test.js` → independent
5. Update `bin/remember.js` → wire tags + relevance init
6. Update `bin/adr.js` → wire tags init
7. Update `bin/related.js` → wire hybrid scoring
8. `test/related.test.js` → integration
9. `bin/oc-obsidian-mcp.js` → add `--semantic`
10. Final test run → target 190+ green

---

## Acceptance Criteria

- [ ] All 151 existing tests pass
- [ ] 40+ new tests pass
- [ ] `related` now shows hybrid scores with breakdown
- [ ] `remember` creates notes with auto-detected tags
- [ ] No new npm dependencies added
- [ ] Works offline (no API calls)
- [ ] Existing notes work without modification

---

*Plan generated by Sisyphus for oc-obsidian-mcp v2.1.0*
