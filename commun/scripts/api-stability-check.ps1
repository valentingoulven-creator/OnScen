# Smoke test API stability - public endpoints (no auth required)
param(
    [string]$BaseUrl = 'https://onscen.com',
    [int]$HealthRepeats = 10
)

$ErrorActionPreference = 'Continue'

$endpoints = @(
    @{ Method = 'GET'; Path = '/health'; Expect = 200; Label = 'Health' },
    @{ Method = 'GET'; Path = '/api/config'; Expect = 200; Label = 'Config' },
    @{ Method = 'GET'; Path = '/api/access/config'; Expect = 200; Label = 'Access config' },
    @{ Method = 'GET'; Path = '/api/auth/providers'; Expect = 200; Label = 'OAuth providers' },
    @{ Method = 'GET'; Path = '/api/platforms/status'; Expect = 401; Label = 'Platform status unauth' },
    @{ Method = 'GET'; Path = '/api/sponsors/map'; Expect = 200; Label = 'Map sponsors' },
    @{ Method = 'GET'; Path = '/api/news'; Expect = 200; Label = 'News' },
    @{ Method = 'GET'; Path = '/api/trending/users'; Expect = 401; Label = 'Trending users unauth' },
    @{ Method = 'GET'; Path = '/api/music/home'; Expect = 401; Label = 'Music home unauth' },
    @{ Method = 'GET'; Path = '/api/salons'; Expect = 401; Label = 'Salons list unauth' },
    @{ Method = 'GET'; Path = '/api/lives'; Expect = 401; Label = 'Lives list unauth' },
    @{ Method = 'GET'; Path = '/privacy'; Expect = 200; Label = 'Privacy page' },
    @{ Method = 'GET'; Path = '/terms'; Expect = 200; Label = 'Terms page' },
    @{ Method = 'POST'; Path = '/api/access/admin/sponsors/upload-banner'; Body = '{"image":""}'; Expect = 401; Label = 'Sponsor upload unauth' }
)

function Test-Endpoint {
    param($Ep)
    $url = "$BaseUrl$($Ep.Path)"
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $params = @{
            Uri             = $url
            Method          = $Ep.Method
            UseBasicParsing = $true
            TimeoutSec      = 15
        }
        if ($Ep.Body) {
            $params['ContentType'] = 'application/json'
            $params['Body'] = $Ep.Body
        }
        $r = Invoke-WebRequest @params
        $code = [int]$r.StatusCode
        $sw.Stop()
        $ok = ($code -eq $Ep.Expect)
        $bodyPreview = if ($r.Content.Length -gt 120) { $r.Content.Substring(0, 120) + '...' } else { $r.Content }
        [PSCustomObject]@{
            Label   = $Ep.Label
            Path    = $Ep.Path
            Status  = $code
            Expect  = $Ep.Expect
            OK      = $ok
            Ms      = [math]::Round($sw.Elapsed.TotalMilliseconds)
            Preview = $bodyPreview
        }
    } catch {
        $sw.Stop()
        $code = 0
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode.value__
        }
        $ok = ($code -eq $Ep.Expect)
        $err = $_.Exception.Message
        [PSCustomObject]@{
            Label   = $Ep.Label
            Path    = $Ep.Path
            Status  = $code
            Expect  = $Ep.Expect
            OK      = $ok
            Ms      = [math]::Round($sw.Elapsed.TotalMilliseconds)
            Preview = $err
        }
    }
}

Write-Host ''
Write-Host '=============================================='
Write-Host "  API stability check - $BaseUrl"
Write-Host '=============================================='
Write-Host ''

$results = foreach ($ep in $endpoints) { Test-Endpoint $ep }
$results | Format-Table Label, Status, Expect, OK, Ms -AutoSize

$passed = @($results | Where-Object { $_.OK }).Count
$failed = @($results | Where-Object { -not $_.OK }).Count
Write-Host "Endpoints: $passed OK / $($results.Count) total ($failed failed)"
Write-Host ''

Write-Host "--- Health latency ($HealthRepeats repeats) ---"
$latencies = @()
for ($i = 1; $i -le $HealthRepeats; $i++) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $r = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing -TimeoutSec 10
        $sw.Stop()
        $json = $r.Content | ConvertFrom-Json
        $latencies += $sw.Elapsed.TotalMilliseconds
        Write-Host ("  #{0}: {1}ms - status={2} db={3}" -f $i, [math]::Round($sw.Elapsed.TotalMilliseconds), $json.status, $json.db)
    } catch {
        $sw.Stop()
        Write-Host ("  #{0}: FAIL ({1}ms) - {2}" -f $i, [math]::Round($sw.Elapsed.TotalMilliseconds), $_.Exception.Message)
    }
    Start-Sleep -Milliseconds 300
}
if ($latencies.Count -gt 0) {
    $avg = ($latencies | Measure-Object -Average).Average
    $max = ($latencies | Measure-Object -Maximum).Maximum
    Write-Host ("  avg={0}ms max={1}ms" -f [math]::Round($avg), [math]::Round($max))
}

if ($failed -gt 0) {
    Write-Host ''
    Write-Host 'FAILED details:'
    $results | Where-Object { -not $_.OK } | ForEach-Object {
        Write-Host "  $($_.Label) [$($_.Path)]: got $($_.Status), expected $($_.Expect)"
        Write-Host "    $($_.Preview)"
    }
    exit 1
}
exit 0
