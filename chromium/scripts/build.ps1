# Builds the browser and records how long it took.
#
#   .\build.ps1                      dev build of chrome  -> out\Dev\chrome.exe
#   .\build.ps1 -Config Release      official build       -> out\Release\chrome.exe
#   .\build.ps1 -Config Release -Target mini_installer    installer

param(
    [ValidateSet('Dev', 'Release')][string]$Config = 'Dev',
    [string]$Target = 'chrome'
)

. "$PSScriptRoot\env.ps1"

$outRel = "out\$Config"
$outDir = Join-Path $ChromiumSrc $outRel
$argsSrc = Join-Path $ForkDir "args\$($Config.ToLower()).gn"

New-Item -ItemType Directory -Force $outDir | Out-Null
$argsDst = Join-Path $outDir 'args.gn'
if (-not (Test-Path $argsDst) -or (Get-FileHash $argsSrc).Hash -ne (Get-FileHash $argsDst).Hash) {
    Copy-Item $argsSrc $argsDst -Force
}

$env:NINJA_SUMMARIZE_BUILD = '1'
$timer = [Diagnostics.Stopwatch]::StartNew()

Push-Location $ChromiumSrc
try {
    Invoke-Checked cmd /c "gn gen $outRel"
    Invoke-Checked cmd /c "autoninja -C $outRel $Target"
}
finally { Pop-Location }

$timer.Stop()
$elapsed = '{0:hh\:mm\:ss}' -f $timer.Elapsed
$log = Join-Path $RepoRoot 'docs\build-times.md'
if (-not (Test-Path $log)) {
    New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
    "| Date | Chromium | Config | Target | Time |`n|---|---|---|---|---|" | Set-Content -Encoding utf8 $log
}
"| $(Get-Date -Format 'yyyy-MM-dd HH:mm') | $ChromiumTag | $Config | $Target | $elapsed |" | Add-Content -Encoding utf8 $log
Write-Host "Built $Target ($Config) in $elapsed -> $outDir"
