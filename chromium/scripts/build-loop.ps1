# Runs the Chromium compile and, when midl.exe output differs from the checked-in
# expectations (SDK 10.0.28000.0 here vs 10.0.28000.2270 in Chromium's pin), applies
# the rebaseline that the build itself prints, then compiles again.
# Only midl "rebaseline" failures are handled automatically; any other failure stops the loop.

param([int]$MaxRounds = 15, [int]$Jobs = 3, [string]$OutDir = 'out\Dev', [string]$Target = 'chrome',
      [string]$Log = "$env:LOCALAPPDATA\Temp\visib-build-loop.log")

$ErrorActionPreference = 'Continue'
$src = 'D:\src\chromium\src'
$env:DEPOT_TOOLS_WIN_TOOLCHAIN = '0'
$env:vs2026_install = 'D:\VS2026'
$env:PATH = "D:\src\depot_tools;$env:PATH"
$env:NINJA_SUMMARIZE_BUILD = '1'

for ($round = 1; $round -le $MaxRounds; $round++) {
    Add-Content $Log "=== round $round $(Get-Date -Format HH:mm:ss)"
    $start = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    Set-Content "C:\Users\zakha\Desktop\VISIB\chromium\progress\state\build.start" $start

    $out = "$env:LOCALAPPDATA\Temp\visib-build-round.log"
    cmd /c "cd /d $src && autoninja -C $OutDir -j $Jobs $Target > `"$out`" 2>&1"
    $code = $LASTEXITCODE
    Get-Content $out | Add-Content $Log

    $text = Get-Content $out -Raw
    if ($code -eq 0 -and $text -notmatch 'FAILED:') {
        Add-Content $Log "BUILD OK after round $round"
        exit 0
    }

    # Find the rebaseline copy the build prints: copy /y <tmp>\* <expected dir>
    $m = [regex]::Match($text, 'copy /y (\S+)\\\*\s+(\S+)')
    $isMidl = $text -match 'midl.exe output different from files'
    if (-not $isMidl -or -not $m.Success) {
        Add-Content $Log "STOP: failure is not a midl rebaseline case"
        exit 1
    }

    $tmp = $m.Groups[1].Value
    # The printed destination is relative to out\Dev: strip the leading ..\..\ (either slash) and anchor it at src.
    $rel = $m.Groups[2].Value -replace '^(\.\.[\\/])+', ''
    $dst = Join-Path $src $rel
    if (-not (Resolve-Path $src).Path -or $dst -notlike "$src*") { Add-Content $Log "STOP: destination outside src: $dst"; exit 3 }
    New-Item -ItemType Directory -Force $dst | Out-Null
    Copy-Item (Join-Path $tmp '*') $dst -Force
    Add-Content $Log "rebaselined midl output -> $dst"
}
Add-Content $Log "STOP: reached $MaxRounds rounds"
exit 2
