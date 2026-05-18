/**
 * OC-Obsidian-MCP: Simple English Stemmer
 *
 * Ultra-light suffix stripping for English words.
 * No Porter Stemmer complexity — just the 80/20 rule.
 *
 * Rules applied in order (most specific first):
 *   1. '-ies'      → 'y'     (copies → copy)
 *   2. '-ied'      → 'y'     (tried → try)
 *   3. '-ying'     → 'ie'    (tying → tie) — handled via regex
 *   4. '-ing'      → ''      (running → run)
 *   5. '-ly'       → ''      (quickly → quick)
 *   6. '-ed'       → ''      (tested → test)
 *   7. '-ies' (already handled) / '-es' → '' (boxes → box, catches → catch)
 *   8. '-s'        → ''      (dogs → dog) — NOT for -ss, -us, -is
 */

const MIN_LENGTH = 3;

function stem(word) {
  if (!word || word.length < MIN_LENGTH) {return word;}
  const w = word.toLowerCase();

  // Rule 1: -ies → -y
  if (w.endsWith('ies')) {
    const base = w.slice(0, -3);
    if (base.length >= 1) {return base + 'y';}
  }

  // Rule 2: -ied → -y
  if (w.endsWith('ied')) {
    const base = w.slice(0, -3);
    if (base.length >= 1) {return base + 'y';}
  }

  // Rule 3: -ying → -ie handled in -ing below

  // Rule 4: -ing (but preserve -ring,-sing,-ting as stem if short)
  if (w.endsWith('ing')) {
    const base = w.slice(0, -3);
    if (base.length >= 2) {
      // handle "-ying" → "-ie" (tying → tie)
      if (base.endsWith('y')) {return base.slice(0, -1) + 'ie';}
      // handle consonant doubling: running → run, stopping → stop
      if (base.length > 2 && isDuplicateConsonant(base)) {
        return base.slice(0, -1);
      }
      return base;
    }
  }

  // Rule 5: -ly
  if (w.endsWith('ly')) {
    const base = w.slice(0, -2);
    if (base.length >= 2) {return base;}
  }

  // Rule 6: -ed
  if (w.endsWith('ed')) {
    const base = w.slice(0, -2);
    if (base.length >= 2) {
      if (isDuplicateConsonant(base)) {return base.slice(0, -1);}
      return base;
    }
  }

  // Rule 7: -es (catches, boxes)
  if (w.endsWith('es')) {
    const base = w.slice(0, -2);
    if (base.length >= 2) {
      // if stem ends in s,x,z,ch,sh keep 'e': boxes → box
      if (base.endsWith('x') || base.endsWith('sh') || base.endsWith('ch') || base.endsWith('z')) {
        return base;
      }
      // otherwise strip 'es' entirely
      return base;
    }
  }

  // Rule 8: -s (plural)
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && !w.endsWith('is')) {
    const base = w.slice(0, -1);
    if (base.length >= 2) {return base;}
  }

  return w;
}

function isDuplicateConsonant(base) {
  if (base.length < 2) {return false;}
  const last = base[base.length - 1];
  const prev = base[base.length - 2];
  return last === prev && !'aeiou'.includes(last);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .normalize('NFD') // split diacritics
    .replace(/\p{Diacritic}/gu, '') // strip accents/umlauts
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // remove remaining punctuation
    .split(/\s+/)
    .filter(w => w.length >= 2)
    .map(stem);
}

module.exports = { stem, tokenize };
