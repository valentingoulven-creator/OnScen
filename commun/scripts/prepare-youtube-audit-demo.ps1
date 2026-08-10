# Prepare YouTube API audit screencast - opens prod + verifies prerequisites.
# Usage: powershell -ExecutionPolicy Bypass -File commun/scripts/prepare-youtube-audit-demo.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$credFile = Join-Path $root 'commun/docs/youtube-audit-demo-credentials.local.txt'

Write-Host ''
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host '  OnScen - prep demo audit YouTube API' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ''

$urls = @(
  'https://getsoundy.com/health',
  'https://getsoundy.com/legal/privacy?lang=fr',
  'https://getsoundy.com/legal/terms?lang=fr',
  'https://getsoundy.com/legal/api-platforms?lang=fr'
)

Write-Host '[1/4] Verification URLs prod...' -ForegroundColor Yellow
foreach ($u in $urls) {
  try {
    $code = (curl.exe -s -o NUL -w '%{http_code}' $u)
    $ok = $code -eq '200'
    Write-Host "  $(if ($ok) { 'OK' } else { 'FAIL' }) $code $u" -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
  } catch {
    Write-Host "  FAIL $u" -ForegroundColor Red
  }
}

Write-Host ''
Write-Host '[2/4] OAuth YouTube prod...' -ForegroundColor Yellow
if (Test-Path $credFile) {
  $content = Get-Content $credFile -Raw
  if ($content -match 'Email OnScen\s*:\s*(.+)') { $email = $Matches[1].Trim() }
  if ($content -match 'Mot de passe\s*:\s*(.+)') { $pass = $Matches[1].Trim() }
  try {
    $loginBody = @{ email = $email; password = $pass } | ConvertTo-Json
    $login = Invoke-RestMethod -Uri 'https://getsoundy.com/api/auth/login' -Method POST -ContentType 'application/json' -Body $loginBody
    $status = Invoke-RestMethod -Uri 'https://getsoundy.com/api/platforms/status' -Headers @{ Authorization = "Bearer $($login.token)" }
    Write-Host "  youtubeOAuthAvailable: $($status.youtubeOAuthAvailable)" -ForegroundColor $(if ($status.youtubeOAuthAvailable) { 'Green' } else { 'Red' })
    Write-Host "  Compte test login: OK ($email)" -ForegroundColor Green
  } catch {
    Write-Host "  Login compte demo echoue - voir $credFile" -ForegroundColor Red
  }
} else {
  Write-Host "  Fichier credentials absent: $credFile" -ForegroundColor DarkYellow
  Write-Host '  Lancez create-youtube-audit-demo-account.ps1' -ForegroundColor DarkYellow
}

Write-Host ''
Write-Host '[3/4] Ouverture navigateur (getsoundy.com)...' -ForegroundColor Yellow
Start-Process 'https://getsoundy.com'
Start-Sleep -Seconds 1
Start-Process 'https://getsoundy.com/legal/privacy?lang=fr'

Write-Host ''
Write-Host '[4/4] Enregistrement ecran' -ForegroundColor Yellow
Write-Host '  Windows : Win+G (Xbox Game Bar) ou Win+Alt+R' -ForegroundColor White
Write-Host '  Ou Loom : https://www.loom.com/screen-recorder' -ForegroundColor White
Write-Host ''
Write-Host 'Script demo : docs/YOUTUBE-AUDIT-DEMO.md' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Google Cloud : ajoutez le compte GOOGLE (YouTube) en Test users' -ForegroundColor Magenta
Write-Host '  OAuth consent screen -> Test users -> votre Gmail avec chaine YouTube' -ForegroundColor Magenta
Write-Host ''
