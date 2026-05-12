#!/usr/bin/env node
/**
 * OC-Obsidian-MCP v2.0: Main CLI Entry Point
 *
 * Usage:
 *   oc-obsidian-mcp <command> [options]
 *
 * Commands:
 *   session-log                       Save current session summary
 *   adr "Title"                       Create Architecture Decision Record
 *   remember "Title"                  Save reusable learning/pattern
 *   related "query"                   Find related notes via keyword-overlap
 *   digest --project P --week         Generate weekly digest
 *   load-context                      Load project context from Obsidian
 *   gc                                Run garbage collection
 *   setup                             Interactive setup
 */

const fs = require('fs');
const path = require('path');

const VERSION = '2.0.0';

function showHelp() {
  console.log(`
🧠 OC-Obsidian-MCP v${VERSION} — Intelligent memory for AI agents

Usage: oc-obsidian-mcp <command> [options]

Memory Commands:
  session-log            Save session summary to vault
  adr "Title"            Architecture Decision Record     [--project NAME] [--status accepted]
  remember "Title"       Save reusable pattern/bugfix      [--type Bugfix] [--code "fn()"]

Discovery Commands:
  related "query"        Find related notes                [--project NAME] [--limit 10]
  load-context           Load project context from vault   [--project NAME]

Analysis Commands:
  digest                 Generate weekly/monthly digest    [--project NAME] [--week|--month]
  gc                     Garbage collect old data          [--project NAME] [--dry-run]

Setup:
  setup                  Interactive setup (PowerShell)

Options:
  -h, --help             Show this help
  -v, --version          Show version
  --project NAME         Target project (auto-detected if omitted)

Examples:
  oc-obsidian-mcp adr "Use Kafka for event streaming" --project MyApp
  oc-obsidian-mcp remember "Memory leak fix in React useEffect"
  oc-obsidian-mcp digest --project PCAP2KML --week
  oc-obsidian-mcp related "auth pattern"
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
    console.log(`oc-obsidian-mcp v${VERSION}`);
    process.exit(0);
  }

  // Strip leading "/" for slash-command compatibility
  const cmd = command.startsWith('/') ? command.slice(1) : command;

  const cmds = ['adr', 'remember', 'related', 'digest', 'session-log', 'load-context', 'gc'];
  if (cmds.includes(cmd)) {
    delegate(`${cmd}.js`);
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
