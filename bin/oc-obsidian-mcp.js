#!/usr/bin/env node
/**
 * OC-Obsidian-MCP: Main CLI Entry Point
 *
 * Usage:
 *   oc-obsidian-mcp <command> [options]
 *
 * Commands:
 *   session-log   Save current session summary to Obsidian vault
 *   setup         Run interactive setup (vault path, config, hooks)
 *   help          Show this help message
 *
 * Examples:
 *   oc-obsidian-mcp session-log
 *   oc-obsidian-mcp setup
 *   npx oc-obsidian-mcp session-log
 */

const fs = require('fs');
const path = require('path');

function showHelp() {
  console.log(`
OC-Obsidian-MCP v1.0.0 — Persistent memory for AI agents

Usage: oc-obsidian-mcp <command> [options]

Commands:
  session-log    Save current session summary to Obsidian vault
  setup            Run interactive setup (PowerShell script)

Options:
  -h, --help       Show this help
  -v, --version    Show version

Examples:
  oc-obsidian-mcp session-log     # Manual session logging
  oc-obsidian-mcp setup           # Interactive configuration
  npx oc-obsidian-mcp session-log # Without installing
`);
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '-h' || command === '--help') {
    showHelp();
    process.exit(0);
  }

  if (command === '-v' || command === '--version') {
    console.log('oc-obsidian-mcp v1.0.0');
    process.exit(0);
  }

  const binDir = path.dirname(__filename);
  
  switch (command) {
    case 'session-log': {
      // Delegate to session-log.js
      const sessionLogPath = path.join(binDir, 'session-log.js');
      require(sessionLogPath);
      break;
    }

    case 'setup': {
      const setupPath = path.join(binDir, '..', 'setup.ps1');
      if (!fs.existsSync(setupPath)) {
        console.error('Error: setup.ps1 not found. Is oc-obsidian-mcp installed correctly?');
        process.exit(1);
      }
      console.log('Running setup.ps1...');
      console.log(`  ${setupPath}`);
      console.log('');
      const { execSync } = require('child_process');
      try {
        execSync(`pwsh "${setupPath}"`, { stdio: 'inherit' });
      } catch {
        console.error('');
        console.error('PowerShell not found. Run setup manually:');
        console.error('  pwsh setup.ps1 -VaultPath "/path/to/vault"');
        process.exit(1);
      }
      break;
    }

    default:
      console.error(`Unknown command: "${command}"`);
      console.error('');
      showHelp();
      process.exit(1);
  }
}

main();
