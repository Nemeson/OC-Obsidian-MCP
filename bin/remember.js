#!/usr/bin/env node
/**
 * OC-Obsidian-MCP: Remember Command (/remember)
 *
 * Usage:
 *   oc-obsidian-mcp remember "Rust borrow checker workaround"
 *   oc-obsidian-mcp remember "Titel" --type bugfix --project PCAP2KML --code "fn main..."
 *
 * Saves a reusable learning/pattern to:
 *   OpenCode/Learnings/{project}/title.md
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Load config ───────────────────────────────────────
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
        process.env[t.substring(0, eq).trim()] = t.substring(eq + 1).trim();
      }
      break;
    }
  }
}
loadMcpEnv();

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '';
const LEARNINGS_FOLDER = process.env.DISCOVERIES_FOLDER || 'OpenCode/Learnings';
const { execSync } = require('child_process');

// ─── Helpers ────────────────────────────────────────────
function getDate() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function detectProject() {
  try {
    const top = execSync('git rev-parse --show-toplevel', { encoding:'utf8', timeout:3000, stdio:['pipe','pipe','ignore'] }).trim();
    return path.basename(top);
  } catch { return '_global'; }
}

function detectType(title, body) {
  const text = (title + ' ' + (body || '')).toLowerCase();
  if (text.includes('bug') || text.includes('fehler') || text.includes('error')) return 'Bugfix';
  if (text.includes('refactor') || text.includes('pattern') || text.includes('muster')) return 'Pattern';
  if (text.includes('architektur') || text.includes('architecture') || text.includes('design')) return 'Architektur';
  if (text.includes('test') || text.includes('testing')) return 'Testing';
  if (text.match(/```/)) return 'Code-Snippet';
  return 'Pattern';
}

function detectImportance(title, body) {
  const text = (title + ' ' + (body || '')).toLowerCase();
  if (text.includes('kritisch') || text.includes('critical') || text.includes('security') || text.includes('production')) return 'high';
  if (text.includes('nice-to-have') || text.includes('optional') || text.includes('cosmetic')) return 'low';
  return 'medium';
}

// ─── Related Notes ──────────────────────────────────────
function findRelated(project, keywords) {
  const results = [];
  const dirs = [
    path.join(VAULT_PATH, LEARNINGS_FOLDER, project),
    path.join(VAULT_PATH, process.env.DECISIONS_FOLDER || 'OpenCode/Decisions', project),
  ];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const content = fs.readFileSync(path.join(dir, f), 'utf8').toLowerCase();
      let score = keywords.reduce((s, kw) => s + (content.includes(kw.toLowerCase()) ? 1 : 0), 0);
      if (score >= 2) results.push({ file: f, score });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

// ─── Template ───────────────────────────────────────────
function buildLearning(title, project, type, importance, body, code) {
  const slug = slugify(title);
  const keywords = title.split(/\s+/).filter(w => w.length > 3);
  const related = findRelated(project, keywords);

  let lines = [
    `# ${title}`,
    '',
    `**Typ:** ${type}`,
    `**Projekt:** ${project}`,
    `**Datum:** ${getDate()}`,
    `**Relevanz:** #${importance}`,
    '',
    '---',
    '',
  ];

  if (body) {
    lines.push('## Problem');
    lines.push('');
    lines.push(body);
    lines.push('');
  } else {
    lines.push('## Problem');
    lines.push('');
    lines.push('[Kurzbeschreibung des Problems oder der Erkenntnis]');
    lines.push('');
  }

  lines.push('## Lösung');
  lines.push('');
  lines.push('[Wie wurde es gelöst? Was ist das Pattern?]');
  lines.push('');

  if (code) {
    lines.push('## Code');
    lines.push('');
    lines.push('```');
    lines.push(code.trim());
    lines.push('```');
    lines.push('');
  }

  if (related.length > 0) {
    lines.push('## Verwandte Notizen');
    lines.push('');
    for (const r of related) {
      lines.push(`- [[${r.file.replace('.md', '')}]]`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Gespeichert von OC-Obsidian-MCP am ${getDate()}*`);
  lines.push('');

  return lines.join('\n');
}

// ─── Duplicate Check ────────────────────────────────────
function isDuplicate(project, title, content) {
  const dir = path.join(VAULT_PATH, LEARNINGS_FOLDER, project);
  if (!fs.existsSync(dir)) return false;

  const slug = slugify(title);
  if (fs.existsSync(path.join(dir, slug + '.md'))) return true;

  // Check content similarity
  const keywords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const existing = fs.readFileSync(path.join(dir, f), 'utf8').toLowerCase();
    let match = 0;
    for (const kw of keywords) {
      if (existing.includes(kw)) match++;
    }
    if (match >= keywords.length * 0.7) return true; // 70% keyword overlap
  }
  return false;
}

// ─── Main ───────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: oc-obsidian-mcp remember "Title" [--type TYPE] [--project NAME] [--code "fn main()"]');
    console.log('Types: Bugfix, Pattern, Code-Snippet, Architektur, Testing');
    process.exit(0);
  }

  const title = !args[0].startsWith('--') ? args[0] : 'Neues Learning';
  const typeIdx = args.indexOf('--type');
  const projectIdx = args.indexOf('--project');
  const codeIdx = args.indexOf('--code');
  const bodyIdx = args.indexOf('--body');

  const type = typeIdx > -1 ? args[typeIdx + 1] : detectType(title, '');
  const project = projectIdx > -1 ? args[projectIdx + 1] : detectProject();
  const code = codeIdx > -1 ? args[codeIdx + 1] : null;
  const body = bodyIdx > -1 ? args[bodyIdx + 1] : null;
  const importance = detectImportance(title, body || '');

  if (!VAULT_PATH) { console.error('Error: OBSIDIAN_VAULT_PATH not set'); process.exit(1); }

  // Duplicate check
  if (isDuplicate(project, title, body || '')) {
    console.log(`⚠️  Ähnliches Learning existiert bereits in ${project}. Überspringe.`);
    process.exit(0);
  }

  const content = buildLearning(title, project, type, importance, body, code);
  const dir = path.join(VAULT_PATH, LEARNINGS_FOLDER, project);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filename = slugify(title) + '.md';
  const filePath = path.join(dir, filename);

  if (fs.existsSync(filePath)) {
    // Append rather than overwrite
    fs.appendFileSync(filePath, '\n\n' + content, 'utf8');
    console.log(`📎 Angehängt an bestehendes Learning: ${filePath}`);
  } else {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Learning gespeichert: ${filePath}`);
  }
}

main();
