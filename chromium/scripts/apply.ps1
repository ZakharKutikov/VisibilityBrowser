# Applies the fork on top of a Chromium checkout:
#   1. copies chromium/overlay/** over src/** (new or wholly replaced files)
#   2. applies chromium/patches/*.patch in name order
#
#   -Reset   first discard every local change in src (git checkout + clean of overlay files).
#            Use after moving to a new Chromium tag. Destroys uncommitted work in src.

param([switch]$Reset)

. "$PSScriptRoot\env.ps1"

$overlay = Join-Path $ForkDir 'overlay'
$patches = Join-Path $ForkDir 'patches'

Push-Location $ChromiumSrc
try {
    if ($Reset) {
        Write-Host 'Resetting src to the pinned tag...'
        Invoke-Checked git checkout -q --force "refs/tags/$ChromiumTag"
        Invoke-Checked git clean -fdq
    }

    if (Test-Path $overlay) {
        $files = Get-ChildItem $overlay -Recurse -File | Where-Object Name -ne '.gitkeep'
        foreach ($f in $files) {
            $rel  = $f.FullName.Substring($overlay.Length + 1)
            $dest = Join-Path $ChromiumSrc $rel
            New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
            Copy-Item $f.FullName $dest -Force
        }
        Write-Host "Overlay: $($files.Count) file(s) copied"
    }

    $list = @(Get-ChildItem $patches -Filter *.patch -ErrorAction SilentlyContinue | Sort-Object Name)
    foreach ($p in $list) {
        # Already applied? Then the reverse applies cleanly; skip it.
        # Via cmd so git's stderr does not become a terminating PowerShell error.
        cmd /c "git apply --reverse --check `"$($p.FullName)`" 2>nul"
        if ($LASTEXITCODE -eq 0) { Write-Host "  = $($p.Name) (already applied)"; continue }
        cmd /c "git apply --check `"$($p.FullName)`" 2>&1"
        if ($LASTEXITCODE -ne 0) { throw "Patch does not apply: $($p.Name)" }
        Invoke-Checked git apply $p.FullName
        Write-Host "  + $($p.Name)"
    }
    Write-Host "Patches: $($list.Count)"

    # UI strings: Chromium -> Visibility in every language. A script instead of
    # a patch, because it touches ~160 translation files and remaps grit IDs;
    # it is safe to run again on an already rebranded tree.
    Invoke-Checked python (Join-Path $PSScriptRoot 'rebrand-strings.py')
}
finally { Pop-Location }
