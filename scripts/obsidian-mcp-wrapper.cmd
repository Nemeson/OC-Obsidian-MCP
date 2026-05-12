@echo off
REM OC-Obsidian-MCP: MCP Server Wrapper (Windows)
REM Reads configuration from environment variables or config\.mcp-env.
REM Usage: obsidian-mcp-wrapper.cmd [--version]

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
set "ENV_FILE=%PROJECT_DIR%config\.mcp-env"

if exist "%ENV_FILE%" (
    for /f "usebackq tokens=* delims=" %%a in ("%ENV_FILE%") do (
        set "line=%%a"
        set "line=!line: =!"
        if not "!line:~0,1!==""#"" (
            if not "!line!==""" (
                set "%%a"
            )
        )
    )
)

REM Defaults
if not defined OBSIDIAN_VAULT_PATH set "OBSIDIAN_VAULT_PATH=C:\Users\%USERNAME%\Obsidian\MyVault"
if not defined DAILY_NOTE_FOLDER set "DAILY_NOTE_FOLDER=OpenCode/Sessions"
if not defined DECISIONS_FOLDER set "DECISIONS_FOLDER=OpenCode/Decisions"
if not defined DISCOVERIES_FOLDER set "DISCOVERIES_FOLDER=OpenCode/Learnings"
if not defined AGENTS_FOLDER set "AGENTS_FOLDER=OpenCode/Context"
if not defined GIT_AUTO_SYNC set "GIT_AUTO_SYNC=true"
if not defined TRASH_ON_DELETE set "TRASH_ON_DELETE=true"

if "%OBSIDIAN_VAULT_PATH%"=="" (
    echo [ERROR] OBSIDIAN_VAULT_PATH is required.
    exit /b 1
)
if not exist "%OBSIDIAN_VAULT_PATH%" (
    echo [ERROR] Vault path does not exist: %OBSIDIAN_VAULT_PATH%
    exit /b 1
)

npx -y mcp-obsidian-vault %*
