#!/usr/bin/env node
/**
 * OC-Obsidian-MCP: Related Notes Finder (v2.1 Hybrid)
 *
 * Usage:
 *   oc-obsidian-mcp related "Suchbegriff"
 *   oc-obsidian-mcp related "auth pattern" --project PCAP2KML [--semantic]
 *
 * Finds notes via hybrid scoring:
 *   keyword_match (40%) + tfidf_similarity (30%) + recency (15%) + reuse (15%)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { getOrBuildIndex, queryIndex } = require('../lib/tfidf');
const { computeRelevanceBoost, trackUsage } = require('../lib/relevance');
// const { detectTags } = require('../lib/tags'); // currently unused

function loadMcpEnv() {
  const candidates = [
    path.join(__dirname, '..', 'config', '.mcp-env'),
    path.join(os.homedir(), '.oc-obsidian-mcp', 'config', '.mcp-env'),
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) {continue;}
        const eq = t.indexOf('=');
        if (eq === -1) {continue;}
        if (!process.env[t.substring(0, eq).trim()]) {
          process.env[t.substring(0, eq).trim()] = t.substring(eq + 1).trim();
        }
      }
      break;
    }
  }
}
loadMcpEnv();

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '';

function detectProject() {
  try {
    const { execSync } = require('child_process');
    const top = execSync('git rev-parse --show-toplevel', { encoding:'utf8', timeout:3000, stdio:['pipe','pipe','ignore'] }).trim();
    return path.basename(top);
  } catch { return '_global'; }
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {return {};}
  const raw = match[1];
  const fm = {};
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) {continue;}
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      try { val = JSON.parse(val.replace(/'/g, '"')); } catch { /* keep string */ }
    }
    fm[key] = val;
  }
  return fm;
}

function buildKeywordScore(content, title, keywords) {
  let score = 0;
  const matched = [];
  for (const kw of keywords) {
    if (title.includes(kw)) { score += 3; matched.push(kw); }
    if (content.includes(kw)) { score += 1; if (!matched.includes(kw)) {matched.push(kw);} }
  }
  return { score, matched };
}

function buildRecencyScore(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const daysSince = Math.floor((Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24));
    return Math.max(0, 5 - daysSince) / 5;
  } catch { return 0; }
}

function findRelatedNotes(project, query, maxResults = 10, useSemantic = false) {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const results = [];
  const seen = new Set();

  const searchDirs = [
    { base: 'OpenCode/Decisions', label: '\ud83d\udccb Decision' },
    { base: 'OpenCode/Learnings', label: '\ud83e\udde0 Learning' },
    { base: 'OpenCode/Sessions', label: '\ud83d\udcdd Session' },
  ];

  // Get TF-IDF similarity if requested
  let tfidfMatches = [];
  const index = useSemantic ? getOrBuildIndex(VAULT_PATH) : null;
  if (index && index.docs.length > 0) {
    tfidfMatches = queryIndex(index, query, maxResults * 3);
  }
  const tfidfByPath = new Map(tfidfMatches.map(r => [r.path, r.similarity]));

  for (const { base, label } of searchDirs) {
    const projectDir = path.join(VAULT_PATH, base, project);
    const globalDir = path.join(VAULT_PATH, base, '_global');

    for (const dir of [projectDir, globalDir]) {
      if (!fs.existsSync(dir)) {continue;}
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.md')) {continue;}
        if (f === 'index.md' || f.startsWith('.')) {continue;}

        const filePath = path.join(dir, f);
        if (seen.has(filePath)) {continue;}
        seen.add(filePath);

        const rawContent = fs.readFileSync(filePath, 'utf8');
        const content = rawContent.toLowerCase();
        const title = f.replace('.md', '').toLowerCase();
        const fm = parseFrontmatter(rawContent);

        // Keyword score (0-1 normalized roughly)
        const kw = buildKeywordScore(content, title, keywords);
        const keywordScore = Math.min(1, kw.score / 10);

        // TF-IDF similarity
        const tfidfSim = tfidfByPath.get(filePath) || 0;

        // Relevance boost
        const relBoost = computeRelevanceBoost({
          reuse_count: fm.reuse_count,
          last_used: fm.last_used,
          created: fm.created,
        });

        // Recency score
        const recencyScore = buildRecencyScore(filePath);

        const hybridScore = useSemantic
          ? tfidfSim // semantic mode: pure TF-IDF
          : (keywordScore * 0.40) + (tfidfSim * 0.30) + (recencyScore * 0.15) + (relBoost * 0.15);

        if (hybridScore >= 0.1) {
          const preview = extractRelevantSnippet(content, keywords, 200);
          const tags = Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [String(fm.tags)] : []);
          results.push({
            type: label,
            path: path.relative(VAULT_PATH, filePath).replace(/\\/g, '/'),
            rawPath: filePath,
            score: parseFloat(hybridScore.toFixed(3)),
            keywordScore: parseFloat(keywordScore.toFixed(3)),
            tfidfScore: parseFloat(tfidfSim.toFixed(3)),
            recencyScore: parseFloat(recencyScore.toFixed(3)),
            relBoost: parseFloat(relBoost.toFixed(3)),
            matched: kw.matched,
            preview,
            tags,
            reuseCount: Number(fm.reuse_count) || 0,
            lastUsed: fm.last_used || null,
          });
        }
      }
    }
  }

  const final = results.sort((a, b) => b.score - a.score).slice(0, maxResults);
  return final;
}

function extractRelevantSnippet(content, keywords, maxLen) {
  const paragraphs = content.split(/\n{2,}/);
  for (const p of paragraphs) {
    for (const kw of keywords) {
      if (p.includes(kw)) {
        const short = p.trim().slice(0, maxLen);
        return short.length < p.trim().length ? short + '\u2026' : short;
      }
    }
  }
  return content.trim().slice(0, maxLen) + '\u2026';
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: oc-obsidian-mcp related "query" [--project NAME] [--limit N] [--semantic]');
    process.exit(0);
  }

  const query = !args[0].startsWith('--') ? args[0] : '';
  const projectIdx = args.indexOf('--project');
  const project = projectIdx > -1 ? args[projectIdx + 1] : detectProject();
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx > -1 ? parseInt(args[limitIdx + 1], 10) : 10;
  const semantic = args.includes('--semantic');

  if (!VAULT_PATH) { console.error('Error: OBSIDIAN_VAULT_PATH not set'); process.exit(1); }
  if (!query) { console.error('Error: Kein Suchbegriff angegeben'); process.exit(1); }

  const results = findRelatedNotes(project, query, limit, semantic);
  if (results.length === 0) {
    console.log(`Keine verwandten Notizen f\u00fcr "${query}" in ${project} gefunden.`);
    return;
  }

  console.log(`\ud83d\udd0d Verwandt mit "${query}" (Projekt: ${project}):\n`);
  for (const r of results) {
    const tagStr = r.tags.length ? `  Tags: ${r.tags.join(' ')}` : '';
    console.log(`  ${r.type}  [${r.path}]  Hybrid: ${r.score}`);
    console.log(`     \u251c kw:${r.keywordScore}  tfidf:${r.tfidfScore}  recency:${r.recencyScore}  reuse:${r.relBoost}`);
    if (r.reuseCount) {console.log(`     \u251c Reused: ${r.reuseCount}\u00d7  Last: ${r.lastUsed || 'n/a'}`);}
    if (tagStr) {console.log(`     \u251c ${tagStr}`);}
    console.log(`     \u2514 ${r.preview}`);
    console.log('');

    // Track usage of returned notes
    trackUsage(r.rawPath);
  }
}

if (require.main === module) {
  main();
}
