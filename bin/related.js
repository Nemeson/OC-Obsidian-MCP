#!/usr/bin/env node
/**
 * OC-Obsidian-MCP: Related Notes Finder
 *
 * Usage:
 *   oc-obsidian-mcp related "Suchbegriff"
 *   oc-obsidian-mcp related "auth pattern" --project PCAP2KML
 *
 * Finds notes related to the query via keyword-overlap across:
 *   Decisions/, Learnings/, Sessions/
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function loadMcpEnv() {
  const candidates = [
    path.join(__dirname, '..', 'config', '.mcp-env'),
    path.join(os.homedir(), '.oc-obsidian-mcp', 'config', '.mcp-env'),
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq === -1) continue;
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

function findRelatedNotes(project, query, maxResults = 10) {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const results = [];

  const searchDirs = [
    { base: 'OpenCode/Decisions', label: '📋 Decision' },
    { base: 'OpenCode/Learnings', label: '🧠 Learning' },
    { base: 'OpenCode/Sessions', label: '📝 Session' },
  ];

  for (const { base, label } of searchDirs) {
    const projectDir = path.join(VAULT_PATH, base, project);
    const globalDir = path.join(VAULT_PATH, base, '_global');

    for (const dir of [projectDir, globalDir]) {
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.md')) continue;
        if (f === 'index.md' || f.startsWith('.last')) continue;

        const content = fs.readFileSync(path.join(dir, f), 'utf8').toLowerCase();
        let score = 0;
        const matchedTerms = [];

        // Title match (weighted higher)
        const title = f.replace('.md', '');
        for (const kw of keywords) {
          if (title.includes(kw)) {
            score += 3;
            matchedTerms.push(kw);
          }
        }

        // Content match
        for (const kw of keywords) {
          if (content.includes(kw)) {
            score += 1;
            if (!matchedTerms.includes(kw)) matchedTerms.push(kw);
          }
        }

        // Recency bonus
        const stat = fs.statSync(path.join(dir, f));
        const daysSince = Math.floor((Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24));
        score += Math.max(0, 5 - daysSince); // bonus for recent notes

        if (score >= 2) {
          const preview = extractRelevantSnippet(content, keywords, 200);
          results.push({
            type: label,
            path: path.relative(VAULT_PATH, path.join(dir, f)).replace(/\\/g, '/'),
            score,
            matched: matchedTerms,
            preview,
            daysAgo: daysSince,
          });
        }
      }
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

function extractRelevantSnippet(content, keywords, maxLen) {
  // Find first paragraph containing a keyword
  const paragraphs = content.split(/\n{2,}/);
  for (const p of paragraphs) {
    for (const kw of keywords) {
      if (p.includes(kw)) {
        const short = p.trim().slice(0, maxLen);
        return short.length < p.trim().length ? short + '…' : short;
      }
    }
  }
  return content.trim().slice(0, maxLen) + '…';
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: oc-obsidian-mcp related "query" [--project NAME] [--limit N]');
    process.exit(0);
  }

  const query = !args[0].startsWith('--') ? args[0] : '';
  const projectIdx = args.indexOf('--project');
  const project = projectIdx > -1 ? args[projectIdx + 1] : detectProject();
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx > -1 ? parseInt(args[limitIdx + 1], 10) : 10;

  if (!VAULT_PATH) { console.error('Error: OBSIDIAN_VAULT_PATH not set'); process.exit(1); }
  if (!query) { console.error('Error: Kein Suchbegriff angegeben'); process.exit(1); }

  const results = findRelatedNotes(project, query, limit);
  if (results.length === 0) {
    console.log(`Keine verwandten Notizen für "${query}" in ${project} gefunden.`);
    return;
  }

  console.log(`🔗 Verwandt mit "${query}" (Projekt: ${project}):\n`);
  for (const r of results) {
    console.log(`  ${r.type}  [${r.path}]  Score: ${r.score}  (vor ${r.daysAgo}d)`);
    console.log(`          ${r.preview}`);
    console.log('');
  }
}

main();
