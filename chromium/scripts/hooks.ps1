# Runs gclient hooks (toolchain downloads, generated files). Needs Visual Studio installed.

. "$PSScriptRoot\env.ps1"

Push-Location $ChromiumSrc
try { Invoke-Checked cmd /c 'gclient runhooks' }
finally { Pop-Location }
