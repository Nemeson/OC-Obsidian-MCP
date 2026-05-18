/**
 * OC-Obsidian-MCP: Semantic Conflict Detection (v2.5)
 *
 * Detects contradictory learnings via simple NLP heuristics:
 *   - Negation keyword pairs (never vs always, don't vs do)
 *   - Topic overlap via keyword intersection
 *   - Sentiment polarity on shared topics
 *
 * Zero dependencies — pure Node.js.
 */

const { tokenize } = require('./stemmer');

const NEGATE_PAIRS = [
  { neg: /\b(never|don't|do not|avoid|dont|shouldn't|mustn't)\b/, pos: /\b(always|do|use|should|must|should use)\b/ },
  { neg: /\b(no|not|disable|off|without)\b/, pos: /\b(yes|enable|on|with|required)\b/ },
];

const IMPORTANCE_WEIGHT = { high: 1.0, medium: 0.7, low: 0.4 };

/**
 * Check if two learnings are semantically conflicting.
 * @returns {Object|null} conflict info or null
 */
function detectConflict(aTitle, aBody, bTitle, bBody, aFm = {}, bFm = {}) {
  const aText = (aTitle + ' ' + (aBody || '')).toLowerCase();
  const bText = (bTitle + ' ' + (bBody || '')).toLowerCase();

  // 1. Topic overlap: at least 2 shared significant words
  const aTokens = new Set(tokenize(aText).filter(t => t.length > 3));
  const bTokens = new Set(tokenize(bText).filter(t => t.length > 3));
  const shared = [...aTokens].filter(t => bTokens.has(t));
  if (shared.length < 2) {return null;} // unrelated topics

  // 2. Check negation pairs
  for (const { neg, pos } of NEGATE_PAIRS) {
    const aNeg = neg.test(aText);
    const aPos = pos.test(aText);
    const bNeg = neg.test(bText);
    const bPos = pos.test(bText);

    // One says "do X", other says "don't do X" on same topic
    if ((aPos && bNeg) || (aNeg && bPos)) {
      const aImp = IMPORTANCE_WEIGHT[aFm.importance] || 0.7;
      const bImp = IMPORTANCE_WEIGHT[bFm.importance] || 0.7;
      const severity = (aImp + bImp) / 2;
      return {
        type: 'negation_conflict',
        severity: severity >= 0.85 ? 'high' : severity >= 0.6 ? 'medium' : 'low',
        shared_topics: shared.slice(0, 5),
        evidence: { a_polarity: aPos ? 'positive' : 'negative', b_polarity: bPos ? 'positive' : 'negative' },
      };
    }
  }

  // 3. Contradiction via recommendation reversal (shallow heuristic)
  const aRec = extractRecommendations(aText);
  const bRec = extractRecommendations(bText);
  for (const rec of aRec) {
    const reversed = bRec.find(r => r.action === rec.action && r.polarity !== rec.polarity);
    if (reversed) {
      return {
        type: 'recommendation_conflict',
        severity: 'medium',
        shared_topics: shared.slice(0, 5),
        evidence: { a: rec.phrase, b: reversed.phrase },
      };
    }
  }

  return null;
}

function extractRecommendations(text) {
  const recs = [];
  const patterns = [
    /(?:use|prefer|choose|adopt|implement)\s+([a-z\s]+?)(?:\.|,|;|\n)/g,
    /(?:avoid|don't use|never use|skip|disable)\s+([a-z\s]+?)(?:\.|,|;|\n)/g,
  ];
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const phrase = m[0].trim();
      const polarity = /avoid|don't|never|skip|disable/.test(phrase) ? 'negative' : 'positive';
      const action = m[1].trim().slice(0, 20);
      recs.push({ phrase, polarity, action });
    }
  }
  return recs;
}

module.exports = { detectConflict, extractRecommendations };
