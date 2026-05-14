/**
 * OC-Obsidian-MCP: Auto-Tag Detection
 *
 * Two-tier tagging system:
 *   1. Fixed vocabulary — keyword/regex based
 *   2. Free-form — any #hashtag already in the text
 *
 * Zero dependencies — built-in Node.js only.
 */

const FIXED_VOCAB = {
  '#bug':      /\b(bug|bugfix|fix|error|issue|crash|leak|exception|broken|regression|hotfix|patch)\b/,
  '#pattern':  /\b(pattern|technique|approach|idiom|reusable|template|recipe|howto|workflow)\b/,
  '#config':   /\b(config|configuration|setting|env|yaml|json|ini|dockerfile|manifest|dotfile)\b/,
  '#api':      /\b(api|endpoint|rest|graphql|route|controller|handler|sdk|client|openapi|swagger)\b/,
  '#testing':  /\b(test|spec|jest|mocha|pytest|vitest|cypress|playwright|coverage|mock|stub|tdd|bdd)\b/,
  '#architecture': /\b(architecture|design|struct(ure)?|layer|component|module|service|repository|pattern)\b/,
  '#security': /\b(security|auth|oauth|jwt|csrf|xss|injection|encrypt|hash|sanitize|vulnerability|cve)\b/,
  '#performance': /\b(performance|slow|fast|cache|optimize|memory|cpu|latency|throughput|bottleneck)\b/,
};

function detectTags(title, body = '') {
  const text = (title + ' ' + body).toLowerCase();
  const fixed = [];

  for (const [tag, regex] of Object.entries(FIXED_VOCAB)) {
    if (regex.test(text)) fixed.push(tag);
  }

  // Free-form: any #hashtag in the text
  const free = [];
  const hashtagRegex = /#[a-zA-Z0-9_-]+/g;
  const hashtags = text.match(hashtagRegex) || [];
  for (const tag of hashtags) {
    // Deduplicate against fixed
    if (!fixed.includes(tag)) free.push(tag);
  }

  // Also add hashtags from the raw body (case preserved for display, but dedup via lowercase)
  const rawFree = [];
  const rawBody = String(body || '');
  const rawHashtags = rawBody.match(/#[a-zA-Z0-9_-]+/g) || [];
  for (const tag of rawHashtags) {
    if (!fixed.includes(tag.toLowerCase()) && !free.includes(tag.toLowerCase())) {
      rawFree.push(tag);
    }
  }

  return {
    fixed,
    free: rawFree.length > 0 ? rawFree : free,
    all: [...fixed, ...(rawFree.length > 0 ? rawFree : free)],
  };
}

/** Infer type from content (extends existing detectType in remember.js) */
function detectType(title, body = '') {
  const text = (title + ' ' + body).toLowerCase();
  if (/\b(bug|crash|leak|error|regression|broken)\b/.test(text)) return 'Bugfix';
  if (/\b(security|auth|oauth|jwt|encrypt)\b/.test(text)) return 'Security';
  if (/\b(refactor|pattern|muster|idiom|technique)\b/.test(text)) return 'Pattern';
  if (/\b(architektur|architecture|design|struct)\b/.test(text)) return 'Architecture';
  if (/\b(test|spec|jest|mocha|pytest)\b/.test(text)) return 'Testing';
  if (text.includes('```') || /\b(code|snippet|function|class|method)\b/.test(text)) return 'Code-Snippet';
  if (/\b(config|setting|env|setup|dockerfile)\b/.test(text)) return 'Configuration';
  return 'Pattern';
}

/** Simple importance grading */
function detectImportance(title, body = '') {
  const text = (title + ' ' + body).toLowerCase();
  if (/\b(critical|security|production|data loss|outage|breach|urgent)\b/.test(text)) return 'high';
  if (/\b(nice-to-have|optional|minor|cosmetic)\b/.test(text)) return 'low';
  return 'medium';
}

module.exports = { detectTags, detectType, detectImportance, FIXED_VOCAB };
