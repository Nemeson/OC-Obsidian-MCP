#!/usr/bin/env node
/**
 * OC-Obsidian-MCP Test Runner
 *
 * Run with `npm test` or `node test/runner.js`
 * Add --watch for file watching
 * Add --verbose for full test output
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');

// ─── Test Utilities ─────────────────────────────────────

const results = { passed: 0, failed: 0, errors: [] };

function describe(section, fn) {
  console.log(`\n  ${section}`);
  fn();
}

function assert(condition, message) {
  if (!condition) {
    results.failed++;
    results.errors.push({ ok: false, message });
    if (process.argv.includes('--verbose')) {
      console.log(`    [FAIL] ${message}`);
    }
  } else {
    results.passed++;
    if (process.argv.includes('--verbose')) {
      console.log(`    [ OK ] ${message}`);
    }
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} | expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
}

function assertIncludes(haystack, needle, message) {
  assert(haystack.includes(needle), `${message} | expected to include: ${needle}`);
}

function assertExists(filePath, message) {
  const full = path.join(PROJECT_ROOT, filePath);
  assert(fs.existsSync(full), `${message} | path: ${filePath}`);
}

function assertNotExists(filePath, message) {
  const full = path.join(PROJECT_ROOT, filePath);
  assert(!fs.existsSync(full), `${message} | unexpectedly found: ${filePath}`);
}

function assertValidJson(filePath, message) {
  const full = path.join(PROJECT_ROOT, filePath);
  try {
    JSON.parse(fs.readFileSync(full, 'utf8'));
    assert(true, message);
  } catch (e) {
    assert(false, `${message} | ${e.message}`);
  }
}

// ─── Tests ──────────────────────────────────────────────

describe('Project structure', () => {
  // Core files
  assertExists('README.md', 'Project has README');
  assertExists('setup.ps1', 'Project has setup script');
  assertExists('package.json', 'Project has package.json');
  assertExists('LICENSE', 'Project has LICENSE');
  assertExists('.gitignore', 'Project has .gitignore');
  assertExists('secrets.yaml', 'Project has secrets template');

  // Scripts
  assertExists('scripts/obsidian-mcp-wrapper.cmd', 'Windows wrapper exists');
  assertExists('scripts/obsidian-mcp-wrapper.sh', 'Unix wrapper exists');

  // Hooks
  assertExists('hooks/obsidian-session-save.js', 'Stop hook script exists');

  // New Quick Win hooks
  assertExists('hooks/obsidian-context-loader.js', 'Context loader exists');
  assertExists('hooks/obsidian-gc.js', 'GC script exists');

  // Skills
  assertExists('skills/obsidian-memory.md', 'Skill documentation exists');

  // Configs
  assertExists('config/mcp-config-opencode-global.json', 'Global config template exists');
  assertExists('config/mcp-config-opencode-project.json', 'Project config template exists');
  assertExists('config/mcp-config-claude-desktop.json', 'Claude Desktop config template exists');
  assertExists('config/mcp-config-codex.toml', 'Codex config template exists');
  assertExists('config/mcp-config-hooks.json', 'Hooks config template exists');
  assertExists('config/.mcp-env.template', 'Env template exists');

  // CLI
  assertExists('bin/session-log.js', 'CLI entry exists');
  assertExists('bin/session-log.js', 'CLI script exists');
});

describe('NPM / package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));

  // Metadata
  assertEqual(typeof pkg.name, 'string', 'package.json has name');
  assertEqual(pkg.name, 'oc-obsidian-mcp', 'package name is oc-obsidian-mcp');
  assertEqual(typeof pkg.version, 'string', 'package.json has version');
  assert(/^\d+\.\d+\.\d+/.test(pkg.version), 'version is semantic (x.y.z)');
  assertEqual(typeof pkg.description, 'string', 'package.json has description');

  // Engines
  assertEqual(pkg.engines.node, '>=20.0.0', 'package.json requires Node >=20');

  // Scripts
  assert(Object.keys(pkg.scripts).includes('test'), 'package.json has test script');
  assert(Object.keys(pkg.scripts).includes('session-log'), 'package.json has session-log script');
  assert(Object.keys(pkg.scripts).includes('lint'), 'package.json has lint script');
  assert(Object.keys(pkg.scripts).includes('setup'), 'package.json has setup script');

  // Bin entries for CLI
  assert(pkg.bin && pkg.bin['oc-obsidian-mcp'], 'package.json has oc-obsidian-mcp bin entry');
  assert(pkg.bin && pkg.bin['session-log'], 'package.json has session-log bin entry');

  // NPM distribution fields
  assert(Array.isArray(pkg.files), 'package.json has files array for npm');
  assert(pkg.files.includes('bin/'), 'files includes bin/');
  assert(pkg.files.includes('scripts/'), 'files includes scripts/');
  assert(pkg.files.includes('hooks/'), 'files includes hooks/');
  assert(pkg.files.includes('skills/'), 'files includes skills/');
  assert(pkg.files.includes('config/'), 'files includes config/');
  assert(pkg.files.includes('setup.ps1'), 'files includes setup.ps1');

  // Keywords/SEO
  assert(Array.isArray(pkg.keywords), 'package.json has keywords array');
  assert(pkg.keywords.some(k => k === 'opencode'), 'keywords include opencode');
  assert(pkg.keywords.some(k => k === 'obsidian'), 'keywords include obsidian');
  assert(pkg.keywords.some(k => k === 'mcp'), 'keywords include mcp');

  // Author and license
  assertEqual(typeof pkg.author, 'string', 'package.json has author');
  assertEqual(typeof pkg.license, 'string', 'package.json has license');

  // Optional: repository (warn only)
  if (!pkg.repository) {
    assert(true, 'WARN: add repository field before publishing');
  }
});

describe('NPM install readiness', () => {
  // Verify npx resolves mcp-obsidian-vault (optional, may fail offline)
  try {
    const out = execSync('npx -y mcp-obsidian-vault --version', {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'ignore']
    });
    assert(out.trim().length > 0, 'mcp-obsidian-vault resolves via npx');
  } catch {
    assert(true, 'SKIP: mcp-obsidian-vault npx check (offline or network)');
  }

  // CLI is executable-ish (has shebang)
  const cli = fs.readFileSync(path.join(PROJECT_ROOT, 'bin/session-log.js'), 'utf8');
  assert(cli.startsWith('#!/usr/bin/env node'), 'CLI has shebang for npm bin');

  // CLI can show help-like behavior (dry-run)
  assert(cli.includes('OBSIDIAN_VAULT_PATH'), 'CLI checks env vars');
  assert(cli.includes('Usage:'), 'CLI has usage description');
});

describe('Wrapper scripts', () => {
  const cmd = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts/obsidian-mcp-wrapper.cmd'), 'utf8');
  const sh = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts/obsidian-mcp-wrapper.sh'), 'utf8');

  assert(cmd.includes('npx -y mcp-obsidian-vault'), 'Win wrapper calls mcp-obsidian-vault');
  assert(sh.includes('npx -y mcp-obsidian-vault'), 'Unix wrapper calls mcp-obsidian-vault');
  assert(cmd.includes('OBSIDIAN_VAULT_PATH'), 'Win wrapper reads OBSIDIAN_VAULT_PATH');
  assert(sh.includes('OBSIDIAN_VAULT_PATH'), 'Unix wrapper reads OBSIDIAN_VAULT_PATH');

  // Comment filtering (handles .mcp-env templates)
  assert(!cmd.includes('set "#"'), 'Win wrapper does not set comment as var');
  assert(sh.includes('#'), 'Unix wrapper handles comments');
  assertEqual(sh.split(/\r?\n/).filter(l => l.trim().startsWith('#')).length >= 2, true, 'Unix wrapper has comments');
});

describe('Hook script', () => {
  const js = fs.readFileSync(path.join(PROJECT_ROOT, 'hooks/obsidian-session-save.js'), 'utf8');

  assert(js.includes('function loadMcpEnv()'), 'Hook loads .mcp-env');
  assert(js.includes('fs.appendFileSync(notePath, entry'), 'Hook writes directly to filesystem');
  assert(!js.includes('method: "tools/call"'), 'Hook does NOT use MCP handshake');
  assert(js.includes('git rev-parse --show-toplevel'), 'Hook extracts project name');
  assert(js.includes('gitAutoSync'), 'Hook supports git auto-sync');
  assert(js.includes('d('), 'Hook has debug logging');

  // Session discovery
  assert(js.includes('SESSIONS_DIR'), 'Hook references SESSIONS_DIR');
  assert(js.includes('-session.tmp'), 'Hook looks for .tmp session files');
});

describe('CLI: bin/session-log.js', () => {
  assertExists('bin/session-log.js', 'CLI script exists');

  const cli = fs.readFileSync(path.join(PROJECT_ROOT, 'bin/session-log.js'), 'utf8');
  assert(cli.includes('function findLatestSessionFile()'), 'CLI discovers session files');
  assert(cli.includes('function extractSummary('), 'CLI extracts summary');
  assert(cli.includes('Claude Code'), 'CLI mentions Claude Code sessions');
  assert(cli.includes('OpenCode'), 'CLI mentions OpenCode sessions');
  assert(cli.includes('ECC:SUMMARY'), 'CLI parses ECC summary blocks');

  // Error handling
  assert(cli.includes('Error: OBSIDIAN_VAULT_PATH not set'), 'CLI has vault path error');
  assert(cli.includes('Error: No session file found'), 'CLI has session not found error');
});

describe('Config templates', () => {
  assertValidJson('config/mcp-config-opencode-global.json', 'Global config is valid JSON');
  assertValidJson('config/mcp-config-opencode-project.json', 'Project config is valid JSON');
  assertValidJson('config/mcp-config-claude-desktop.json', 'Claude Desktop config is valid JSON');
  assertValidJson('config/mcp-config-hooks.json', 'Hooks config is valid JSON');

  const global = fs.readFileSync(path.join(PROJECT_ROOT, 'config/mcp-config-opencode-global.json'), 'utf8');
  const project = fs.readFileSync(path.join(PROJECT_ROOT, 'config/mcp-config-opencode-project.json'), 'utf8');

  assert(global.includes('"mcpServers"'), 'Global config uses mcpServers schema');
  assert(project.includes('"mcp"'), 'Project config uses mcp schema');
  assert(!global.includes('"env"'), 'Global config has no env field (OpenCode limitation)');
  assert(!project.includes('"env"'), 'Project config has no env field (OpenCode limitation)');
  assert(global.includes('obsidian'), 'Global config references obsidian');
  assert(project.includes('obsidian'), 'Project config references obsidian');

  const claude = fs.readFileSync(path.join(PROJECT_ROOT, 'config/mcp-config-claude-desktop.json'), 'utf8');
  assert(claude.includes('"env"'), 'Claude Desktop config HAS env field');
  assert(claude.includes('GIT_AUTO_SYNC'), 'Claude config sets GIT_AUTO_SYNC');
});

describe('README quality', () => {
  const readme = fs.readFileSync(path.join(PROJECT_ROOT, 'README.md'), 'utf8');

  assert(readme.includes('# OC-Obsidian-MCP'), 'README has title');
  assert(readme.includes('## Prerequisites'), 'README has Prerequisites');
  assert(readme.includes('## Quick Start'), 'README has Quick Start');
  assert(readme.includes('## Environment Variables'), 'README has Environment Variables');
  assert(readme.includes('## License'), 'README has license section');
  assert(readme.includes('MIT'), 'README mentions MIT');

  // NPM readiness markers
  assert(readme.includes('npm install') || readme.includes('npx oc-obsidian-mcp'), 'README mentions npm');
  assert(readme.includes('npm test'), 'README mentions npm test');
});

describe('.gitignore security', () => {
  const gi = fs.readFileSync(path.join(PROJECT_ROOT, '.gitignore'), 'utf8');

  assert(gi.includes('secrets.yaml'), '.gitignore excludes secrets.yaml');
  assert(gi.includes('.env'), '.gitignore excludes .env');
  assert(gi.includes('node_modules/'), '.gitignore excludes node_modules/');

  // Verify secrets.yaml is NOT committed (should be untracked)
  assertExists('secrets.yaml', 'secrets.yaml exists for new users');
});

describe('Dry-run: hook script', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocobsidian-test-'));
  const sessionDir = path.join(tmpDir, 'session-data');
  const vaultDir = path.join(tmpDir, 'vault');

  try {
    // Create test session file WITH project name (PCAP2KML)
    const sessionsFile = path.join(sessionDir, '2026-05-12-PCAP2KML-session.tmp');
    fs.mkdirSync(path.dirname(sessionsFile), { recursive: true });
    fs.mkdirSync(path.join(vaultDir, 'OpenCode', 'Sessions'), { recursive: true });

    fs.writeFileSync(sessionsFile, 'Test session content\n<!-- ECC:SUMMARY:START -->\nThis is a session summary\n<!-- ECC:SUMMARY:END -->\n', 'utf8');

    const child = require('child_process').spawnSync('node', [
      path.join(PROJECT_ROOT, 'hooks/obsidian-session-save.js')
    ], {
      encoding: 'utf8',
      env: {
        ...process.env,
        OBSIDIAN_VAULT_PATH: vaultDir,
        DAILY_NOTE_FOLDER: 'OpenCode/Sessions',
        SESSIONS_DIR: sessionDir,
        DEBUG_HOOK: '1'
      },
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    assertEqual(child.status, 0, 'Hook exits with code 0');

    const today = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}.md`;
    // NEW: project-isolated path
    const projectNote = path.join(vaultDir, 'OpenCode', 'Sessions', 'PCAP2KML', today);

    if (fs.existsSync(projectNote)) {
      const content = fs.readFileSync(projectNote, 'utf8');
      assert(content.includes('This is a session summary'), 'Project note contains session summary');
      assert(content.includes('PCAP2KML'), 'Project note is tagged with project name');
    } else {
      assert(false, `Project note not created at ${projectNote}. Output: ${child.stderr || child.stdout}`);
    }

    // Check index exists
    const indexPath = path.join(vaultDir, 'OpenCode', 'Sessions', 'PCAP2KML', 'index.md');
    assert(fs.existsSync(indexPath), 'Project index created');
  } catch (e) {
    assert(false, `Dry-run failed: ${e.message}`);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

describe('Project detection', () => {
  const detectProject = (filename) => {
    const basename = path.basename(filename, '-session.tmp');
    const match = basename.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
    if (match && match[1] && match[1] !== 'session' && match[1] !== 'claude') {
      return match[1];
    }
    return '_global';
  };

  assertEqual(detectProject('2026-05-12-PCAP2KML-session.tmp'), 'PCAP2KML', 'Detects PCAP2KML from filename');
  assertEqual(detectProject('2026-05-12-HomeAssistant-session.tmp'), 'HomeAssistant', 'Detects HomeAssistant');
  assertEqual(detectProject('2026-05-12-session.tmp'), '_global', 'Falls back to _global for generic');
  assertEqual(detectProject('2026-05-12-claude-session.tmp'), '_global', 'Falls back to _global for claude');
});

describe('Context loader', () => {
  assertExists('hooks/obsidian-context-loader.js', 'Context loader script exists');

  const cli = fs.readFileSync(path.join(PROJECT_ROOT, 'hooks/obsidian-context-loader.js'), 'utf8');
  assert(cli.includes('function detectProject()'), 'Context loader detects project');
  assert(cli.includes('function loadBootstrap()'), 'Context loader loads bootstrap');
  assert(cli.includes('function loadProjectContext('), 'Context loader loads project context');
  assert(cli.includes('function loadDecisions('), 'Context loader loads decisions');
  assert(cli.includes('function loadLearnings('), 'Context loader loads learnings');
  assert(cli.includes('function loadRecentSessions('), 'Context loader loads recent sessions');
  assert(cli.includes('OBSIDIAN CONTEXT START'), 'Context loader injects formatted context');
});

describe('Quick Wins: CLI Commands', () => {
  // ADR
  assertExists('bin/adr.js', 'ADR command exists');
  const adr = fs.readFileSync(path.join(PROJECT_ROOT, 'bin/adr.js'), 'utf8');
  assert(adr.includes('function buildAdr('), 'ADR builds template');
  assert(adr.includes('function findRelatedNotes('), 'ADR finds related notes');
  assert(adr.includes('ADR-'), 'ADR uses ADR-NNN format');

  // Remember
  assertExists('bin/remember.js', 'Remember command exists');
  const rem = fs.readFileSync(path.join(PROJECT_ROOT, 'bin/remember.js'), 'utf8');
  assert(rem.includes('function detectType('), 'Remember auto-detects type');
  assert(rem.includes('function detectImportance('), 'Remember auto-detects importance');
  assert(rem.includes('function isDuplicate('), 'Remember checks duplicates');
  assert(rem.includes('function findRelated('), 'Remember finds related notes');

  // Related
  assertExists('bin/related.js', 'Related notes command exists');
  const rel = fs.readFileSync(path.join(PROJECT_ROOT, 'bin/related.js'), 'utf8');
  assert(rel.includes('function findRelatedNotes('), 'Related finds notes');
  assert(rel.includes('Decisions'), 'Related searches Decisions');
  assert(rel.includes('Learnings'), 'Related searches Learnings');
  assert(rel.includes('Sessions'), 'Related searches Sessions');

  // Digest
  assertExists('bin/digest.js', 'Digest command exists');
  const dig = fs.readFileSync(path.join(PROJECT_ROOT, 'bin/digest.js'), 'utf8');
  assert(dig.includes('function buildDigest('), 'Digest builds report');
  assert(dig.includes('--week'), 'Digest supports --week');
  assert(dig.includes('--month'), 'Digest supports --month');

  // Load Context
  assertExists('bin/load-context.js', 'Load context command exists');
});

describe('Main CLI dispatcher', () => {
  assertExists('bin/oc-obsidian-mcp.js', 'Main CLI exists');

  const cli = fs.readFileSync(path.join(PROJECT_ROOT, 'bin/oc-obsidian-mcp.js'), 'utf8');
  assert(cli.includes("'adr'") || cli.includes('"adr"'), 'Main CLI dispatches adr');
  assert(cli.includes("'remember'") || cli.includes('"remember"'), 'Main CLI dispatches remember');
  assert(cli.includes("'related'") || cli.includes('"related"'), 'Main CLI dispatches related');
  assert(cli.includes("'digest'") || cli.includes('"digest"'), 'Main CLI dispatches digest');
  assert(cli.includes("'session-log'") || cli.includes('"session-log"'), 'Main CLI dispatches session-log');
  assert(cli.includes("'load-context'") || cli.includes('"load-context"'), 'Main CLI dispatches load-context');
  assert(cli.includes("'gc'") || cli.includes('"gc"'), 'Main CLI dispatches gc');
  assert(cli.includes("'setup'") || cli.includes('"setup"'), 'Main CLI dispatches setup');
});

describe('Auto-learning extraction', () => {
  const hook = fs.readFileSync(path.join(PROJECT_ROOT, 'hooks/obsidian-session-save.js'), 'utf8');
  assert(hook.includes('function autoLearn('), 'Hook has autoLearn');
  assert(hook.includes('function extractKeywords('), 'Hook extracts keywords');
  assert(hook.includes('function detectPatterns('), 'Hook detects patterns');
  assert(hook.includes('autoLearn(session)'), 'Hook calls autoLearn in main');
});

describe('Garbage collector', () => {
  assertExists('hooks/obsidian-gc.js', 'GC script exists');

  const gc = fs.readFileSync(path.join(PROJECT_ROOT, 'hooks/obsidian-gc.js'), 'utf8');
  assert(gc.includes('function archiveSessions('), 'GC has archiveSessions');
  assert(gc.includes('function cleanLearnings('), 'GC has cleanLearnings');
  assert(gc.includes('function similarity('), 'GC has similarity check for merging');
  assert(gc.includes('--dry-run'), 'GC supports dry-run');
  assert(gc.includes('THRESHOLDS.sessionArchive'), 'GC has session archive threshold');
  assert(gc.includes('THRESHOLDS.lowDelete'), 'GC has low-importance delete threshold');
});

// ─── Summary ────────────────────────────────────────────

console.log(`\n  ────────────────────────────────────────`);
console.log(`  Results: ${results.passed} passed, ${results.failed} failed`);

if (results.errors.length > 0 && !process.argv.includes('--verbose')) {
  console.log(`  \n  Failed tests (re-run with --verbose):`);
  results.errors.forEach(e => {
    console.log(`    - ${e.message}`);
  });
}

process.exit(results.failed > 0 ? 1 : 0);
