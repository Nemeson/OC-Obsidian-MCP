#!/usr/bin/env node
/**
 * OC-Obsidian-MCP: Manual Session Log CLI
 *
 * Usage:
 *   npx oc-obsidian-mcp session-log
 *   node bin/session-log.js
 *
 * Saves the current session summary to the Obsidian vault.
 * Works with Claude Code (.tmp files) and OpenCode sessions.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ─── Load .mcp-env ──────────────────────────────────────

function loadMcpEnv() {
  const scriptDir = path.dirname(process.argv[1] || __filename);
  const candidates = [
    path.join(scriptDir, '..', 'config', '.mcp-env'),
    path.join(scriptDir, '..', '..', 'config', '.mcp-env'),
    path.join(os.homedir(), '.oc-obsidian-mcp', 'config', '.mcp-env'),
  ];

  for (const envFile of candidates) {
    if (fs.existsSync(envFile)) {
      const raw = fs.readFileSync(envFile, 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.substring(0, eq).trim();
        const val = trimmed.substring(eq + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
      break;
    }
  }
}

loadMcpEnv();

// ─── Configuration ──────────────────────────────────────

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '';
const DAILY_FOLDER = process.env.DAILY_NOTE_FOLDER || 'OpenCode/Sessions';
const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(os.homedir(), '.claude', 'session-data');
const OPENCODE_SESSIONS_DIR = path.join(os.homedir(), '.opencode', 'sessions');
const DEBUG = process.env.DEBUG_SESSION_LOG === '1';

// ─── Utilities ──────────────────────────────────────────

function d(msg) {
  if (DEBUG) process.stderr.write(`[session-log] ${msg}\n`);
}

function getDateString() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

function getTimeString() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}

function getProjectName() {
  try {
    const top = execSync('git rev-parse --show-toplevel', { encoding:'utf8', timeout:3000, stdio:['pipe','pipe','ignore'] });
    return path.basename(top.trim());
  } catch { return 'unknown'; }
}

function getBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding:'utf8', timeout:3000, stdio:['pipe','pipe','ignore'] }).trim();
  } catch { return 'unknown'; }
}

// ─── Session Discovery ────────────────────────────────────

function findLatestSessionFile() {
  // Try Claude Code session data
  if (fs.existsSync(SESSIONS_DIR)) {
    const files = fs.readdirSync(SESSIONS_DIR)
      .filter(f => f.endsWith('-session.tmp'))
      .sort()
      .reverse();
    if (files.length > 0) {
      d(`Found Claude Code session: ${files[0]}`);
      return path.join(SESSIONS_DIR, files[0]);
    }
  }

  // Try OpenCode sessions
  if (fs.existsSync(OPENCODE_SESSIONS_DIR)) {
    const files = fs.readdirSync(OPENCODE_SESSIONS_DIR)
      .filter(f => f.endsWith('.json') || f.endsWith('.md'))
      .sort()
      .reverse();
    if (files.length > 0) {
      d(`Found OpenCode session: ${files[0]}`);
      return path.join(OPENCODE_SESSIONS_DIR, files[0]);
    }
  }

  return null;
}

function extractSummary(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Try ECC summary block (Claude Code format)
  const summaryMatch = content.match(
    /<!-- ECC:SUMMARY:START -->([\s\S]*?)<!-- ECC:SUMMARY:END -->/
  );
  if (summaryMatch) return summaryMatch[1].trim();

  // Try OpenCode JSON format
  try {
    const json = JSON.parse(content);
    if (json.summary || json.content) return (json.summary || json.content).toString().slice(0, 2000);
  } catch { /* not JSON */ }

  // Fallback: first 1000 chars (header section)
  const headerMatch = content.match(/^(#[^\n]*\n.*?)(?=\n#{2,}|\n---|$)/s);
  if (headerMatch) return headerMatch[1].trim().slice(0, 1500);

  // Ultimate fallback
  return content.slice(0, 1000).trim();
}

// ─── Vault IO ───────────────────────────────────────────

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function appendToDailyNote(summary) {
  const today = getDateString();
  const noteDir = path.join(VAULT_PATH, DAILY_FOLDER);
  const notePath = path.join(noteDir, `${today}.md`);

  ensureDir(noteDir);

  const time = getTimeString();
  const project = getProjectName();
  const branch = getBranch();

  const entry = [
    '',
    `## Session — ${time}`,
    `**Project:** ${project} \`${branch}\``,
    '',
    summary,
    ''
  ].join('\n');

  fs.appendFileSync(notePath, entry, { encoding:'utf8' });
  return notePath;
}

// ─── Main ───────────────────────────────────────────────

function main() {
  if (!VAULT_PATH) {
    console.error('Error: OBSIDIAN_VAULT_PATH not set. Run setup or set the environment variable.');
    process.exit(1);
  }

  if (!fs.existsSync(VAULT_PATH)) {
    console.error(`Error: Vault path not found: ${VAULT_PATH}`);
    process.exit(1);
  }

  const sessionFile = findLatestSessionFile();
  if (!sessionFile) {
    console.error('Error: No session file found. Checked:');
    console.error(`  - ${SESSIONS_DIR}`);
    console.error(`  - ${OPENCODE_SESSIONS_DIR}`);
    process.exit(1);
  }

  d(`Reading session from: ${sessionFile}`);
  const summary = extractSummary(sessionFile);

  if (!summary) {
    console.error('Error: Could not extract summary from session file.');
    process.exit(1);
  }

  const notePath = appendToDailyNote(summary);
  console.log(`Session logged to: ${notePath}`);
  console.log(`Length: ${summary.length} chars`);
}

main();
