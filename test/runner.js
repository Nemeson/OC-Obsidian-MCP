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

const TESTS_RUN = Symbol('tests-run');
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
  // Non-verbose: show nothing per-test
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} | expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`);
}

function assertExists(filePath, message) {
  const full = path.join(PROJECT_ROOT, filePath);
  assert(fs.existsSync(full), `${message} | path: ${filePath}`);
}

// ─── Tests ──────────────────────────────────────────────

describe('File existence', () => {
  const required = [
    'README.md',
    'setup.ps1',
    'package.json',
    'LICENSE',
    '.gitignore',
    'scripts/obsidian-mcp-wrapper.cmd',
    'scripts/obsidian-mcp-wrapper.sh',
    'hooks/obsidian-session-save.js',
    'skills/obsidian-memory.md',
    'config/mcp-config-opencode-global.json',
    'config/mcp-config-opencode-project.json',
    'config/mcp-config-claude-desktop.json',
    'config/mcp-config-codex.toml',
    'config/mcp-config-hooks.json',
    'config/.mcp-env.template',
  ];
  required.forEach(f => assertExists(f, `Required file: ${f}`));
});

describe('Wrapper scripts', () => {
  const cmd = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts/obsidian-mcp-wrapper.cmd'), 'utf8');
  const sh = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts/obsidian-mcp-wrapper.sh'), 'utf8');

  assert(cmd.includes('npx -y mcp-obsidian-vault'), 'Win wrapper calls mcp-obsidian-vault');
  assert(sh.includes('npx -y mcp-obsidian-vault'), 'Unix wrapper calls mcp-obsidian-vault');
  assert(cmd.includes('OBSIDIAN_VAULT_PATH'), 'Win wrapper reads OBSIDIAN_VAULT_PATH');
  assert(sh.includes('OBSIDIAN_VAULT_PATH'), 'Unix wrapper reads OBSIDIAN_VAULT_PATH');
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
});

describe('Config templates', () => {
  const global = fs.readFileSync(path.join(PROJECT_ROOT, 'config/mcp-config-opencode-global.json'), 'utf8');
  const project = fs.readFileSync(path.join(PROJECT_ROOT, 'config/mcp-config-opencode-project.json'), 'utf8');

  assert(global.includes('"mcpServers"'), 'Global config uses mcpServers schema');
  assert(project.includes('"mcp"'), 'Project config uses mcp schema');
  assert(!global.includes('env'), 'Global config has no env field (OpenCode limitation)');
  assert(!project.includes('env'), 'Project config has no env field (OpenCode limitation)');
  assert(global.includes('obsidian'), 'Global config references obsidian');
  assert(project.includes('obsidian'), 'Project config references obsidian');

  const claude = fs.readFileSync(path.join(PROJECT_ROOT, 'config/mcp-config-claude-desktop.json'), 'utf8');
  assert(claude.includes('env'), 'Claude Desktop config HAS env field');
  assert(claude.includes('GIT_AUTO_SYNC'), 'Claude config sets GIT_AUTO_SYNC');
});

describe('README', () => {
  const readme = fs.readFileSync(path.join(PROJECT_ROOT, 'README.md'), 'utf8');

  assert(readme.includes('# OC-Obsidian-MCP'), 'README has title');
  assert(readme.includes('## Prerequisites'), 'README has Prerequisites');
  assert(readme.includes('## Quick Start'), 'README has Quick Start');
  assert(readme.includes('## Environment Variables'), 'README has Environment Variables');
  assert(readme.includes('## License'), 'README has license section');
  assert(readme.includes('MIT'), 'README mentions MIT');
});

describe('Package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));

  assertEqual(typeof pkg.name, 'string', 'package.json has name');
  assertEqual(typeof pkg.version, 'string', 'package.json has version');
  assertEqual(pkg.engines.node, '>=20.0.0', 'package.json requires Node >=20');
  assert(Object.keys(pkg.scripts).includes('test'), 'package.json has test script');
});

describe('Dry-run: hook script', () => {
  // Create a temp vault and test the hook
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocobsidian-test-'));
  const sessionDir = path.join(tmpDir, 'session-data');
  const vaultDir = path.join(tmpDir, 'vault');
  const sessionsDir = path.join(sessionDir, '2026-05-12-session.tmp');

  try {
    // Create test session file
    fs.mkdirSync(path.dirname(sessionsDir), { recursive: true });
    fs.mkdirSync(path.join(vaultDir, 'OpenCode', 'Sessions'), { recursive: true });

    fs.writeFileSync(sessionsDir, 'Test session content\n<!-- ECC:SUMMARY:START -->\nThis is a session summary\n<!-- ECC:SUMMARY:END -->\n', 'utf8');

    // Run hook with env vars
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

    const dailyNote = path.join(vaultDir, 'OpenCode', 'Sessions', `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}.md`);

    if (fs.existsSync(dailyNote)) {
      const content = fs.readFileSync(dailyNote, 'utf8');
      assert(content.includes('This is a session summary'), 'Daily note contains session summary');
    } else {
      assert(false, `Daily note not created at ${dailyNote}. Output: ${child.stderr || child.stdout}`);
    }
  } catch (e) {
    assert(false, `Dry-run failed: ${e.message}`);
  } finally {
    // Cleanup
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
});

// ─── Summary ────────────────────────────────────────────

console.log(`\n  ────────────────────────────────────────`);
console.log(`  Results: ${results.passed} passed, ${results.failed} failed`);

if (results.errors.length > 0 && !process.argv.includes('--verbose')) {
  console.log(`\n  Failures:`);
  results.errors.forEach(e => console.log(`    [FAIL] ${e.message}`));
}

if (results.failed > 0) {
  process.exit(1);
}
console.log(`  All tests passed. Ready for publication.`);
process.exit(0);
