#!/usr/bin/env node
/**
 * OC-Obsidian-MCP: Session Save Hook
 *
 * Persists agent session summaries directly to the Obsidian vault filesystem.
 * Runs as a Stop hook in OpenCode (via hooks.json).
 *
 * Cross-platform (Windows, macOS, Linux).
 *
 * Configuration via environment variables or config/.mcp-env:
 *   OBSIDIAN_VAULT_PATH  (required) Path to Obsidian vault
 *   DAILY_NOTE_FOLDER    (default: OpenCode/Sessions)
 *   SESSIONS_DIR          (default: ~/.claude/session-data)
 *   GIT_AUTO_SYNC        (default: true)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const HOOK_SCRIPT = process.argv[1] || __filename;

// ─── Load .mcp-env ──────────────────────────────────────

function loadMcpEnv() {
  const scriptDir = path.dirname(HOOK_SCRIPT);
  const envFile = path.join(scriptDir, '..', 'config', '.mcp-env');

  if (!fs.existsSync(envFile)) return;

  const raw = fs.readFileSync(envFile, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.substring(0, eq).trim();
    const val = trimmed.substring(eq + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadMcpEnv();

// ─── Configuration ──────────────────────────────────────

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '';
const DAILY_FOLDER = process.env.DAILY_NOTE_FOLDER || 'OpenCode/Sessions';
const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(os.homedir(), '.claude', 'session-data');
const GIT_AUTO_SYNC = process.env.GIT_AUTO_SYNC !== 'false' && process.env.GIT_AUTO_SYNC !== '0';
const DEBUG = process.env.DEBUG_HOOK === '1';
const TIMEOUT_MS = parseInt(process.env.MCP_TIMEOUT_MS || '15000', 10);

// ─── Utilities ──────────────────────────────────────────

function d(msg) {
  if (DEBUG) process.stderr.write(`[obsidian-hook] ${msg}\n`);
}

function getDateString() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

function getTimeString() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}

function gitTopLevel(cwd) {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding:'utf8', timeout:3000, cwd, stdio:['pipe','pipe','ignore'] }).trim();
  } catch { return null; }
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

// ─── Git Auto-Sync ──────────────────────────────────────

function gitAutoSync(cwd) {
  if (!GIT_AUTO_SYNC) return;
  try {
    const top = gitTopLevel(cwd);
    if (!top) return;
    execSync('git add -A', { encoding:'utf8', timeout:10000, cwd:top, stdio:['pipe','pipe','ignore'] });
    try {
      execSync('git commit -m "vault: auto-save session" --no-verify', {
        encoding:'utf8', timeout:10000, cwd:top, stdio:['pipe','pipe','ignore']
      });
      d('Git auto-sync: committed');
    } catch {
      d('Git auto-sync: nothing to commit');
    }
  } catch (e) {
    d(`Git auto-sync failed: ${e.message}`);
  }
}

// ─── Daily Note IO ──────────────────────────────────────

function getDailyNotePath() {
  const today = getDateString();
  return path.join(VAULT_PATH, DAILY_FOLDER, `${today}.md`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function appendToDailyNote(summary) {
  const notePath = getDailyNotePath();
  const dir = path.dirname(notePath);
  ensureDir(dir);

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
  d(`Appended to ${notePath}`);

  // Git sync
  gitAutoSync(dir);

  return true;
}

// ─── Session Summary Extraction ─────────────────────────

function extractLatestSessionSummary() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    d(`Sessions dir not found: ${SESSIONS_DIR}`);
    return null;
  }

  const files = fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('-session.tmp'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const latest = path.join(SESSIONS_DIR, files[0]);
  const content = fs.readFileSync(latest, 'utf8');

  // Try to extract ECC summary block
  const summaryMatch = content.match(
    /<!-- ECC:SUMMARY:START -->([\s\S]*?)<!-- ECC:SUMMARY:END -->/
  );
  if (summaryMatch) return summaryMatch[1].trim();

  // Fallback: last 500 chars
  return content.slice(-500).trim();
}

// ─── Main ───────────────────────────────────────────────

function main() {
  if (!VAULT_PATH) {
    d('OBSIDIAN_VAULT_PATH not set -- skipping');
    process.exit(0);
  }

  if (!fs.existsSync(VAULT_PATH)) {
    d(`Vault path not found: ${VAULT_PATH} -- skipping`);
    process.exit(0);
  }

  const summary = extractLatestSessionSummary();
  if (!summary) {
    d('No session summary found -- skipping');
    process.exit(0);
  }

  appendToDailyNote(summary);
  process.exit(0);
}

main();
