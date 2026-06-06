# PC dev : HTTP only, open browser, run msdev:server
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $root

$env:MSDEV_HTTPS = '0'
$env:WEB_APP_URL = 'http://localhost:4080'

$listening = Get-NetTCPConnection -LocalPort 4080 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Start-Job -ScriptBlock {
    for ($i = 0; $i -lt 45; $i++) {
      Start-Sleep -Seconds 1
      try {
        $c = New-Object Net.Sockets.TcpClient
        $c.Connect('127.0.0.1', 4080)
        $c.Close()
        Start-Process 'http://localhost:4080'
        break
      } catch {
        # wait for server
      }
    }
  } | Out-Null
} else {
  Start-Process 'http://localhost:4080'
}

npm run msdev:server
exit $LASTEXITCODE
