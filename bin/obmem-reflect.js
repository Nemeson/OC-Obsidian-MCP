#!/usr/bin/env node
/**
 * ObMem v2.5: Reflect Command (/reflect)
 *
 * Usage:
 *   obmem reflect
 *   obmem reflect --project PCAP2KML
 *   obmem reflect --days 7
 *
 * Scans recent session logs and writes a self-reflection note to:
 *   OpenCode/Reflections/{project}/{date}.md
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

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
const REFLECTIONS_FOLDER = process.env.REFLECTIONS_FOLDER || 'OpenCode/Reflections';

// ─── Helpers ────────────────────────────────────────────
function getDate() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

function detectProject() {
  try {
    const { execSync } = require('child_process');
    const top = execSync('git rev-parse --show-toplevel', { encoding:'utf8', timeout:3000, stdio:['pipe','pipe','ignore'] }).trim();
    return path.basename(top);
  } catch { return '_global'; }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { project: null, days: 7, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--project') opts.project = args[++i];
    else if (a === '--days') opts.days = parseInt(args[++i], 10) || 7;
    else if (a === '--dry-run') opts.dryRun = true;
  }
  return opts;
}

function getRecentSessions(project, days) {
  const sessionsDir = path.join(VAULT_PATH, 'OpenCode', 'Sessions', project);
  if (!fs.existsSync(sessionsDir)) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  return fs.readdirSync(sessionsDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .filter(f => f.replace('.md', '') >= cutoffStr)
    .sort()
    .map(f => {
      const content = fs.readFileSync(path.join(sessionsDir, f), 'utf8');
      return { date: f.replace('.md', ''), content };
    });
}

function extractDecisions(content) {
  const decisions = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^(###? )?(Decision|Entscheidung|ADR|Chosen|Wir entscheiden)/i)) {
      decisions.push(trimmed.replace(/^#+\s*/, ''));
    }
  }
  return decisions;
}

function extractBlockers(content) {
  const blockers = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^(###? )?(Blocker|Hindernis|Problem|Issue|Bug|Fehler|Stuck)/i)) {
      blockers.push(trimmed.replace(/^#+\s*/, ''));
    }
  }
  return blockers;
}

function extractWins(content) {
  const wins = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^(###? )?(Win|Erfolg|Done|Completed|Abgeschlossen|Fixed|Gelöst)/i)) {
      wins.push(trimmed.replace(/^#+\s*/, ''));
    }
  }
  return wins;
}

function generateReflection(opts, sessions) {
  const date = getDate();
  const project = opts.project;
  const allDecisions = [];
  const allBlockers = [];
  const allWins = [];

  for (const s of sessions) {
    allDecisions.push(...extractDecisions(s.content));
    allBlockers.push(...extractBlockers(s.content));
    allWins.push(...extractWins(s.content));
  }

  const unique = arr => [...new Set(arr)].filter(Boolean);

  let body = `---
type: reflection
project: ${project}
period: last ${opts.days} days
date: ${date}
---

# 🪞 Self-Reflection: ${project}

> Period: last **${opts.days} days**  |  Sessions: **${sessions.length}**  |  Date: ${date}

`;

  if (allWins.length) {
    body += '## ✅ Wins / Completed\n\n';
    for (const w of unique(allWins)) body += `- ${w}\n`;
    body += '\n';
  }

  if (allDecisions.length) {
    body += '## 🎯 Decisions Made\n\n';
    for (const d of unique(allDecisions)) body += `- ${d}\n`;
    body += '\n';
  }

  if (allBlockers.length) {
    body += '## 🚧 Blockers / Open Issues\n\n';
    for (const b of unique(allBlockers)) body += `- ${b}\n`;
    body += '\n';
  }

  body += `---\n
## 📝 Next Actions (Auto-detected)\n\n`;
  if (allBlockers.length) {
    body += '- [ ] Resolve open blockers above\n';
  }
  if (allDecisions.length) {
    body += '- [ ] Document pending ADRs for unresolved decisions\n';
  }
  body += '- [ ] Review related notes and update context\n';

  body += `\n---\n_Generated by ObMem Reflect v2.5_\n`;

  return body;
}

// ─── Main ───────────────────────────────────────────────
function main() {
  if (!VAULT_PATH) {
    console.error('Error: OBSIDIAN_VAULT_PATH not set. Run setup first: obmem setup');
    process.exit(1);
  }

  const opts = parseArgs();
  const project = opts.project || detectProject();

  console.log(`\n🔍 Scanning last ${opts.days} days of sessions for project: ${project}`);

  const sessions = getRecentSessions(project, opts.days);
  console.log(`   Found ${sessions.length} session(s)`);

  if (!sessions.length) {
    console.log('   No sessions found in range. Nothing to reflect on.\n');
    process.exit(0);
  }

  const reflection = generateReflection(opts, sessions);

  if (opts.dryRun) {
    console.log('\n--- DRY-RUN: Would write ---\n');
    console.log(reflection);
    console.log('\n--- End dry-run ---\n');
    return;
  }

  const outDir = path.join(VAULT_PATH, REFLECTIONS_FOLDER, project);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, `${getDate()}.md`);
  fs.writeFileSync(outFile, reflection, 'utf8');

  console.log(`   💾 Saved reflection to ${outFile.replace(VAULT_PATH + path.sep, '')}`);
  console.log(`\n🪞 Reflection complete for ${project}\n`);
}

main();
