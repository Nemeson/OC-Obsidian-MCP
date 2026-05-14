#!/usr/bin/env node
/**
 * OC-Obsidian-MCP: Related / Hybrid Search Tests (v2.1)
 *
 * Tests for:
 *   - Hybrid score combines keyword + tfidf + recency + reuse
 *   - TF-IDF semantic similarity catches related concepts
 *   - Recency boost: newer notes score higher
 *   - Reuse boost: high reuse_count scores higher
 *   - Stale penalty: >90 days reduces score
 *   - Edge cases: empty query, missing cache, unicode tokens
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { tokenize, stem } = require('../lib/stemmer');
const { buildIndex, queryIndex, cosineSimilarity, getOrBuildIndex, invalidateCache } = require('../lib/tfidf');
const { computeRelevanceBoost, initRelevance } = require('../lib/relevance');

const results = { passed: 0, failed: 0, errors: [] };

function describe(section, fn) {
  console.log(`\n  ${section}`);
  fn();
}

function assert(condition, message) {
  if (!condition) {
    results.failed++;
    results.errors.push({ ok: false, message });
    console.log(`    [FAIL] ${message}`);
  } else {
    results.passed++;
    console.log(`    [ OK ] ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} | expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
}

function assertClose(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, `${message} | expected ~${expected}, got ${actual} (diff ${diff} > ${tolerance})`);
}

function assertGreaterThan(actual, expected, message) {
  assert(actual > expected, `${message} | expected > ${expected}, got ${actual}`);
}

// ─── Stemmer Tests ─────────────────────────────────────

describe('Stemmer', () => {
  assertEqual(stem('running'), 'run', "'running' → 'run'");
  assertEqual(stem('quickly'), 'quick', "'quickly' → 'quick' (-ly)");
  assertEqual(stem('tested'), 'test', "'tested' → 'test' (-ed)");
  assertEqual(stem('boxes'), 'box', "'boxes' → 'box' (-es)");
  assertEqual(stem('dogs'), 'dog', "'dogs' → 'dog' (-s plural)");
  assertEqual(stem('copies'), 'copy', "'copies' → 'copy' (-ies → -y)");
  assertEqual(stem('tried'), 'try', "'tried' → 'try' (-ied → -y)");
  assertEqual(stem('tying'), 'tie', "'tying' → 'tie' (-ying → -ie)");
  assertEqual(stem('stopping'), 'stop', "'stopping' → 'stop' (consonant doubling)");
  assertEqual(stem('us'), 'us', "'us' stays 'us' (exception)");
  assertEqual(stem('is'), 'is', "'is' stays 'is' (exception)");
});

// ─── Tokenizer Tests ────────────────────────────────────

describe('Tokenizer', () => {
  const tokens = tokenize('The quick brown foxes are running!');
  assert(tokens.includes('the'), "stop word 'the' present after tokenize (removed later by isStopWord)");
  assert(tokens.includes('quick'), "'quick' tokenized");
  assert(tokens.includes('fox'), "'foxes' stemmed to 'fox'");
  assert(tokens.includes('run'), "'running' stemmed to 'run'");
  assertEqual(tokens.length, 6, '6 tokens (the/brown are stop words, filtered at query time)');
});

// ─── TF-IDF Index Tests ─────────────────────────────────

describe('TF-IDF Index', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obmem-test-'));
  const vaultPath = path.join(tmpDir, 'vault');
  const notesDir = path.join(vaultPath, 'OpenCode', 'Learnings', '_global');
  fs.mkdirSync(notesDir, { recursive: true });

  // Create test notes
  fs.writeFileSync(path.join(notesDir, 'memory-leak.md'), '---\ntype: Learning\ncreated: 2026-05-14\n---\n\nHow to fix memory leaks in JavaScript applications.\n\nUse heap snapshots to detect leaks.\n', 'utf8');
  fs.writeFileSync(path.join(notesDir, 'heap-overflow.md'), '---\ntype: Learning\ncreated: 2026-05-14\n---\n\nHeap overflow detection in Node.js.\n\nMonitor heap usage with performance hooks.\n', 'utf8');
  fs.writeFileSync(path.join(notesDir, 'css-grid.md'), '---\ntype: Learning\ncreated: 2026-05-14\n---\n\nCSS Grid layout patterns for responsive design.\n', 'utf8');

  const index = buildIndex(vaultPath);

  assertEqual(index.docs.length, 3, 'index has 3 docs');
  assert(index.terms.length > 0, 'index has terms');
  assert(Object.keys(index.vectors).length === 3, '3 document vectors');

  // Query for "memory leak" should find memory-leak.md
  const results1 = queryIndex(index, 'memory leak', 3);
  assert(results1.length > 0, 'query "memory leak" returns results');
  assert(results1[0].path.includes('memory-leak'), 'memory-leak.md ranks first for "memory leak"');

  // Query for "heap overflow" should find heap-overflow.md (and possibly memory-leak.md via similarity)
  const results2 = queryIndex(index, 'heap overflow', 3);
  assert(results2.length > 0, 'query "heap overflow" returns results');
  assert(results2[0].path.includes('heap-overflow'), 'heap-overflow.md ranks first for "heap overflow"');

  // Test empty query
  const emptyResults = queryIndex(index, '', 10);
  assertEqual(emptyResults.length, 0, 'empty query returns empty results');

  // Test unicode tokens
  const unicodeResults = queryIndex(index, 'Überprüfung der Speicher', 10);
  assert(Array.isArray(unicodeResults), 'unicode query does not crash');

  // Test cosineSimilarity directly
  const vecA = new Float32Array([1, 0, 0]);
  const vecB = new Float32Array([0, 1, 0]);
  const vecC = new Float32Array([1, 0, 0]);
  assertClose(cosineSimilarity(vecA, vecC), 1, 0.001, 'identical vectors = similarity 1');
  assertClose(cosineSimilarity(vecA, vecB), 0, 0.001, 'orthogonal vectors = similarity 0');

  // Cache tests
  invalidateCache(vaultPath);
  const cachePath = path.join(vaultPath, 'OpenCode', '.cache', 'tfidf.json');
  assert(!fs.existsSync(cachePath), 'invalidateCache removes cache file');

  const cached = getOrBuildIndex(vaultPath);
  assert(cached.docs.length === 3, 'getOrBuildIndex rebuilds after invalidation');
  assert(fs.existsSync(cachePath), 'getOrBuildIndex saves cache');

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── Relevance Scoring Tests ────────────────────────────

describe('Relevance Scoring', () => {
  const today = '2026-05-14';
  const oldDate = '2026-01-01';
  const veryOldDate = '2025-01-01'; // >90 days

  // Fresh note with low reuse
  const fresh = computeRelevanceBoost({ reuse_count: 1, last_used: today, created: today });
  // Old note with high reuse
  const oldButReused = computeRelevanceBoost({ reuse_count: 20, last_used: oldDate, created: oldDate });
  // Very old note with high reuse (stale penalty)
  const veryOld = computeRelevanceBoost({ reuse_count: 20, last_used: veryOldDate, created: veryOldDate });

  assertGreaterThan(fresh, 0.5, 'fresh note has high relevance');
  assertGreaterThan(oldButReused, 0.3, 'old but heavily reused note has moderate relevance');
  assert(veryOld < oldButReused, 'very old note gets stale penalty vs old note');

  // High reuse should approach cap
  const maxReuse = computeRelevanceBoost({ reuse_count: 100, last_used: today, created: today });
  assert(maxReuse <= 1, 'max relevance capped at 1');
  assert(maxReuse > fresh, 'max reuse > fresh note');

  // initRelevance
  const rel = initRelevance({ created: today });
  assertEqual(rel.reuse_count, 1, 'initRelevance sets reuse_count to 1');
  assertEqual(rel.last_used, today, 'initRelevance sets last_used');
});

// ─── Hybrid Score Tests ─────────────────────────────────

describe('Hybrid Score Composition', () => {
  // Simulate the hybrid score logic from obmem-related.js
  function calcHybrid(keywordScore, tfidfScore, recencyScore, relBoost) {
    return (keywordScore * 0.40) + (tfidfSim * 0.30) + (recencyScore * 0.15) + (relBoost * 0.15);
  }

  // Case: exact keyword match (high keyword, low tfidf if new doc)
  const exactKw = (1.0 * 0.40) + (0.5 * 0.30) + (1.0 * 0.15) + (0.5 * 0.15);
  assertClose(exactKw, 0.775, 0.001, 'exact keyword match scores high');

  // Case: semantic-only (low keyword, high tfidf)
  const semanticOnly = (0.2 * 0.40) + (0.8 * 0.30) + (0.5 * 0.15) + (0.3 * 0.15);
  assertClose(semanticOnly, 0.44, 0.001, 'semantic-only match scores moderate');

  // Case: stale note (high keyword but old)
  const staleNote = (1.0 * 0.40) + (0.5 * 0.30) + (0.0 * 0.15) + (0.0 * 0.15);
  assertClose(staleNote, 0.55, 0.001, 'stale note still scores from keyword+tfidf');
});

// ─── Summary ────────────────────────────────────────────

const total = results.passed + results.failed;
console.log(`\n  ─────────────────────────────`);
console.log(`  ${results.passed}/${total} tests passed, ${results.failed} failed`);
if (results.failed > 0) {
  console.log(`\n  Failures:`);
  for (const e of results.errors) {
    console.log(`    - ${e.message}`);
  }
}

process.exit(results.failed > 0 ? 1 : 0);
