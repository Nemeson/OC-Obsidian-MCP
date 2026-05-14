# Changelog

## v2.1.0 — Smart Retrieval (2026-05-14)

### Features
- **Hybrid Search**: `related` now uses TF-IDF + keyword + recency + reuse scoring
- **Auto-Tagging**: `/remember` and `/adr` auto-detect `#bug`, `#pattern`, `#api`, etc.
- **Relevance Tracking**: `reuse_count` and `last_used` frontmatter fields
- **TF-IDF Cache**: Lightweight semantic index cached in `OpenCode/.cache/`
- **`--semantic` flag**: Opt-in TF-IDF enhancement for `related`

### Files Added
- `lib/stemmer.js` — English word stemmer
- `lib/tags.js` — Auto-tag detection
- `lib/relevance.js` — Relevance scoring
- `lib/tfidf.js` — TF-IDF search engine
- `PLAN-v2.1.md` — Architecture plan

### Stats
- 211 tests (was 151) — all green
- Zero new npm dependencies
- Backward compatible with v2.0 notes

## v2.0.0 — Initial Release

- Auto session logging
- Architecture decisions (/adr)
- Learnings/patterns (/remember)
- Related notes (/related)
- Digest (/digest)
- Context loading (/load-context)
- Garbage collection (/gc)
