# Create Soundy prod account for YouTube API audit demo.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/create-youtube-audit-demo-account.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$credFile = Join-Path $root 'docs/youtube-audit-demo-credentials.local.txt'

$stamp = Get-Date -Format 'yyyyMMddHHmm'
$username = "yt_audit_$stamp"
$email = "yt.audit.$stamp.soundy@gmail.com"
$password = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 20 | ForEach-Object { [char]$_ }) + '!9'

Write-Host "Creation compte demo: $email" -ForegroundColor Cyan

$body = @{
  username     = $username
  email        = $email
  password     = $password
  acceptTerms  = $true
  termsVersion = '2026-06-03'
  confirmAge   = $true
} | ConvertTo-Json

try {
  $res = Invoke-RestMethod -Uri 'https://getsoundy.com/api/auth/register' -Method POST -ContentType 'application/json' -Body $body
} catch {
  Write-Host "Echec inscription: $_" -ForegroundColor Red
  exit 1
}

Write-Host 'Inscription OK — verification email en base...' -ForegroundColor Yellow

$verifyScript = Join-Path $root 'scripts/verify-demo-user-prod.js'
scp $verifyScript soundy-prod:/opt/soundy/scripts/verify-demo-user-prod.js | Out-Null
ssh soundy-prod "cd /opt/soundy && node scripts/verify-demo-user-prod.js $email" | Out-Null
ssh soundy-prod 'pm2 reload melosong-backend' | Out-Null
Start-Sleep -Seconds 8

$login = Invoke-RestMethod -Uri 'https://getsoundy.com/api/auth/login' -Method POST -ContentType 'application/json' -Body (@{ email = $email; password = $password } | ConvertTo-Json)
if (-not $login.token) { throw 'Login apres creation a echoue' }

$content = @"
# Compte demo audit YouTube — NE PAS COMMITTER (local only)
# Genere le $(Get-Date -Format 'yyyy-MM-dd HH:mm')

Email Soundy   : $email
Mot de passe   : $password
Pseudo         : $username
User ID        : $($res.user.id)

URL            : https://getsoundy.com

IMPORTANT Google OAuth :
- Le compte GOOGLE utilise pour « Connecter YouTube » peut etre different.
- Ajoutez ce Gmail (ou celui de votre chaine YouTube) en Test user dans Google Cloud Console.
- OAuth consent screen -> Test users

A coller dans le formulaire Google (Test credentials) :
Email: $email
Password: $password

Demo script: docs/YOUTUBE-AUDIT-DEMO.md
"@

Set-Content -Path $credFile -Value $content -Encoding UTF8
Write-Host "Credentials: $credFile" -ForegroundColor Green
Write-Host $content
