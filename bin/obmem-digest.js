#!/usr/bin/env node
/**
 * OC-Obsidian-MCP: Weekly Digest Generator
 *
 * Usage:
 *   oc-obsidian-mcp digest --project PCAP2KML --week
 *   oc-obsidian-mcp digest --project PCAP2KML --month
 *   oc-obsidian-mcp digest --project PCAP2KML --from 2026-05-01 --to 2026-05-12
 *
 * Generates a structured Markdown digest from sessions, learnings, and decisions.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

function loadMcpEnv() {
  const candidates = [
    path.join(__dirname, '..', 'config', '.mcp-env'),
    path.join(os.homedir(), '.oc-obsidian-mcp', 'config', '.mcp-env'),
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) {
      for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) {continue;}
        const eq = t.indexOf('=');
        if (eq === -1) {continue;}
        if (!process.env[t.substring(0, eq).trim()]) {
          process.env[t.substring(0, eq).trim()] = t.substring(eq + 1).trim();
        }
      }
      break;
    }
  }
}
loadMcpEnv();

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '';

function detectProject() {
  try {
    const { execSync } = require('child_process');
    const top = execSync('git rev-parse --show-toplevel', { encoding:'utf8', timeout:3000, stdio:['pipe','pipe','ignore'] }).trim();
    return path.basename(top);
  } catch { return '_global'; }
}

function getSessionsInRange(project, from, to) {
  const dir = path.join(VAULT_PATH, 'OpenCode', 'Sessions', project);
  if (!fs.existsSync(dir)) {return [];}

  return fs.readdirSync(dir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f) && f !== 'index.md')
    .filter(f => {
      const d = f.replace('.md', '');
      return d >= from && d <= to;
    })
    .sort()
    .map(f => ({
      date: f.replace('.md', ''),
      path: path.join(dir, f),
      content: fs.readFileSync(path.join(dir, f), 'utf8'),
    }));
}

function getLearningsInRange(project, from, to) {
  const dir = path.join(VAULT_PATH, 'OpenCode', 'Learnings', project);
  if (!fs.existsSync(dir)) {return [];}
  const fromDate = new Date(from);
  const toDate = new Date(to);

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(f => {
      const stat = fs.statSync(path.join(dir, f));
      return {
        file: f.replace('.md', ''),
        date: stat.mtime.toISOString().slice(0, 10),
        inRange: stat.mtime >= fromDate && stat.mtime <= toDate,
        path: path.join(dir, f),
        content: fs.readFileSync(path.join(dir, f), 'utf8'),
      };
    })
    .filter(l => l.inRange)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function countSessions(sessions) {
  const count = sessions.length;
  const totalChars = sessions.reduce((s, ses) => s + ses.content.length, 0);
  const tools = new Set();
  for (const ses of sessions) {
    const toolMatch = ses.content.match(/### Tools Used\n(.+?)(?=\n###|\n---|$)/s);
    if (toolMatch) {
      toolMatch[1].split(',').forEach(t => tools.add(t.trim().replace(/mcp__plugin_[\w-]+_[\w-]+__/g, '')));
    }
  }
  return { count, totalChars, tools: [...tools].sort() };
}

function buildDigest(project, sessions, learnings) {
  const { count, totalChars, tools } = countSessions(sessions);
  const today = new Date().toISOString().slice(0, 10);

  const lines = [
    `# ${project} — Digest`,
    '',
    `**Zeitraum:** ${sessions[0]?.date || '-'} → ${sessions[sessions.length-1]?.date || '-'}`,
    `**Generiert:** ${today}`,
    '',
    '---',
    '',
    '## 📊 Überblick',
    '',
    `- **${count}** Sessions`,
    `- **${totalChars.toLocaleString()}** Zeichen analysiert`,
    `- **${learnings.length}** neue Learnings`,
    `- **${tools.length}** verschiedene Tools genutzt`,
    '',
    '## 🔧 Tool-Nutzung',
    '',
    ...tools.map(t => `- \`${t}\``),
    '',
    '---',
    '',
    '## 📝 Session-Übersicht',
    '',
  ];

  for (const ses of sessions) {
    const sessionTitle = ses.content.match(/## Session — (\d{2}:\d{2})/);
    const time = sessionTitle ? sessionTitle[1] : '--:--';

    // Extract tasks (first few bullet points after "### Tasks")
    const tasksMatch = ses.content.match(/### Tasks\n((?:- .+\n?)+)/);
    const tasks = tasksMatch ? tasksMatch[1].split('\n').filter(l => l.startsWith('- ')).slice(0, 5).map(l => {
      const clean = l.replace(/^- <local-command-caveat>.*$/, '- [lokaler Befehl]');
      return clean.slice(0, 120);
    }) : [];

    lines.push(`### ${ses.date} (${time})`);
    lines.push('');
    if (tasks.length > 0) {
      tasks.forEach(t => lines.push(t));
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## 🧠 Neue Learnings');
  lines.push('');

  if (learnings.length === 0) {
    lines.push('*Keine neuen Learnings in diesem Zeitraum.*');
  } else {
    for (const l of learnings) {
      const typeMatch = l.content.match(/\*\*Typ:\*\* (.+)/);
      const type = typeMatch ? typeMatch[1] : 'Pattern';
      const importanceMatch = l.content.match(/Relevanz:\*\* #(\w+)/);
      const importance = importanceMatch ? importanceMatch[1] : 'medium';
      lines.push(`- **${l.file}** — ${type} (#${importance})`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(`*Digest automatisch generiert von OC-Obsidian-MCP am ${today}*`);
  lines.push('');

  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage:');
    console.log('  oc-obsidian-mcp digest --project NAME --week');
    console.log('  oc-obsidian-mcp digest --project NAME --month');
    console.log('  oc-obsidian-mcp digest --project NAME --from YYYY-MM-DD --to YYYY-MM-DD');
    console.log('');
    console.log('Options:');
    console.log('  --output FILE    Write digest to file (optional)');
    console.log('  --markdown       Force Markdown output');
    process.exit(0);
  }

  const projectIdx = args.indexOf('--project');
  const project = projectIdx > -1 ? args[projectIdx + 1] : detectProject();
  const outputIdx = args.indexOf('--output');

  if (!VAULT_PATH) { console.error('Error: OBSIDIAN_VAULT_PATH not set'); process.exit(1); }

  const now = new Date();
  let from, to;

  if (args.includes('--week')) {
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    from = monday.toISOString().slice(0, 10);
    to = sunday.toISOString().slice(0, 10);
  } else if (args.includes('--month')) {
    from = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
    to = now.toISOString().slice(0, 10);
  } else {
    const fromIdx = args.indexOf('--from');
    const toIdx = args.indexOf('--to');
    from = fromIdx > -1 ? args[fromIdx + 1] : `${now.getFullYear()}-01-01`;
    to = toIdx > -1 ? args[toIdx + 1] : now.toISOString().slice(0, 10);
  }

  const sessions = getSessionsInRange(project, from, to);
  const learnings = getLearningsInRange(project, from, to);

  if (sessions.length === 0 && learnings.length === 0) {
    console.log(`Keine Daten für ${project} im Zeitraum ${from} → ${to}.`);
    process.exit(0);
  }

  const digest = buildDigest(project, sessions, learnings);

  if (outputIdx > -1) {
    const outputPath = args[outputIdx + 1];
    fs.writeFileSync(outputPath, digest, 'utf8');
    console.log(`✅ Digest gespeichert: ${outputPath}`);
  } else {
    console.log(digest);
  }
}

main();
