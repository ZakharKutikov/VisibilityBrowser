# Shared settings for the build scripts. Dot-source it: . "$PSScriptRoot\env.ps1"
# Override the checkout location with the VISIB_SRC_ROOT environment variable.

$ErrorActionPreference = 'Stop'

$script:RepoRoot     = (Resolve-Path "$PSScriptRoot\..\..").Path
$script:ForkDir      = Join-Path $RepoRoot 'chromium'
$script:SrcRoot      = if ($env:VISIB_SRC_ROOT) { $env:VISIB_SRC_ROOT } else { 'D:\src' }
$script:DepotTools   = Join-Path $SrcRoot 'depot_tools'
$script:ChromiumRoot = Join-Path $SrcRoot 'chromium'
$script:ChromiumSrc  = Join-Path $ChromiumRoot 'src'
$script:ChromiumTag  = (Get-Content (Join-Path $ForkDir 'VERSION') -Raw).Trim()

if ($SrcRoot -match '\s') { throw "Checkout path must not contain spaces: $SrcRoot" }

# Use the locally installed Visual Studio, and put depot_tools ahead of any other python/git.
$env:DEPOT_TOOLS_WIN_TOOLCHAIN = '0'
if (($env:PATH -split ';')[0] -ne $DepotTools) { $env:PATH = "$DepotTools;$env:PATH" }

function Invoke-Checked {
    param([Parameter(Mandatory)][string]$Exe, [Parameter(ValueFromRemainingArguments)][string[]]$Rest)
    & $Exe @Rest
    if ($LASTEXITCODE -ne 0) { throw "$Exe $($Rest -join ' ') failed with exit code $LASTEXITCODE" }
}
