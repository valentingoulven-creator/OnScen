# Installe hook git post-commit + tâche Windows (connexion) + watcher docs → Google Drive
# Usage: npm run docs:gdrive:install
param(
    [switch]$SkipGitHook,
    [switch]$SkipLogonTask
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$ensureScript = Join-Path $root 'commun\scripts\ensure-docs-gdrive-watch.ps1'
Set-Location $root

Write-Host ''
Write-Host ' Google Drive — sync documentation' -ForegroundColor Cyan
Write-Host ''

$machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
$userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = "$machinePath;$userPath"

if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) {
    Write-Host '[!] rclone absent — winget install Rclone.Rclone' -ForegroundColor Yellow
} else {
    $conf = Join-Path $env:APPDATA 'rclone\rclone.conf'
    if (-not (Test-Path $conf)) {
        Write-Host '[!] Autorisez Google Drive une fois:' -ForegroundColor Yellow
        Write-Host '    rclone authorize drive'
        Write-Host '    Puis ajoutez le remote gdrive-soundy (voir commun/docs/GOOGLE-DRIVE-DOCS-SYNC.md)'
    } else {
        Write-Host '[OK] rclone + config détectés' -ForegroundColor Green
    }
}

if (-not $SkipGitHook) {
    $hookDir = Join-Path $root '.git/hooks'
    if (-not (Test-Path $hookDir)) {
        Write-Host '[!] .git/hooks absent — hook post-commit non installé' -ForegroundColor Yellow
    } else {
        $hookPath = Join-Path $hookDir 'post-commit'
        $marker = '# soundy-docs-gdrive-sync'
        $hookBody = @"
#!/bin/sh
$marker
if git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null | grep -E '^(commun/docs/|docs/)' | grep -qv node_modules; then
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File commun/scripts/sync-docs-gdrive.ps1 -Quiet || true
fi
"@
        if (Test-Path $hookPath) {
            $existing = Get-Content -Raw $hookPath
            if ($existing -match [regex]::Escape($marker)) {
                Write-Host '[OK] Hook post-commit déjà présent' -ForegroundColor Green
            } else {
                Add-Content -Path $hookPath -Value "`n$hookBody"
                Write-Host '[OK] Hook post-commit complété (docs gdrive)' -ForegroundColor Green
            }
        } else {
            [System.IO.File]::WriteAllText($hookPath, $hookBody + "`n")
            Write-Host '[OK] Hook post-commit installé' -ForegroundColor Green
        }
    }
}

if (-not $SkipLogonTask) {
    $taskName = 'Soundy-Docs-GDrive-Watch'
    try {
        $action = New-ScheduledTaskAction `
            -Execute 'powershell.exe' `
            -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ensureScript`" -Quiet" `
            -WorkingDirectory $root
        $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
        $settings = New-ScheduledTaskSettingsSet `
            -AllowStartIfOnBatteries `
            -DontStopIfGoingOnBatteries `
            -StartWhenAvailable `
            -RestartCount 3 `
            -RestartInterval (New-TimeSpan -Minutes 2)
        $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
        $existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
        if ($existing) {
            Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        }
        Register-ScheduledTask `
            -TaskName $taskName `
            -Action $action `
            -Trigger $trigger `
            -Settings $settings `
            -Principal $principal `
            -Description 'Soundy — sync doc vers Google Drive à chaque modification (sans commit)' | Out-Null
        Write-Host '[OK] Tâche planifiée à la connexion Windows installée' -ForegroundColor Green
    } catch {
        Write-Host "[!] Tâche planifiée non installée: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host '    Lancez manuellement: npm run docs:gdrive:ensure'
    }
}

& $ensureScript -Quiet
if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne $null) {
    # ensure returns 0 usually; ignore
}

Write-Host ''
Write-Host ' Sync continue (sans commit obligatoire) :' -ForegroundColor Green
Write-Host '  • Watcher Node — dès qu''un fichier docs/ change (~3 s debounce)'
Write-Host '  • À la connexion Windows (tâche Soundy-Docs-GDrive-Watch)'
Write-Host '  • À npm run dev (ensure watcher)'
Write-Host '  • npm run docs:gdrive:ensure  (redémarrer le watcher si besoin)'
Write-Host '  • npm run docs:gdrive:sync     (manuel)'
Write-Host '  • git commit docs/             (post-commit, secours)'
Write-Host ''
