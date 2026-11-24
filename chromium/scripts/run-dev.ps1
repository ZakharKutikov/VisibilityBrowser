# Starts the dev build of Visibility Browser with its own profile.
# Usage: .\run-dev.ps1 [-Fresh] [-Url <page>]

param([switch]$Fresh, [string]$Url = '')

$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$exe = 'D:\src\chromium\src\out\Dev\chrome.exe'
$profileDir = Join-Path $repo 'chromium\progress\dev-profile'


if ($Fresh -and (Test-Path $profileDir)) { Remove-Item -Recurse -Force $profileDir }
New-Item -ItemType Directory -Force $profileDir | Out-Null

$arguments = @(
    "--user-data-dir=$profileDir",
    '--no-first-run',
    '--no-default-browser-check'
)
if ($Url) { $arguments += $Url }

Start-Process $exe -ArgumentList $arguments
