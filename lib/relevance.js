/**
 * OC-Obsidian-MCP: Relevance Scoring
 *
 * Computes relevance boost from:
 *   - Recency (how fresh / recently used)
 *   - Reuse frequency (how often referenced)
 *
 * Also provides `trackUsage()` to increment counters in frontmatter.
 *
 * Zero dependencies — built-in Node.js only.
 */

const fs = require('fs');

const MAX_REUSE_CAP = 20;
const RECENCY_HALF_LIFE_DAYS = 30;
const STALE_PENALTY_DAYS = 90;

function getDate() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

function parseDate(str) {
  if (!str) return 0;
  const ts = Date.parse(str);
  return isNaN(ts) ? 0 : ts;
}

/**
 * Compute a 0-1 relevance boost.
 * @param {Object} meta  Frontmatter fields ({ reuse_count, last_used, created })
 * @returns {number} 0.0 - 1.0
 */
function computeRelevanceBoost(meta) {
  const now = Date.now();
  const lastUsed = parseDate(meta.last_used) || parseDate(meta.created) || now;
  const daysSinceUse = (now - lastUsed) / (1000 * 60 * 60 * 24);

  // Recency: exponential decay with 30-day half-life
  const recency = Math.exp(-0.693 * daysSinceUse / RECENCY_HALF_LIFE_DAYS);

  // Reuse: linear, capped at MAX_REUSE_CAP
  const reuseRaw = Number(meta.reuse_count) || 0;
  const reuse = Math.min(1, reuseRaw / MAX_REUSE_CAP);

  // Stale penalty: if older than STALE_PENALTY_DAYS, apply linear penalty
  let stalePenalty = 0;
  if (daysSinceUse > STALE_PENALTY_DAYS) {
    stalePenalty = Math.min(0.3, (daysSinceUse - STALE_PENALTY_DAYS) / 300); // max -0.3
  }

  // Combine: 50% recency, 50% reuse, minus stale penalty
  return Math.max(0, 0.5 * recency + 0.5 * reuse - stalePenalty);
}

/**
 * Increment reuse_count and set last_used on a note file.
 * @param {string} filePath  Absolute path to .md file
 * @returns {boolean} true on success
 */
function trackUsage(filePath) {
  if (!fs.existsSync(filePath)) return false;

  let content = fs.readFileSync(filePath, 'utf8');
  const today = getDate();

  // Parse frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fmMatch) return false;

  const fmRaw = fmMatch[1];
  const rest = content.slice(fmMatch[0].length);

  // Update reuse_count
  const countMatch = fmRaw.match(/reuse_count:\s*(\d+)/);
  const newCount = countMatch ? parseInt(countMatch[1], 10) + 1 : 1;

  // Update last_used
  const hasLastUsed = /last_used:/.test(fmRaw);

  let newFm;
  if (hasLastUsed) {
    newFm = fmRaw.replace(/last_used:\s*[^\n]+/, `last_used: ${today}`);
  } else {
    newFm = fmRaw.trimEnd() + `\nlast_used: ${today}`;
  }

  if (countMatch) {
    newFm = newFm.replace(/reuse_count:\s*\d+/, `reuse_count: ${newCount}`);
  } else {
    newFm = newFm.trimEnd() + `\nreuse_count: ${newCount}`;
  }

  const newContent = `---\n${newFm}\n---\n${rest}`;
  fs.writeFileSync(filePath, newContent, 'utf8');
  return true;
}

/**
 * Ensure frontmatter has relevance fields with defaults.
 * Used when creating new notes.
 */
function initRelevance(frontmatter) {
  return {
    reuse_count: 1,
    last_used: getDate(),
    ...frontmatter,
  };
}

module.exports = {
  computeRelevanceBoost,
  trackUsage,
  initRelevance,
  getDate,
  parseDate,
};
