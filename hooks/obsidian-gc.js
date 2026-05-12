#!/usr/bin/env node
/**
 * OC-Obsidian-MCP: Garbage Collector
 *
 * Archiviert alte Sessions, konsolidiert doppelte Learnings,
 * und verwaltet Relevanz-Decay.
 *
 * Usage:
 *   node hooks/obsidian-gc.js [--dry-run] [--project PROJECT]
 *
 * Rules:
 *   Sessions  >30 days     -> Archive
 *   Learnings #low   >60d  -> Delete
 *   Learnings #medium>180d-> Archive
 *   Learnings #high        -> Keep forever
 *   Duplicates 80%+ similar -> Merge to master
 */

const fs = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '';

const DRY_RUN = process.argv.includes('--dry-run');
const TARGET_PROJECT = (() => {
  const idx = process.argv.indexOf('--project');
  return idx > -1 ? process.argv[idx + 1] : null;
})();

const FOLDERS = {
  sessions: 'OpenCode/Sessions',
  learnings: 'OpenCode/Learnings',
  archive: 'OpenCode/Archive',
};

const THRESHOLDS = {
  sessionArchive: 30,
  lowDelete: 60,
  mediumArchive: 180,
  similarity: 0.80, // 80% overlap for merge
};

// ─── Utilities ────────────────────────────────────────────

function d(msg) {
  if (!DRY_RUN) console.log(`[gc] ${msg}`);
  else console.log(`[gc-dry] ${msg}`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function daysSince(date) {
  return Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
}

function isOlderThan(filename, days) {
  const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return false;
  const fileDate = new Date(`${match[1]}-${match[2]}-${match[3]}`);
  return daysSince(fileDate) > days;
}

// ─── Session GC ───────────────────────────────────────────

function archiveSessions(project) {
  const sourceDir = path.join(VAULT_PATH, FOLDERS.sessions, project);
  if (!fs.existsSync(sourceDir)) return;

  const files = fs.readdirSync(sourceDir)
    .filter(f => f.endsWith('.md') && f !== 'index.md')
    .filter(f => isOlderThan(f, THRESHOLDS.sessionArchive));

  const archiveDir = path.join(VAULT_PATH, FOLDERS.archive, 'Sessions', project);
  ensureDir(archiveDir);

  for (const f of files) {
    const src = path.join(sourceDir, f);
    const dest = path.join(archiveDir, f);
    if (DRY_RUN) {
      d(`Would archive: ${f}`);
    } else {
      fs.renameSync(src, dest);
      d(`Archived: ${f}`);
    }
  }
}

// ─── Similarity ───────────────────────────────────────────

function similarity(a, b) {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

// ─── Learning GC ───────────────────────────────────────────

function cleanLearnings(project) {
  const learnDir = path.join(VAULT_PATH, FOLDERS.learnings, project);
  if (!fs.existsSync(learnDir)) return;

  const files = fs.readdirSync(learnDir)
    .filter(f => f.endsWith('.md'));

  const now = new Date();

  // Pass 1: delete low-importance old learnings
  for (const f of files) {
    const full = path.join(learnDir, f);
    const stats = fs.statSync(full);
    const age = daysSince(stats.mtime);
    const content = fs.readFileSync(full, 'utf8');

    if (content.includes('#low') && age > THRESHOLDS.lowDelete) {
      if (DRY_RUN) d(`Would delete #low: ${f} (${age}d)`);
      else { fs.unlinkSync(full); d(`Deleted #low: ${f}`); }
      continue;
    }

    if (content.includes('#medium') && age > THRESHOLDS.mediumArchive) {
      const archiveDir = path.join(VAULT_PATH, FOLDERS.archive, 'Learnings', project);
      ensureDir(archiveDir);
      if (DRY_RUN) d(`Would archive #medium: ${f}`);
      else {
        fs.renameSync(full, path.join(archiveDir, f));
        d(`Archived #medium: ${f}`);
      }
    }
  }

  // Pass 2: merge similar learnings
  const remaining = fs.readdirSync(learnDir)
    .filter(f => f.endsWith('.md'))
    .map(f => ({
      file: f,
      content: fs.readFileSync(path.join(learnDir, f), 'utf8'),
    }));

  const merged = new Set();

  for (let i = 0; i < remaining.length; i++) {
    if (merged.has(i)) continue;
    for (let j = i + 1; j < remaining.length; j++) {
      if (merged.has(j)) continue;
      const sim = similarity(remaining[i].content, remaining[j].content);
      if (sim >= THRESHOLDS.similarity) {
        if (DRY_RUN) {
          d(`Would merge: ${remaining[i].file} + ${remaining[j].file} (sim ${Math.round(sim*100)}%)`);
        } else {
          const master = path.join(learnDir, remaining[i].file);
          const appended = `\n\n<!-- merged from ${remaining[j].file} -->\n` + remaining[j].content;
          fs.appendFileSync(master, appended, 'utf8');
          fs.unlinkSync(path.join(learnDir, remaining[j].file));
          merged.add(j);
          d(`Merged ${remaining[j].file} into ${remaining[i].file}`);
        }
      }
    }
  }
}

// ─── Main ───────────────────────────────────────────────

function getProjects() {
  const sessionDir = path.join(VAULT_PATH, FOLDERS.sessions);
  if (!fs.existsSync(sessionDir)) return [];
  return fs.readdirSync(sessionDir).filter(f => {
    const full = path.join(sessionDir, f);
    return fs.statSync(full).isDirectory();
  });
}

function main() {
  if (!VAULT_PATH) {
    console.error('Error: OBSIDIAN_VAULT_PATH not set');
    process.exit(1);
  }

  const projects = TARGET_PROJECT ? [TARGET_PROJECT] : getProjects();

  if (projects.length === 0) {
    console.log('No projects found for GC');
    return;
  }

  console.log(`GC running for ${projects.length} project(s)${DRY_RUN ? ' (DRY RUN)' : ''}`);

  for (const project of projects) {
    console.log(`\n### ${project}`);
    archiveSessions(project);
    cleanLearnings(project);
  }

  console.log(`\nGC complete.`);
}

main();
