#!/usr/bin/env pwsh
# OC-Obsidian-MCP Setup Script
# Cross-platform (Windows, macOS, Linux)
#
# Usage:
#   .\setup.ps1 -VaultPath "C:\Users\me\Obsidian\MyVault"
#   .\setup.ps1 -VaultPath "~/Obsidian/MyVault" -MCPCommand "npx -y mcp-obsidian-vault"

param(
    [Parameter(Mandatory = $false)]
    [string]$VaultPath = "",

    [Parameter(Mandatory = $false)]
    [string]$MCPCommand = "npx -y mcp-obsidian-vault",

    [Parameter(Mandatory = $false)]
    [string]$OpenCodeConfigPath = "",

    [Parameter(Mandatory = $false)]
    [switch]$Unattended = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $PSCommandPath

# ─── Cross-platform Helpers ──────────────────────────────

function Get-HomeDir {
    if ($IsWindows -or $env:OS) {
        return $env:USERPROFILE
    }
    return $env:HOME
}

function Get-OpenCodeConfigPaths {
    $configs = @()
    $homeDir = Get-HomeDir

    # Order matters: global first, then project
    $globalMcp = Join-Path $homeDir ".opencode" "mcp.json"
    $projectConfig = Join-Path $homeDir ".config" "opencode" "opencode.json"

    if (Test-Path $globalMcp) { $configs += $globalMcp }
    if (Test-Path $projectConfig) { $configs += $projectConfig }

    return $configs
}

function Has-ObsidianInConfig {
    param([string]$Path)
    if (!(Test-Path $Path)) { return $false }
    try {
        $content = Get-Content $Path -Raw | ConvertFrom-Json -Depth 20 -AsHashtable -ErrorAction SilentlyContinue
        if (-not $content) { return $false }
        return ($content.ContainsKey('mcpServers') -and $content.mcpServers.ContainsKey('obsidian')) -or
               ($content.ContainsKey('mcp') -and $content.mcp.ContainsKey('obsidian'))
    } catch {
        return $false
    }
}

# ─── Banner ───────────────────────────────────────────────
function Write-Banner {
    Write-Host ""
    Write-Host "  ┌───────────────────────────────────────┐" -ForegroundColor Cyan
    Write-Host "  │     OC-Obsidian-MCP Setup             │" -ForegroundColor Cyan
    Write-Host "  │     Persistent Memory for OpenCode    │" -ForegroundColor Cyan
    Write-Host "  └───────────────────────────────────────┘" -ForegroundColor Cyan
    Write-Host ""
}

# ─── Prerequisites check ─────────────────────────────────
function Test-Prerequisites {
    Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Yellow

    # Node.js
    try {
        $nodeVer = & node --version 2>&1
        if ($LASTEXITCODE -ne 0) { throw "node not found" }
        Write-Host "  [OK] Node.js $nodeVer" -ForegroundColor Green
    } catch {
        Write-Host "  [ERR] Node.js is required but not found." -ForegroundColor Red
        Write-Host "        Install from https://nodejs.org/ (v20+)" -ForegroundColor Red
        return $false
    }

    # npx
    try {
        $npxVer = & npx --version 2>&1
        Write-Host "  [OK] npx $npxVer" -ForegroundColor Green
    } catch {
        Write-Host "  [ERR] npx not found." -ForegroundColor Red
        return $false
    }

    return $true
}

# ─── Vault path ──────────────────────────────────────────
function Get-VaultPath {
    param([string]$Provided)

    if ($Provided) { return $Provided }

    Write-Host ""
    Write-Host "[2/4] Configure Obsidian vault path..." -ForegroundColor Yellow

    $defaultPath = Join-Path (Get-HomeDir) "Obsidian" "MyVault"

    $answer = Read-Host "Enter vault path [$defaultPath]"
    if ([string]::IsNullOrWhiteSpace($answer)) { $answer = $defaultPath }

    # Expand ~ on non-Windows
    if ((-not $IsWindows) -and $answer.StartsWith("~")) {
        $answer = $answer.Replace("~", (Get-HomeDir))
    }

    if (!(Test-Path $answer)) {
        Write-Host "  [WARN] Path does not exist: $answer" -ForegroundColor Yellow
        $confirm = Read-Host "Create it? [Y/n]"
        if ($confirm -ne "n" -and $confirm -ne "N") {
            New-Item -ItemType Directory -Path $answer -Force | Out-Null
            Write-Host "  [OK] Created: $answer" -ForegroundColor Green
        } else {
            throw "Vault path required. Aborting."
        }
    } else {
        # Check if it looks like a vault (has .obsidian dir or markdown files)
        $vaultDir = Join-Path $answer ".obsidian"
        if (Test-Path $vaultDir) {
            Write-Host "  [OK] Vault found: $answer (has .obsidian/)" -ForegroundColor Green
        } else {
            $mdCount = (Get-ChildItem -Path $answer -Filter "*.md" -ErrorAction SilentlyContinue).Count
            if ($mdCount -gt 0) {
                Write-Host "  [OK] Vault found: $answer ($mdCount .md files)" -ForegroundColor Green
            } else {
                Write-Host "  [WARN] No .obsidian/ or .md files found in $answer" -ForegroundColor Yellow
                Write-Host "        Will create structure there. Continue?" -ForegroundColor Yellow
                $confirm = Read-Host "[Y/n]"
                if ($confirm -eq "n" -or $confirm -eq "N") {
                    throw "Aborted by user."
                }
                Write-Host "  [OK] Proceeding with: $answer" -ForegroundColor Green
            }
        }
    }

    return $answer
}

# ─── Write config ────────────────────────────────────────
function Write-ConfigFiles {
    param([string]$Vault)

    Write-Host ""
    Write-Host "[3/4] Writing configuration files..." -ForegroundColor Yellow

    $configDir = Join-Path $ScriptDir "config"
    $envFile = Join-Path $configDir ".mcp-env"
    $sampleFile = Join-Path $configDir ".mcp-env.template"

    $content = @"# OC-Obsidian-MCP Environment Configuration
# Generated by setup.ps1 on $(Get-Date -Format "yyyy-MM-dd HH:mm")
#
# This file is read by the MCP wrapper scripts before launching
# the mcp-obsidian-vault server. You can override any value via
# standard environment variables.

# Path to your Obsidian vault (REQUIRED)
OBSIDIAN_VAULT_PATH=$Vault

# OpenCode folder structure within the vault
DAILY_NOTE_FOLDER=OpenCode/Sessions
DECISIONS_FOLDER=OpenCode/Decisions
DISCOVERIES_FOLDER=OpenCode/Learnings
AGENTS_FOLDER=OpenCode/Context

# Git auto-sync (commits to vault's git repo after every write)
GIT_AUTO_SYNC=true

# Move deleted notes to .trash instead of permanently deleting
TRASH_ON_DELETE=true

# MCP call timeout in milliseconds
# MCP_TIMEOUT_MS=15000

# Hook debug mode (set to 1 for verbose stderr output)
# DEBUG_HOOK=0
"@

    $content | Out-File -FilePath $envFile -Encoding UTF8
    Write-Host "  [OK] config\.mcp-env" -ForegroundColor Green

    # Template is generated from the same content
    Copy-Item $envFile $sampleFile -Force
    Write-Host "  [OK] config\.mcp-env.template" -ForegroundColor Green

    return $envFile
}

# ─── Register with OpenCode ─────────────────────────────
function Register-WithOpenCode {
    param([string]$WrapperPath)

    Write-Host ""
    Write-Host "[4/4] Registering with OpenCode..." -ForegroundColor Yellow

    $opencodeConfigs = Get-OpenCodeConfigPaths
    $wrapperCommand = $WrapperPath

    if ($opencodeConfigs.Count -eq 0) {
        Write-Host "  [WARN] No OpenCode config found. Creating ~/.opencode/mcp.json" -ForegroundColor Yellow
        $homeDir = Get-HomeDir
        $mcpDir = Join-Path $homeDir ".opencode"
        $globalMcp = Join-Path $mcpDir "mcp.json"
        if (!(Test-Path $mcpDir)) {
            New-Item -ItemType Directory -Path $mcpDir -Force | Out-Null
        }
        @{ mcpServers = @{} } | ConvertTo-Json -Depth 10 | Out-File -FilePath $globalMcp -Encoding UTF8
        $opencodeConfigs += $globalMcp
    }

    $updated = @()
    foreach ($cfg in $opencodeConfigs) {
        if (!(Has-ObsidianInConfig -Path $cfg)) {
            $updated += $cfg
        }
    }

    if ($updated.Count -eq 0) {
        Write-Host "  [OK] Obsidian MCP already registered in all configs" -ForegroundColor Green
        return
    }

    if (-not $Unattended) {
        Write-Host "  Ready to register Obsidian MCP in $($updated.Count) config(s)." -ForegroundColor Cyan
        $confirm = Read-Host "Proceed? [Y/n]"
        if ($confirm -eq "n" -or $confirm -eq "N") {
            Write-Host "  [SKIP] Register manually -- see README" -ForegroundColor Yellow
            return
        }
    }

    foreach ($cfg in $updated) {
        $json = Get-Content $cfg -Raw | ConvertFrom-Json -Depth 20 -AsHashtable

        if ($json.ContainsKey('mcpServers')) {
            # ~/.opencode/mcp.json format
            $json.mcpServers['obsidian'] = @{
                command = $wrapperCommand
                args = @()
            }
        } elseif ($json.ContainsKey('mcp')) {
            # ~/.config/opencode/opencode.json format
            $json.mcp['obsidian'] = @{
                type = "local"
                command = @($wrapperCommand)
                enabled = $true
            }
        }

        $json | ConvertTo-Json -Depth 10 | Out-File -FilePath $cfg -Encoding UTF8
        Write-Host "  [OK] Registered in: $cfg" -ForegroundColor Green
    }
}

# ─── Create vault structure ──────────────────────────────
function New-VaultStructure {
    param([string]$Vault)

    Write-Host ""
    Write-Host "Ensuring vault folder structure..." -ForegroundColor Yellow

    $folders = @('OpenCode/Sessions', 'OpenCode/Decisions', 'OpenCode/Learnings', 'OpenCode/Context')
    foreach ($f in $folders) {
        $fullPath = Join-Path $Vault $f
        if (!(Test-Path $fullPath)) {
            New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
            Write-Host "  [OK] Created: $f" -ForegroundColor Green
        }
    }
}

# ─── Install hook ────────────────────────────────────────
function Install-Hook {
    param([string]$Vault)

    Write-Host ""
    Write-Host "Installing Stop hook (optional)..." -ForegroundColor Yellow

    if ($Unattended) {
        Write-Host "  [SKIP] Use --InstallHook flag or run manually" -ForegroundColor DarkGray
        return
    }

    $hookSrc = Join-Path $ScriptDir "hooks" "obsidian-session-save.js"
    $hooksDir = Join-Path (Get-HomeDir) ".claude" "scripts" "hooks"
    $hooksJson = Join-Path (Get-HomeDir) ".claude" "hooks" "hooks.json"

    if (!(Test-Path $hooksJson)) {
        Write-Host "  [SKIP] hooks.json not found at $hooksJson" -ForegroundColor Yellow
        Write-Host "        Install manually -- see README section 'Manual Installation'" -ForegroundColor Yellow
        return
    }

    $confirm = Read-Host "Install Stop hook for auto session logging? [Y/n]"
    if ($confirm -eq "n" -or $confirm -eq "N") {
        Write-Host "  [SKIP] Hook not installed." -ForegroundColor Yellow
        return
    }

    # Copy hook script
    if (!(Test-Path $hooksDir)) { New-Item -ItemType Directory -Path $hooksDir -Force | Out-Null }
    Copy-Item $hookSrc $hooksDir -Force
    Write-Host "  [OK] Copied hook script to $hooksDir" -ForegroundColor Green

    # Register in hooks.json (safe JSON manipulation)
    $hookConfig = Get-Content $hooksJson -Raw | ConvertFrom-Json -Depth 20 -AsHashtable

    if (-not $hookConfig.ContainsKey('hooks')) {
        $hookConfig['hooks'] = @{}
    }
    if (-not $hookConfig.hooks.ContainsKey('Stop')) {
        $hookConfig.hooks['Stop'] = @()
    }

    # Check if already registered
    $already = $false
    foreach ($entry in $hookConfig.hooks.Stop) {
        if ($entry.id -eq 'stop:obsidian-session-save') {
            $already = $true
            break
        }
    }

    if (-not $already) {
        $hookConfig.hooks.Stop += @{
            matcher = '*'
            hooks = @(
                @{
                    type = 'command'
                    command = "node `""$hooksDir\obsidian-session-save.js`"""
                    async = $true
                    timeout = 15
                }
            )
            description = 'Save session learnings to Obsidian vault'
            id = 'stop:obsidian-session-save'
        }
    }

    $hookConfig | ConvertTo-Json -Depth 10 | Out-File -FilePath $hooksJson -Encoding UTF8
    Write-Host "  [OK] Hook registered in hooks.json" -ForegroundColor Green
}

# ─── Main ────────────────────────────────────────────────
Write-Banner

$ok = Test-Prerequisites
if (-not $ok) {
    Write-Host "`n  [ERR] Setup aborted -- fix prerequisites and retry." -ForegroundColor Red
    exit 1
}

Write-Host ""
$vault = Get-VaultPath -Provided $VaultPath

$envFile = Write-ConfigFiles -Vault $vault

$wrapperPath = Join-Path $ScriptDir "scripts" "obsidian-mcp-wrapper.cmd"
if ((-not $IsWindows) -and (-not $env:OS)) {
    $wrapperPath = Join-Path $ScriptDir "scripts" "obsidian-mcp-wrapper.sh"
}

# If Windows, copy wrapper to spacesafe temp dir
if ($IsWindows -or $env:OS) {
    $wrapperDest = Join-Path $env:TEMP "obsidian-mcp.cmd"
    Copy-Item $wrapperPath $wrapperDest -Force -ErrorAction SilentlyContinue
    $wrapperPath = $wrapperDest
}

Register-WithOpenCode -WrapperPath $wrapperPath
New-VaultStructure -Vault $vault
Install-Hook -Vault $vault

Write-Host ""
Write-Host "  ┌═══════════════════════════════════════┐" -ForegroundColor Cyan
Write-Host "  │  Setup complete!                      │" -ForegroundColor Cyan
Write-Host "  │                                      │" -ForegroundColor Cyan
Write-Host "  │  1. Edit  config\.mcp-env            │" -ForegroundColor Cyan
Write-Host "  │  2. Restart OpenCode                  │" -ForegroundColor Cyan
Write-Host "  │  3. Start using /remember, /adr       │" -ForegroundColor Cyan
Write-Host "  └═══════════════════════════════════════┘" -ForegroundColor Cyan
Write-Host ""
