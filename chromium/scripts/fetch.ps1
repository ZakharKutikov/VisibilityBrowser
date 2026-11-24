# Downloads depot_tools and the Chromium sources at the tag pinned in chromium/VERSION.
# Shallow (no git history) to save disk space. Safe to re-run: it resumes or moves to a new tag.
#
#   -NoHooks   skip gclient hooks (they need Visual Studio); run hooks.ps1 later.

param([switch]$NoHooks)

. "$PSScriptRoot\env.ps1"

New-Item -ItemType Directory -Force $SrcRoot | Out-Null

if (-not (Test-Path (Join-Path $DepotTools '.git'))) {
    Invoke-Checked git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git $DepotTools
}

New-Item -ItemType Directory -Force $ChromiumSrc | Out-Null

$gclientFile = Join-Path $ChromiumRoot '.gclient'
if (-not (Test-Path $gclientFile)) {
    @'
solutions = [
  {
    "name": "src",
    "url": "https://chromium.googlesource.com/chromium/src.git",
    "managed": False,
    "custom_deps": {},
    "custom_vars": {},
  },
]
'@ | Set-Content -Encoding ascii $gclientFile
}

Push-Location $ChromiumSrc
try {
    if (-not (Test-Path '.git')) {
        Invoke-Checked git init -q
        Invoke-Checked git remote add origin https://chromium.googlesource.com/chromium/src.git
    }
    Invoke-Checked git config core.autocrlf false
    Invoke-Checked git config core.filemode false
    Invoke-Checked git config core.longpaths true

    # Via cmd so git's stderr does not become a terminating PowerShell error.
    $have = (cmd /c 'git describe --tags --exact-match 2>nul')
    if ($have -ne $ChromiumTag) {
        Write-Host "Fetching Chromium $ChromiumTag (shallow)..."
        Invoke-Checked git fetch --depth 1 origin "refs/tags/${ChromiumTag}:refs/tags/${ChromiumTag}"
        Invoke-Checked git checkout -q --force "refs/tags/$ChromiumTag"
    }

    $syncArgs = @('sync', '-D', '--no-history', '--force')
    if ($NoHooks) { $syncArgs += '--nohooks' }
    Write-Host "gclient $($syncArgs -join ' ')"
    # The Chromium docs require cmd.exe for gclient, at least on the first run.
    Invoke-Checked cmd /c "gclient $($syncArgs -join ' ')"
}
finally { Pop-Location }

Write-Host "Chromium $ChromiumTag is in $ChromiumSrc"
