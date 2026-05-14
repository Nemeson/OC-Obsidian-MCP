#!/usr/bin/env node
/**
 * ObMem v2.5: Self-Update Command (/update)
 *
 * Usage:
 *   obmem update              Check for updates
 *   obmem update --apply      Download and install latest version
 *
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PACKAGE_NAME = 'obmem';
const GITHUB_REPO = 'Nemeson/OC-Obsidian-MCP';
const NPM_PACKAGE = 'oc-obsidian-mcp';

function errorExit(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { headers: { 'User-Agent': 'obmem-update/2.5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Invalid JSON: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Connection timeout')); });
  });
}

// ─── Check latest GitHub release ──────────────────────────
async function checkGithub() {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
  try {
    const release = await httpGetJson(url);
    if (!release.tag_name) return null;
    return {
      version: release.tag_name.replace(/^v/, ''),
      url: release.html_url,
      tarball: release.tarball_url,
      published: release.published_at,
      notes: release.body || ''
    };
  } catch { return null; }
}

// ─── Check npm registry ───────────────────────────────────
async function checkNpm() {
  const url = `https://registry.npmjs.org/${NPM_PACKAGE}/latest`;
  try {
    const pkg = await httpGetJson(url);
    if (!pkg.version) return null;
    return {
      version: pkg.version,
      url: `https://www.npmjs.com/package/${NPM_PACKAGE}`,
      tarball: pkg.dist?.tarball || null,
      published: pkg.time?.modified || pkg.time?.[pkg.version] || null
    };
  } catch { return null; }
}

// ─── Semver compare (a > b ? 1 : -1 : 0) ────────────────────
function compareVersion(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

// ─── Get current version ──────────────────────────────────
function getCurrentVersion() {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version;
    }
  } catch {}
  return '0.0.0';
}

// ─── Update from git ────────────────────────────────────────
function updateViaGit() {
  try {
    const projectRoot = path.join(__dirname, '..');
    console.log('\n📥 Pulling latest changes from Git...\n');
    execSync('git pull origin master', {
      cwd: projectRoot,
      stdio: 'inherit',
      timeout: 120000
    });
    console.log('\n ✅ Updated via git successfully.\n');
    return true;
  } catch (e) {
    console.error(`\n ⚠️  Git pull failed: ${e.message}\n`);
    return false;
  }
}

// ─── Update from npm ────────────────────────────────────────
function updateViaNpm() {
  try {
    console.log('\n📥 Installing latest version from npm...\n');
    execSync('npm install -g obmem@latest', {
      stdio: 'inherit',
      timeout: 120000
    });
    console.log('\n ✅ Updated via npm successfully.\n');
    return true;
  } catch (e) {
    console.error(`\n ⚠️  npm install failed: ${e.message}\n`);
    return false;
  }
}

// ─── Download tarball update ────────────────────────────────
async function downloadTarball(tarballUrl) {
  const tmpPath = path.join(os.tmpdir(), `obmem-update-${Date.now()}.tgz`);
  return new Promise((resolve, reject) => {
    const mod = tarballUrl.startsWith('https:') ? https : http;
    const file = fs.createWriteStream(tmpPath);
    const req = mod.get(tarballUrl, { headers: { 'User-Agent': 'obmem-update/2.5.0' } }, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(tmpPath));
      });
    });
    req.on('error', (err) => {
      fs.unlink(tmpPath, () => {});
      reject(err);
    });
    req.setTimeout(30000, () => {
      req.destroy();
      fs.unlink(tmpPath, () => {});
      reject(new Error('Download timeout'));
    });
  });
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const applyMode = args.includes('--apply');
  const forceMode = args.includes('--force');

  const currentVersion = getCurrentVersion();
  console.log(`\n🧠 ObMem v${currentVersion} — Update Check\n`);

  console.log('🔍 Checking for updates...\n');

  const github = await checkGithub();
  const npm = await checkNpm();

  let latest = null;
  let source = '';

  if (github && npm) {
    const cmp = compareVersion(github.version, npm.version);
    if (cmp >= 0) {
      latest = github;
      source = 'GitHub';
    } else {
      latest = npm;
      source = 'npm';
    }
  } else if (github) {
    latest = github;
    source = 'GitHub';
  } else if (npm) {
    latest = npm;
    source = 'npm';
  } else {
    errorExit('Could not check for updates. Are you offline?\nTry: obmem update --force');
  }

  const cmp = compareVersion(latest.version, currentVersion);

  if (cmp > 0 || forceMode) {
    if (forceMode && cmp === 0) {
      console.log(`ℹ️  Force mode: ${source} version ${latest.version} is already installed.`);
    } else {
      console.log(`🚀 Update available: ${source} v${latest.version}`);
      console.log(`   Current: v${currentVersion}`);
      console.log(`   Published: ${latest.published ? new Date(latest.published).toLocaleDateString() : 'unknown'}`);
    }

    if (latest.notes) {
      console.log('\n📝 Release Notes:\n');
      console.log(latest.notes.split('').slice(0, 500).join('') + (latest.notes.length > 500 ? '...' : ''));
    }

    if (applyMode || forceMode) {
      console.log('\n⬇️  Applying update...\n');

      let ok = false;
      const isGitRepo = fs.existsSync(path.join(__dirname, '..', '.git'));
      const canNpm = fs.existsSync(path.join(__dirname, '..', 'node_modules'));

      if (isGitRepo) {
        console.log('   Trying git pull first...');
        ok = updateViaGit();
      }

      if (!ok && canNpm) {
        console.log('   Trying npm install...');
        ok = updateViaNpm();
      }

      if (!ok && latest.tarball) {
        console.log('   Downloading tarball...');
        try {
          const tgz = await downloadTarball(latest.tarball);
          console.log(`   Downloaded to ${tgz}`);
          const extractDir = path.join(__dirname, '..');
          execSync(`tar -xzf "${tgz}" -C "${extractDir}" --strip-components=1`, { stdio: 'inherit', timeout: 60000 });
          fs.unlinkSync(tgz);
          console.log('\n ✅ Updated from tarball successfully.\n');
          ok = true;
        } catch (e) {
          console.error(`\n ❌ Tarball extraction failed: ${e.message}\n`);
        }
      }

      if (!ok) {
        errorExit('All update methods failed. Manual update required.\nInstall: npm install -g obmem@latest');
      }
    } else {
      console.log('\n💡 To update, run: obmem update --apply\n');
    }
  } else if (cmp === 0) {
    console.log(`✅ ObMem is up to date (v${currentVersion})\n`);
  } else {
    console.log(`🌱 This version (v${currentVersion}) is newer than the latest release (v${latest.version}).\nYou are running a development build.\n`);
  }
}

main().catch(errorExit);
