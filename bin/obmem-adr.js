#!/usr/bin/env node
/**
 * OC-Obsidian-MCP: ADR Command (/adr)
 *
 * Usage:
 *   oc-obsidian-mcp adr "Titel der Entscheidung"
 *   oc-obsidian-mcp adr "Titel" --project PCAP2KML --status accepted
 *
 * Creates a structured Architecture Decision Record in:
 *   OpenCode/Decisions/{project}/ADR-NNN-title.md
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const { detectTags } = require('../lib/tags');
const { initRelevance } = require('../lib/relevance');

// ─── Load .mcp-env ──────────────────────────────────────
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
        const key = t.substring(0, eq).trim();
        const val = t.substring(eq + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
      break;
    }
  }
}
loadMcpEnv();

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '';
const DECISIONS_FOLDER = process.env.DECISIONS_FOLDER || 'OpenCode/Decisions';

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
    const { execSync } = require('child_process');
    const top = execSync('git rev-parse --show-toplevel', { encoding:'utf8', timeout:3000, stdio:['pipe','pipe','ignore'] }).trim();
    return path.basename(top);
  } catch { return '_global'; }
}

function getNextAdrNumber(project) {
  const dir = path.join(VAULT_PATH, DECISIONS_FOLDER, project);
  if (!fs.existsSync(dir)) return 1;
  const files = fs.readdirSync(dir).filter(f => f.startsWith('ADR-'));
  let max = 0;
  for (const f of files) {
    const match = f.match(/^ADR-(\d+)/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return max + 1;
}

function findRelatedNotes(project, keywords) {
  const results = [];
  const dirs = [
    path.join(VAULT_PATH, DECISIONS_FOLDER, project),
    path.join(VAULT_PATH, process.env.DISCOVERIES_FOLDER || 'OpenCode/Learnings', project),
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const content = fs.readFileSync(path.join(dir, f), 'utf8').toLowerCase();
      let score = 0;
      for (const kw of keywords) {
        if (content.includes(kw.toLowerCase())) score++;
      }
      if (score >= 2) results.push({ file: f, score });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 5);
}

// ─── ADR Template ───────────────────────────────────────
function buildAdr(title, project, status, body) {
  const num = getNextAdrNumber(project);
  const slug = slugify(title);
  const keywords = title.split(/\s+/).filter(w => w.length > 3);
  const related = findRelatedNotes(project, keywords);
  const tags = detectTags(title, body || '');
  const rel = initRelevance({ created: getDate() });

  const lines = [
    '---',
    'type: ADR',
    `status: ${status}`,
    `project: ${project}`,
    `created: ${getDate()}`,
    `tags: [${tags.all.map(t => `'${t}'`).join(', ')}]`,
    `reuse_count: ${rel.reuse_count}`,
    `last_used: ${rel.last_used}`,
    '---',
    '',
    `# ADR-${String(num).padStart(3, '0')}: ${title}`,
    '',
    '## Kontext',
    '',
    body || '[Warum wurde diese Entscheidung benötigt? Was sind die Randbedingungen?]',
    '',
    '## Entscheidung',
    '',
    '[Was wurde entschieden? Beschreibe konkret die gewählte Lösung.]',
    '',
    '## Alternativen',
    '',
    '- **Option A:** [Beschreibung] — [Pro/Contra]',
    '- **Option B:** [Beschreibung] — [Pro/Contra]',
    '',
    '## Konsequenzen',
    '',
    '### Positiv',
    '- ',
    '',
    '### Negativ',
    '- ',
    '',
  ];

  if (related.length > 0) {
    lines.push('## Verwandte Notizen');
    for (const r of related) {
      const noteName = r.file.replace('.md', '');
      lines.push(`- [[../Decisions/${project}/${noteName}|${noteName}]]`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Generiert von OC-Obsidian-MCP am ${getDate()}*`);

  return { content: lines.join('\n'), num, filename: `ADR-${String(num).padStart(3, '0')}-${slugify(title)}.md` };
}

// ─── Main ───────────────────────────────────────────────
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('Usage: oc-obsidian-mcp adr "Title" [--project NAME] [--status STATUS]');
    process.exit(0);
  }

  const title = !args[0].startsWith('--') ? args[0] : 'Neue Entscheidung';
  const statusIdx = args.indexOf('--status');
  const status = statusIdx > -1 ? args[statusIdx + 1] : 'Vorgeschlagen';
  const projectIdx = args.indexOf('--project');
  const project = projectIdx > -1 ? args[projectIdx + 1] : detectProject();

  if (!VAULT_PATH) { console.error('Error: OBSIDIAN_VAULT_PATH not set'); process.exit(1); }

  const { content, num, filename } = buildAdr(title, project, status, null);
  const dir = path.join(VAULT_PATH, DECISIONS_FOLDER, project);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content, 'utf8');

  console.log(`✅ ADR-${String(num).padStart(3, '0')} erstellt: ${filePath}`);
}

main();
