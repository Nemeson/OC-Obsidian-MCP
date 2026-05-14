/**
 * OC-Obsidian-MCP: TF-IDF Search Engine (Lightweight)
 *
 * Builds a TF-IDF index from vault notes for semantic-ish similarity.
 * No dependencies — uses only Node.js built-ins.
 *
 * Lifecycle:
 *   1. buildIndex()    → scans vault, computes TF-IDF vectors
 *   2. cosineSimilarity → queries the index
 *   3. saveIndex / loadIndex → cache in vault/OpenCode/.cache/
 */

const fs = require('fs');
const path = require('path');
const { tokenize } = require('./stemmer');

const CACHE_DIR = 'OpenCode/.cache';
const CACHE_FILE = 'tfidf.json';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// ─── Helpers ────────────────────────────────────────────

function isStopWord(w) {
  const stops = new Set([
    'the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did',
    'will','would','could','should','may','might','must','can','shall',
    'i','you','he','she','it','we','they','me','him','her','us','them',
    'my','your','his','its','our','their','this','that','these','those',
    'and','but','or','nor','for','so','yet','as','at','by','in','of','on','to','with','from','up','about','into','through','during','before','after','above','below','between','under','over','again','further','then','once',
    'here','there','when','where','why','how','all','each','few','more','most','other','some','such','no','not','only','own','same','than','too','very','just','also','get','got','go','going','went','gone','come','came','coming','make','made','making','take','took','taking','see','saw','seen','know','knew','known','give','gave','given','given','think','thought','thought','say','said','said',
    'let','lets','use','used','using','add','added','adding','new','one','two','first','last','way','good','bad','old','high','low','long','little','big','great','small','large','next','early','young','important','same','right','left','public','private','able','back','well','still','own','say','out','many','then','them','than','only','other','which','their','time','if','would','there',
  ]);
  return stops.has(w);
}

function buildDocVector(tokens, idfMap, allTerms) {
  const tf = {};
  for (const t of tokens) { tf[t] = (tf[t] || 0) + 1; }
  const vec = new Float32Array(allTerms.length);
  let norm = 0;
  for (let i = 0; i < allTerms.length; i++) {
    const term = allTerms[i];
    const tfRaw = tf[term] || 0;
    if (tfRaw > 0) {
      const tfLog = 1 + Math.log(tfRaw);
      const idf = idfMap[term] || 0;
      vec[i] = tfLog * idf;
      norm += vec[i] * vec[i];
    }
  }
  if (norm > 0) {
    const scale = 1 / Math.sqrt(norm);
    for (let i = 0; i < vec.length; i++) vec[i] *= scale;
  }
  return vec;
}

function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // already unit vectors
}

// ─── Index Builder ──────────────────────────────────────

function buildIndex(vaultPath) {
  const docs = []; // { path, title, content, tokens }
  const termDocCount = {}; // term -> number of docs containing it

  // Scan Decisions, Learnings, Sessions (current + archive)
  const searchRoots = [
    { base: 'OpenCode/Decisions', label: 'Decision' },
    { base: 'OpenCode/Learnings', label: 'Learning' },
    { base: 'OpenCode/Sessions', label: 'Session' },
    { base: 'OpenCode/Archive/Sessions', label: 'Session' },
    { base: 'OpenCode/Archive/Learnings', label: 'Learning' },
  ];

  for (const { base } of searchRoots) {
    const baseDir = path.join(vaultPath, base);
    if (!fs.existsSync(baseDir)) continue;

    for (const projectDir of fs.readdirSync(baseDir)) {
      const projPath = path.join(baseDir, projectDir);
      if (!fs.statSync(projPath).isDirectory()) continue;

      for (const f of fs.readdirSync(projPath)) {
        if (!f.endsWith('.md') || f === 'index.md' || f.startsWith('.')) continue;
        const filePath = path.join(projPath, f);
        const content = fs.readFileSync(filePath, 'utf8');
        // Strip frontmatter
        const cleanContent = content.replace(/^---\n[\s\S]*?\n---\n?/, '');
        const title = f.replace('.md', '').replace(/-/g, ' ');
        const tokens = tokenize(title + ' ' + cleanContent).filter(t => !isStopWord(t));

        // Count unique terms in doc
        const unique = new Set(tokens);
        for (const t of unique) termDocCount[t] = (termDocCount[t] || 0) + 1;

        docs.push({ path: filePath, title, content: cleanContent, tokens, project: projectDir });
      }
    }
  }

  const N = docs.length;
  if (N === 0) return { terms: [], vectors: {}, idf: {}, docs: [], updated: Date.now() };

  // Compute IDF
  const idfMap = {};
  const allTerms = Object.keys(termDocCount).sort();
  for (const t of allTerms) {
    idfMap[t] = Math.log((N + 1) / (termDocCount[t] + 1)) + 1; // smoothed IDF
  }

  // Build vectors
  const vectors = {};
  for (const doc of docs) {
    vectors[doc.path] = buildDocVector(doc.tokens, idfMap, allTerms);
  }

  return {
    terms: allTerms,
    vectors,
    idf: idfMap,
    docs,
    updated: Date.now(),
  };
}

// ─── Query ──────────────────────────────────────────────

function queryIndex(index, queryText, topK = 10) {
  if (!index || !index.terms || index.terms.length === 0 || !index.docs.length) return [];

  const tokens = tokenize(queryText).filter(t => !isStopWord(t));
  if (tokens.length === 0) return [];

  const qVec = buildDocVector(tokens, index.idf, index.terms);

  const results = [];
  for (const doc of index.docs) {
    const dVec = index.vectors[doc.path];
    if (!dVec) continue;
    const sim = cosineSimilarity(qVec, dVec);
    if (sim > 0.001) {
      results.push({ path: doc.path, title: doc.title, project: doc.project, similarity: sim });
    }
  }

  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

// ─── Cache ────────────────────────────────────────────────

function getCachePath(vaultPath) {
  return path.join(vaultPath, CACHE_DIR, CACHE_FILE);
}

function saveIndex(vaultPath, index) {
  const cacheDir = path.join(vaultPath, CACHE_DIR);
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  // Convert Float32Array to regular array for JSON serialization
  const serializable = { ...index };
  serializable.vectors = {};
  for (const [k, v] of Object.entries(index.vectors)) {
    serializable.vectors[k] = Array.from(v);
  }

  fs.writeFileSync(getCachePath(vaultPath), JSON.stringify(serializable, null, 0), 'utf8');
}

function loadIndex(vaultPath, maxAgeMs = CACHE_MAX_AGE_MS) {
  const p = getCachePath(vaultPath);
  if (!fs.existsSync(p)) return null;
  try {
    const stat = fs.statSync(p);
    if (Date.now() - stat.mtimeMs > maxAgeMs) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    // Restore Float32Array
    if (raw.vectors) {
      for (const k of Object.keys(raw.vectors)) {
        raw.vectors[k] = new Float32Array(raw.vectors[k]);
      }
    }
    return raw;
  } catch { return null; }
}

function getOrBuildIndex(vaultPath) {
  let idx = loadIndex(vaultPath);
  if (!idx) {
    idx = buildIndex(vaultPath);
    if (idx && idx.docs.length > 0) saveIndex(vaultPath, idx);
  }
  return idx;
}

function invalidateCache(vaultPath) {
  const p = getCachePath(vaultPath);
  if (fs.existsSync(p)) fs.rmSync(p);
}

module.exports = {
  buildIndex,
  queryIndex,
  saveIndex,
  loadIndex,
  getOrBuildIndex,
  invalidateCache,
  cosineSimilarity,
  isStopWord,
};
