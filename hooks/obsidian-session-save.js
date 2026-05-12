#!/usr/bin/env node
/**
 * OC-Obsidian-MCP: Intelligent Session Save Hook
 *
 * Persists agent session summaries directly to the Obsidian vault filesystem.
 * Project-isolated: Sessions are stored per-project (detected from session filename + git worktree).
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

// ─── Load .mcp-env ──────────────────────────────────────

const HOOK_SCRIPT = process.argv[1] || __filename;

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
    if (!process.env[key]) process.env[key] = val;
  }
}

loadMcpEnv();

// ─── Configuration ──────────────────────────────────────

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '';
const SESSIONS_DIR = process.env.SESSIONS_DIR || path.join(os.homedir(), '.claude', 'session-data');
const GIT_AUTO_SYNC = process.env.GIT_AUTO_SYNC !== 'false' && process.env.GIT_AUTO_SYNC !== '0';
const DEBUG = process.env.DEBUG_HOOK === '1';

const FOLDERS = {
  sessions: process.env.DAILY_NOTE_FOLDER || 'OpenCode/Sessions',
  decisions: process.env.DECISIONS_FOLDER || 'OpenCode/Decisions',
  learnings: process.env.DISCOVERIES_FOLDER || 'OpenCode/Learnings',
  archive: 'OpenCode/Archive',
};

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

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function gitTopLevel(cwd) {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding:'utf8', timeout:3000, cwd, stdio:['pipe','pipe','ignore'] }).trim();
  } catch { return null; }
}

function getGitProjectName(cwd) {
  try {
    const top = execSync('git rev-parse --show-toplevel', { encoding:'utf8', timeout:3000, cwd, stdio:['pipe','pipe','ignore'] }).trim();
    return path.basename(top);
  } catch { return null; }
}

function getGitBranch(cwd) {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding:'utf8', timeout:3000, cwd, stdio:['pipe','pipe','ignore'] }).trim();
  } catch { return 'unknown'; }
}

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

// ─── Project Detection ───────────────────────────────────

/**
 * Detect project name from:
 * 1. Session filename (e.g., "2026-05-09-PCAP2KML-session.tmp")
 * 2. Git worktree (if session dir is inside a git repo)
 * 3. Fallback to "_global"
 */
function detectProject(sessionFilePath) {
  const basename = path.basename(sessionFilePath, '-session.tmp');
  // Match: YYYY-MM-DD-PROJECT-session.tmp
  const match = basename.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
  if (match && match[1] && match[1] !== 'session' && match[1] !== 'claude') {
    return match[1];
  }

  // Fallback: try git
  const gitProject = getGitProjectName(path.dirname(sessionFilePath));
  if (gitProject) return gitProject;

  return '_global';
}

// ─── Session Discovery ─────────────────────────────────

function findLatestSession() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    d(`Sessions dir not found: ${SESSIONS_DIR}`);
    return null;
  }

  const files = fs.readdirSync(SESSIONS_DIR)
    .filter(f => f.endsWith('-session.tmp'))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  const latestFile = files[0];
  const fullPath = path.join(SESSIONS_DIR, latestFile);
  const project = detectProject(fullPath);
  const content = fs.readFileSync(fullPath, 'utf8');

  return {
    file: fullPath,
    name: latestFile,
    project,
    content
  };
}

// ─── Summary Extraction ──────────────────────────────────

function extractSummary(content) {
  // 1. ECC summary block (Claude Code format)
  const summaryMatch = content.match(
    /<!-- ECC:SUMMARY:START -->([\s\S]*?)<!-- ECC:SUMMARY:END -->/
  );
  if (summaryMatch) {
    const summary = summaryMatch[1].trim();
    d('Extracted ECC session summary');
    return summary;
  }

  // 2. OpenCode JSON format
  try {
    const json = JSON.parse(content);
    if (json.summary) return String(json.summary).trim();
  } catch { /* not JSON */ }

  // 3. Fallback: first 1500 chars (header section)
  const header = content.slice(0, 1500).trim();
  d('Fallback: using first 1500 chars as summary');
  return header;
}

// ─── Vault IO (Project-Isolated) ─────────────────────────

function getNoteDir(project) {
  return path.join(VAULT_PATH, FOLDERS.sessions, project);
}

function getNotePath(project) {
  return path.join(getNoteDir(project), `${getDateString()}.md`);
}

function getIndexPath(project) {
  return path.join(getNoteDir(project), 'index.md');
}

function appendToProjectNote(session) {
  const project = session.project;
  const notePath = getNotePath(project);
  const noteDir = path.dirname(notePath);
  ensureDir(noteDir);

  const time = getTimeString();
  const branch = getGitBranch(process.cwd());

  const entry = [
    '',
    `## Session — ${time}`,
    `**Project:** ${project} \`${branch}\``,
    '',
    session.summary,
    ''
  ].join('\n');

  fs.appendFileSync(notePath, entry, { encoding:'utf8' });
  d(`Appended to ${project}: ${path.basename(notePath)}`);

  // Git sync at the vault level
  gitAutoSync(VAULT_PATH);

  return notePath;
}

function updateProjectIndex(session) {
  const project = session.project;
  const indexPath = getIndexPath(project);
  const indexDir = path.dirname(indexPath);
  ensureDir(indexDir);

  const today = getDateString();
  const entryLine = `- **${today}** — ${session.fileName} (${Math.round(session.summary.length / 10) / 10}k chars)`;

  let existing = '';
  if (fs.existsSync(indexPath)) {
    existing = fs.readFileSync(indexPath, 'utf8');
  }

  // Update header if it exists
  const headerRegex = /^(# .+)\n\n/m;
  let updated = existing;
  if (!updated) {
    updated = `# Session Index — ${project}\n\n${entryLine}\n`;
  } else if (updated.includes(entryLine)) {
    d('Index already has entry for today');
    return;
  } else {
    updated += '\n' + entryLine + '\n';
  }

  fs.writeFileSync(indexPath, updated, { encoding:'utf8' });
  d(`Updated index for ${project}`);
}

// ─── Garbage Collection (basic) ──────────────────────────

function shouldRunGC() {
  // Run GC once per day
  const gcFlag = path.join(VAULT_PATH, FOLDERS.sessions, '.last-gc');
  if (!fs.existsSync(gcFlag)) return true;

  const last = new Date(fs.readFileSync(gcFlag, 'utf8'));
  const now = new Date();
  const hours = (now - last) / (1000 * 60 * 60);
  return hours >= 24;
}

function runGC(project) {
  d('Running garbage collection...');

  const sessionsDir = getNoteDir(project);
  if (!fs.existsSync(sessionsDir)) return;

  const files = fs.readdirSync(sessionsDir)
    .filter(f => f.endsWith('.md') && f !== 'index.md');

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  let archived = 0;
  for (const f of files) {
    // Parse date from filename: YYYY-MM-DD.md
    const dateMatch = f.match(/^(\d{4})-(\d{2})-(\d{2})\.md$/);
    if (!dateMatch) continue;

    const fileDate = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
    if (fileDate < cutoff) {
      const src = path.join(sessionsDir, f);
      const archiveDir = path.join(VAULT_PATH, FOLDERS.archive, 'Sessions', project);
      ensureDir(archiveDir);
      fs.renameSync(src, path.join(archiveDir, f));
      archived++;
    }
  }

  d(`GC archived ${archived} sessions for ${project}`);

  // Touch flag
  fs.writeFileSync(path.join(VAULT_PATH, FOLDERS.sessions, '.last-gc'), new Date().toISOString(), { encoding:'utf8' });
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

  const session = findLatestSession();
  if (!session) {
    d('No session file found -- skipping');
    process.exit(0);
  }

  d(`Session: ${session.name} → project: ${session.project} (${session.content.length} chars)`);

  session.summary = extractSummary(session.content);
  if (!session.summary) {
    d('No summary extracted -- skipping');
    process.exit(0);
  }

  // 1. Save session to project-isolated note
  const notePath = appendToProjectNote(session);
  d(`Note path: ${notePath}`);

  // 2. Update project index
  updateProjectIndex(session);

  // 3. Run GC (once per day)
  if (shouldRunGC()) {
    runGC(session.project);
  }

  process.exit(0);
}

main();
