#!/usr/bin/env node
/**
 * OC-Obsidian-MCP: Context Loader (Bidirectional Learning)
 *
 * Reads project context, decisions, and learnings from Obsidian vault
 * to bootstrap agent sessions. Call at session start or via /load-context.
 *
 * Usage:
 *   node hooks/obsidian-context-loader.js [project-name]
 *
 * If no project name given, auto-detects from git or current dir.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// ─── Load .mcp-env ──────────────────────────────────────

function loadMcpEnv() {
  const envFile = path.join(PROJECT_ROOT, 'config', '.mcp-env');
  if (!fs.existsSync(envFile)) return;
  const raw = fs.readFileSync(envFile, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.substring(0, eq).trim();
    const val = t.substring(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadMcpEnv();

// ─── Configuration ──────────────────────────────────────

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '';

const FOLDERS = {
  context: process.env.CONTEXT_FOLDER || 'OpenCode/Context',
  decisions: process.env.DECISIONS_FOLDER || 'OpenCode/Decisions',
  learnings: process.env.DISCOVERIES_FOLDER || 'OpenCode/Learnings',
};

const LIMITS = {
  contextFiles: 10,
  decisions: 5,
  learnings: 10,
  sessions: 3,
};

// ─── Utilities ──────────────────────────────────────────

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function listDir(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .map(f => path.join(dirPath, f))
    .filter(f => fs.statSync(f).isFile() && f.endsWith('.md'));
}

function readFirst(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch { return null; }
}

// ─── Project Detection ─────────────────────────────────

function detectProject() {
  // Try session file
  const sessionDir = path.join(os.homedir(), '.claude', 'session-data');
  if (fs.existsSync(sessionDir)) {
    const files = fs.readdirSync(sessionDir)
      .filter(f => f.endsWith('-session.tmp'))
      .sort()
      .reverse();
    if (files.length > 0) {
      const basename = path.basename(files[0], '-session.tmp');
      const match = basename.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
      if (match && match[1] && match[1] !== 'session' && match[1] !== 'claude') {
        return match[1];
      }
    }
  }

  // Try git
  try {
    const { execSync } = require('child_process');
    const top = execSync('git rev-parse --show-toplevel', {
      encoding:'utf8', timeout:3000, stdio:['pipe','pipe','ignore']
    }).trim();
    return path.basename(top);
  } catch { return '_global'; }
}

// ─── Context Loading ─────────────────────────────────────

function loadBootstrap() {
  const p = path.join(VAULT_PATH, FOLDERS.context, '_bootstrap.md');
  return readFirst(p);
}

function loadProjectContext(project) {
  const projectDir = path.join(VAULT_PATH, FOLDERS.context, project);
  if (!fs.existsSync(projectDir)) return [];

  const files = listDir(projectDir).slice(0, LIMITS.contextFiles);
  return files.map(f => ({
    source: path.relative(VAULT_PATH, f),
    content: readFirst(f)
  })).filter(c => c.content !== null);
}

function loadDecisions(project) {
  const decisionDir = path.join(VAULT_PATH, FOLDERS.decisions, project);
  if (!fs.existsSync(decisionDir)) return [];

  const files = listDir(decisionDir).slice(0, LIMITS.decisions);
  return files.map(f => ({
    source: path.relative(VAULT_PATH, f),
    content: readFirst(f)
  })).filter(c => c.content !== null);
}

function loadLearnings(project) {
  const learningDir = path.join(VAULT_PATH, FOLDERS.learnings, project);
  if (!fs.existsSync(learningDir)) return [];

  const files = listDir(learningDir).slice(0, LIMITS.learnings);
  return files.map(f => ({
    source: path.relative(VAULT_PATH, f),
    content: readFirst(f)
  })).filter(c => c.content !== null);
}

function loadRecentSessions(project) {
  const sessionDir = path.join(VAULT_PATH, FOLDERS.context.replace('Context','Sessions'), project);
  if (!fs.existsSync(sessionDir)) return [];

  const files = listDir(sessionDir)
    .filter(f => path.basename(f) !== 'index.md')
    .sort()
    .reverse()
    .slice(0, LIMITS.sessions);

  return files.map(f => ({
    source: path.relative(VAULT_PATH, f),
    date: path.basename(f, '.md'),
    content: null // too long; load on demand if needed
  }));
}

// ─── Formatter (for agent consumption) ────────────────────

function formatContext(project, data) {
  const lines = [
    `\n\n<!-- OBSIDIAN CONTEXT START -->`,
    `# 🧠 Obsidian Context for ${project}`,
    `\n*Loaded from vault: ${VAULT_PATH}*\n`,
  ];

  // Bootstrap
  if (data.bootstrap) {
    lines.push(`---`);
    lines.push(`## Global Bootstrap`);
    lines.push(data.bootstrap);
  }

  // Project Context
  if (data.projectContexts.length > 0) {
    lines.push(`\n---`);
    lines.push(`## Project Context (${data.projectContexts.length} files)`);
    for (const ctx of data.projectContexts) {
      lines.push(`\n### ${ctx.source}`);
      lines.push(ctx.content.slice(0, 2000)); // limit length
    }
  }

  // Recent Sessions
  if (data.sessions.length > 0) {
    lines.push(`\n---`);
    lines.push(`## Recent Sessions (${data.sessions.length} sessions)`);
    for (const s of data.sessions) {
      lines.push(`- **${s.date}** — \`[${s.source}]\``);
    }
  }

  // Decisions
  if (data.decisions.length > 0) {
    lines.push(`\n---`);
    lines.push(`## Decisions (${data.decisions.length} ADRs)`);
    for (const dec of data.decisions) {
      lines.push(`\n### ${path.basename(dec.source, '.md')}`);
      lines.push(dec.content.slice(0, 1500));
    }
  }

  // Learnings
  if (data.learnings.length > 0) {
    lines.push(`\n---`);
    lines.push(`## Learnings (${data.learnings.length} patterns)`);
    for (const l of data.learnings) {
      lines.push(`\n### ${path.basename(l.source, '.md')}`);
      lines.push(l.content.slice(0, 1000));
    }
  }

  lines.push(`\n<!-- OBSIDIAN CONTEXT END -->\n`);
  return lines.join('\n');
}

// ─── Main ───────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let project = args[0];

  if (!project) {
    project = detectProject();
  }

  if (!VAULT_PATH) {
    console.error('Error: OBSIDIAN_VAULT_PATH not set');
    process.exit(1);
  }

  if (!fs.existsSync(VAULT_PATH)) {
    console.error(`Error: Vault path not found: ${VAULT_PATH}`);
    process.exit(1);
  }

  const data = {
    bootstrap: loadBootstrap(),
    projectContexts: loadProjectContext(project),
    decisions: loadDecisions(project),
    learnings: loadLearnings(project),
    sessions: loadRecentSessions(project),
  };

  const output = formatContext(project, data);
  console.log(output);

  // Also write to OpenCode/Context/_last-loaded.md for reference
  try {
    const refPath = path.join(VAULT_PATH, FOLDERS.context, '.last-loaded.md');
    fs.writeFileSync(refPath, `# Last Loaded Context\n\n- **Project:** ${project}\n- **Time:** ${new Date().toISOString()}\n- **Files:** ${data.projectContexts.length} contexts, ${data.decisions.length} decisions, ${data.learnings.length} learnings\n`, { encoding: 'utf8' });
  } catch {}
}

main();
