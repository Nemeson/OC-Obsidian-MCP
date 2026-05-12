#!/usr/bin/env node
/**
 * OC-Obsidian-MCP: Load Context
 *
 * Usage: oc-obsidian-mcp load-context [--project NAME]
 * Loads project context from Obsidian vault (bootstrap, ADRs, learnings, sessions)
 */

const path = require('path');
const { execSync } = require('child_process');

const loaderPath = path.join(__dirname, '..', 'hooks', 'obsidian-context-loader.js');
const fs = require('fs');

if (!fs.existsSync(loaderPath)) {
  console.error('Error: context loader not found');
  process.exit(1);
}

// Pass through to the hooks script
require(loaderPath);
