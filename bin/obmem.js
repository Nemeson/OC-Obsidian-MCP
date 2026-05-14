#!/usr/bin/env node
/**
 * ObMem v2.1: Main CLI Entry Point
 *
 * Usage:
 *   obmem <command> [options]
 *
 * Commands:
 *   session-log                       Save current session summary
 *   adr "Title"                       Create Architecture Decision Record
 *   remember "Title"                  Save reusable learning/pattern
 *   related "query"                   Find related notes via hybrid search
 *   digest --project P --week         Generate weekly digest
 *   load-context                      Load project context from Obsidian
 *   gc                                Run garbage collection
 *   setup                             Interactive setup
 */

const fs = require('fs');
const path = require('path');

const VERSION = '2.1.0';

function showHelp() {
  console.log(`
🧠 ObMem v${VERSION} — Intelligent memory for AI agents

Usage: obmem <command> [options]

Memory Commands:
  session-log            Save session summary to vault
  adr "Title"            Architecture Decision Record     [--project NAME] [--status accepted]
  remember "Title"       Save reusable pattern/bugfix      [--type Bugfix] [--code "fn()"]
  goal "Title"           Track goals for project           [--project NAME] [--status done]

Discovery Commands:
  related "query"        Find related notes                [--project NAME] [--limit 10] [--semantic]
  load-context           Load project context from vault   [--project NAME]

Analysis Commands:
  digest                 Generate weekly/monthly digest    [--project NAME] [--week|--month]
  reflect                Self-reflection on recent work    [--project NAME] [--days 7]
  gc                     Garbage collect old data          [--project NAME] [--dry-run]

Setup:
  setup                  Interactive setup (PowerShell)

Options:
  -h, --help             Show this help
  -v, --version          Show version
  --project NAME         Target project (auto-detected if omitted)

Examples:
  obmem adr "Use Kafka for event streaming" --project MyApp
  obmem remember "Memory leak fix in React useEffect"
  obmem digest --project PCAP2KML --week
  obmem related "auth pattern"
  obmem reflect --project PCAP2KML --days 14
  obmem goal "Implement offline sync" --project PCAP2KML
`);
}

function delegate(script) {
  const binDir = path.dirname(__filename);
  const full = path.join(binDir, script);
  if (!fs.existsSync(full)) {
    console.error(`Error: ${script} not found. Corrupt installation?`);
    process.exit(1);
  }
  require(full);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '-h' || command === '--help') {
    showHelp();
    process.exit(0);
  }

  if (command === '-v' || command === '--version') {
    console.log(`obmem v${VERSION}`);
    process.exit(0);
  }

  // Strip leading "/" for slash-command compatibility
  const cmd = command.startsWith('/') ? command.slice(1) : command;

  // Map commands to obmem-prefixed scripts
  const aliases = {
    'adr': 'obmem-adr.js',
    'remember': 'obmem-remember.js',
    'related': 'obmem-related.js',
    'digest': 'obmem-digest.js',
    'session-log': 'obmem-session-log.js',
    'load-context': 'obmem-load-context.js',
    'reflect': 'obmem-reflect.js',
    'goal': 'obmem-goal.js',
    'gc': 'obmem-session-log.js', // gc has no own script in bin; keep old behavior
  };

  if (aliases[cmd]) {
    delegate(aliases[cmd]);
    return;
  }

  // setup dispatches to PowerShell
  if (cmd === 'setup') {
    const setupPath = path.join(path.dirname(__filename), '..', 'setup.ps1');
    if (!fs.existsSync(setupPath)) {
      console.error('Error: setup.ps1 not found. Run from project root or reinstall.');
      process.exit(1);
    }
    console.log(`Running setup: ${setupPath}\n`);
    try {
      require('child_process').execSync(`pwsh "${setupPath}"`, { stdio: 'inherit' });
    } catch {
      console.error('\nPowerShell not found. Run manually: pwsh setup.ps1 -VaultPath "/path/to/vault"');
      process.exit(1);
    }
    return;
  }

  console.error(`Unknown command: "${command}"`);
  console.error('');
  showHelp();
  process.exit(1);
}

main();
