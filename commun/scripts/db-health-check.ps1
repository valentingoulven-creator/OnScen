# DB + backup health check (local or prod API)
param(
    [string]$BaseUrl = 'https://getsoundy.com',
    [string]$BackupDir = '',
    [int]$MaxBackupAgeHours = 36
)

$ErrorActionPreference = 'Continue'
$fail = 0

Write-Host ''
Write-Host '=============================================='
Write-Host "  DB health check - $BaseUrl"
Write-Host '=============================================='
Write-Host ''

try {
    $healthDbUrl = if ($BaseUrl -match '/api$') { "$BaseUrl/../health/db" } else { "$BaseUrl/health/db" }
    $raw = Invoke-WebRequest -Uri $healthDbUrl -TimeoutSec 20 -UseBasicParsing
    if ($raw.Content -match '<!doctype html') {
        Write-Host 'WARN: /health/db not deployed yet (SPA HTML returned). Deploy MODIF 667 first.' -ForegroundColor Yellow
    } else {
        $r = $raw.Content | ConvertFrom-Json
        $r | ConvertTo-Json -Depth 6
        if (-not $r.ok) {
            Write-Host 'ERROR: /health/db report.ok is false' -ForegroundColor Red
            if ($r.warnings) { $r.warnings | ForEach-Object { Write-Host "  ! $_" -ForegroundColor Yellow } }
            $fail = 1
        } else {
            Write-Host 'OK: PostgreSQL content looks consistent' -ForegroundColor Green
        }
    }
} catch {
    Write-Host "ERROR: /health/db unreachable: $($_.Exception.Message)" -ForegroundColor Red
    $fail = 1
}

Write-Host ''
Write-Host '--- Backups ---'

if (-not $BackupDir) {
    foreach ($c in @('C:\opt\soundly\backups', '/opt/onscen/backups')) {
        if (Test-Path $c) { $BackupDir = $c; break }
    }
}

if (-not $BackupDir -or -not (Test-Path $BackupDir)) {
    Write-Host 'INFO: no local backup folder (normal on dev Windows)' -ForegroundColor Yellow
    Write-Host '      On VPS run: bash /opt/onscen/deploy/db-health-check.sh'
} else {
    $latest = Get-ChildItem -Path $BackupDir -Filter 'soundy-*.sql.gz' -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if (-not $latest) {
        Write-Host "WARN: no soundy-*.sql.gz in $BackupDir" -ForegroundColor Yellow
        $fail = 1
    } else {
        $ageH = [math]::Round(((Get-Date) - $latest.LastWriteTime).TotalHours, 1)
        Write-Host "Latest backup: $($latest.Name) age=${ageH} hours"
        if ($ageH -gt $MaxBackupAgeHours) {
            Write-Host "WARN: backup older than $MaxBackupAgeHours hours" -ForegroundColor Yellow
            $fail = 1
        }
    }
}

Write-Host ''
if ($fail -eq 0) {
    Write-Host 'Result: OK' -ForegroundColor Green
    exit 0
}
Write-Host 'Result: ISSUES' -ForegroundColor Red
exit 1
