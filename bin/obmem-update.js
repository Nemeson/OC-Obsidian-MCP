#!/usr/bin/env node
/**
 * ObMem Update — Git-centric auto-update (bin: obmem-update)
 *
 * For dev installs (npm link / git clone), updates via git pull.
 * For npm installs, updates via npm.
 *
 * Usage:
 *   obmem update              Check for updates
 *   obmem update --apply      Pull and install latest version
 *   obmem update --force      Force reinstall even if up to date
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// const GITHUB_REPO = 'Nemeson/OC-Obsidian-MCP'; // reserved for future remote update

const NPM_PACKAGE = 'oc-obsidian-mcp';

function errorExit(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function exec(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: opts.inherit ? 'inherit' : ['pipe', 'pipe', 'pipe'],
      timeout: opts.timeout || 30000,
      cwd: opts.cwd || undefined,
      ...opts,
    });
  } catch (e) {
    if (opts.silent) {return null;}
    throw e;
  }
}

// ─── Get current version from package.json ────────────────
function getCurrentVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version;
    }
  } catch { /* noop */ }
  return '0.0.0';
}

// ─── Check if this is a git clone / linked install ──────
function isGitInstall() {
  return fs.existsSync(path.join(__dirname, '..', '.git'));
}

// ─── Git-based update check ─────────────────────────────
function checkGitUpdates() {
  try {
    // Fetch latest from remote (no merge)
    exec('git fetch origin', { silent: true, timeout: 15000 });

    // Count commits behind origin/master
    const behind = exec('git rev-list --count HEAD..origin/master', { silent: true })?.trim();
    const ahead = exec('git rev-list --count origin/master..HEAD', { silent: true })?.trim();

    // Get latest commit info
    const lastCommit = exec('git log -1 --format="%h %s" origin/master', { silent: true })?.trim();
    const lastDate = exec('git log -1 --format="%ci" origin/master', { silent: true })?.trim();

    return {
      behind: parseInt(behind || '0', 10),
      ahead: parseInt(ahead || '0', 10),
      commit: lastCommit,
      date: lastDate ? new Date(lastDate).toLocaleDateString() : null,
      isGitInstall: true,
    };
  } catch (e) {
    return null;
  }
}

// ─── Git apply update ───────────────────────────────────
function applyGitUpdate() {
  try {
    const projectRoot = path.join(__dirname, '..');
    console.log('\n📥 Pulling latest changes from Git...\n');
    execSync('git pull origin master', {
      cwd: projectRoot,
      stdio: 'inherit',
      timeout: 120000,
    });

    // Re-link if npm-linked
    console.log('\n🔗 Re-linking package...\n');
    try {
      execSync('npm link', { cwd: projectRoot, stdio: 'inherit', timeout: 60000 });
    } catch {
      console.log('   (npm link skipped or failed, manual relink may be needed)');
    }

    console.log('\n✅ Updated successfully via git.\n');
    return true;
  } catch (e) {
    console.error(`\n⚠️  Git pull failed: ${e.message}\n`);
    return false;
  }
}

// ─── npm-based update check ─────────────────────────────
function checkNpmUpdates() {
  try {
    const result = exec(`npm view ${NPM_PACKAGE} version`, { silent: true })?.trim();
    if (!result) {return null;}
    return {
      version: result,
      isGitInstall: false,
    };
  } catch {
    return null;
  }
}

// ─── npm apply update ─────────────────────────────────
function applyNpmUpdate() {
  try {
    console.log('\n📥 Installing latest version from npm...\n');
    execSync(`npm install -g ${NPM_PACKAGE}@latest`, {
      stdio: 'inherit',
      timeout: 120000,
    });
    console.log('\n✅ Updated successfully via npm.\n');
    return true;
  } catch (e) {
    console.error(`\n⚠️  npm install failed: ${e.message}\n`);
    return false;
  }
}

// ─── Semver compare ─────────────────────────────────────
function compareVersion(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) {return 1;}
    if ((pa[i] || 0) < (pb[i] || 0)) {return -1;}
  }
  return 0;
}

// ─── Main ───────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const applyMode = args.includes('--apply');
  const forceMode = args.includes('--force');

  const currentVersion = getCurrentVersion();
  console.log(`\n🧠 ObMem v${currentVersion} — Update Check\n`);

  let updateAvailable = false;
  let updateInfo = null;

  // ── Try git first ──────────────────────────────────────
  if (isGitInstall()) {
    const gitStatus = checkGitUpdates();

    if (!gitStatus) {
      errorExit('Could not check for git updates.\nAre you offline, or is the repo not accessible?');
    }

    if (gitStatus.behind > 0) {
      updateAvailable = true;
      updateInfo = {
        type: 'git',
        behind: gitStatus.behind,
        commit: gitStatus.commit,
        date: gitStatus.date,
      };
      console.log(`🚀 Update available: ${gitStatus.behind} commit(s) behind origin/master`);
      console.log(`   Latest: ${gitStatus.commit}`);
      if (gitStatus.date) {console.log(`   Date: ${gitStatus.date}`);}
    } else if (gitStatus.ahead > 0) {
      console.log(`ℹ️  Your local branch is ${gitStatus.ahead} commit(s) ahead of origin/master.`);
      console.log('   No remote updates available.');
    } else {
      console.log('✅ Up to date. Local branch matches origin/master.');
    }

    if (forceMode) {
      console.log('\n⬇️  Force mode: pulling anyway...\n');
      applyGitUpdate();
      return;
    }

    if (updateAvailable && applyMode) {
      applyGitUpdate();
      return;
    }
  }
  // ── Fallback to npm ──────────────────────────────────
  else {
    const npmInfo = checkNpmUpdates();
    if (!npmInfo) {
      errorExit('Could not check npm registry.\nPackage may not be published yet, or you may be offline.');
    }

    const cmp = compareVersion(npmInfo.version, currentVersion);
    if (cmp > 0) {
      updateAvailable = true;
      updateInfo = { type: 'npm', version: npmInfo.version };
      console.log(`🚀 Update available: npm v${npmInfo.version}`);
      console.log(`   Current: v${currentVersion}`);
    } else {
      console.log(`✅ Up to date. npm has v${npmInfo.version}, you have v${currentVersion}.`);
    }

    if (forceMode) {
      console.log('\n⬇️  Force mode: reinstalling anyway...\n');
      applyNpmUpdate();
      return;
    }

    if (updateAvailable && applyMode) {
      applyNpmUpdate();
      return;
    }
  }

  // ── No action needed ─────────────────────────────────
  if (!updateAvailable) {
    console.log('\n💡 No action needed. Everything is up to date.\n');
    return;
  }

  // ── Update available but not applied ───────────────────
  console.log('\n💡 To update, run:\n');
  if (updateInfo.type === 'git') {
    console.log('   obmem update --apply');
  } else {
    console.log('   obmem update --apply');
  }
  console.log('');
}

main().catch((err) => errorExit(`Unexpected error: ${err.message}`));
