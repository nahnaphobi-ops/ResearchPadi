param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$SessionId = "test-session",
    [int]$MaxConcurrent = 100,
    [int]$DurationSeconds = 60,
    [int]$RampUpSeconds = 10
)

$ErrorActionPreference = "SilentlyContinue"
$results = [System.Collections.ArrayList]::new()
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
$activeRequests = 0
$completedRequests = 0
$failedRequests = 0
$latencies = [System.Collections.ArrayList]::new()

Write-Host "=== ResearchPadi Load Test ===" -ForegroundColor Cyan
Write-Host "Target: $BaseUrl" -ForegroundColor Yellow
Write-Host "Max Concurrent: $MaxConcurrent" -ForegroundColor Yellow
Write-Host "Duration: ${DurationSeconds}s" -ForegroundColor Yellow
Write-Host "Ramp-up: ${RampUpSeconds}s" -ForegroundColor Yellow
Write-Host "==============================" -ForegroundColor Cyan

# Progress tracking
$lastReport = [System.Diagnostics.Stopwatch]::StartNew()

while ($stopwatch.Elapsed.TotalSeconds -lt $DurationSeconds) {
    $elapsed = $stopwatch.Elapsed.TotalSeconds

    # Calculate target concurrency (ramp-up then steady)
    if ($elapsed -lt $RampUpSeconds) {
        $targetConcurrent = [Math]::Max(1, [int]($MaxConcurrent * ($elapsed / $RampUpSeconds)))
    } else {
        $targetConcurrent = $MaxConcurrent
    }

    # Launch requests up to target concurrency
    while ($activeRequests -lt $targetConcurrent) {
        $activeRequests++

        $null = [System.Threading.Tasks.Task]::Run([Action]{
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            try {
                $url = "$using:BaseUrl/api/workspace/$using:SessionId"
                $req = [System.Net.HttpWebRequest]::Create($url)
                $req.Method = "GET"
                $req.Timeout = 10000
                $req.ReadWriteTimeout = 10000

                $resp = $req.GetResponse()
                $stream = $resp.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $null = $reader.ReadToEnd()
                $reader.Close()
                $resp.Close()

                $sw.Stop()
                $lat = $sw.ElapsedMilliseconds

                lock ($using:latencies) {
                    $using:latencies.Add($lat) | Out-Null
                }
                $using:completedRequests++
            } catch {
                $using:failedRequests++
            } finally {
                $using:activeRequests--
            }
        })
    }

    # Report every 5 seconds
    if ($lastReport.Elapsed.TotalSeconds -ge 5) {
        $lastReport.Restart()
        $p50 = 0; $p95 = 0; $p99 = 0; $avg = 0
        $count = 0
        lock ($latencies) {
            $count = $latencies.Count
            if ($count -gt 0) {
                $sorted = $latencies | Sort-Object
                $avg = [Math]::Round(($sorted | Measure-Object -Average).Average, 1)
                $p50 = $sorted[[Math]::Floor($count * 0.50)]
                $p95 = $sorted[[Math]::Floor($count * 0.95)]
                $p99 = $sorted[[Math]::Floor($count * 0.99)]
            }
        }
        $rps = [Math]::Round($completedRequests / [Math]::Max(1, $elapsed), 1)
        $errRate = if (($completedRequests + $failedRequests) -gt 0) {
            [Math]::Round(100 * $failedRequests / ($completedRequests + $failedRequests), 2)
        } else { 0 }

        Write-Host "`n[$([Math]::Round($elapsed,1))s] Active: $activeRequests | RPS: $rps | Completed: $completedRequests | Failed: $failedRequests ($errRate%)" -ForegroundColor Green
        Write-Host "  Latency — Avg: ${avg}ms | P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms" -ForegroundColor Yellow
    }

    Start-Sleep -Milliseconds 50
}

# Wait for in-flight requests
Write-Host "`nWaiting for in-flight requests..." -ForegroundColor Gray
$waitStart = [System.Diagnostics.Stopwatch]::StartNew()
while ($activeRequests -gt 0 -and $waitStart.Elapsed.TotalSeconds -lt 30) {
    Start-Sleep -Milliseconds 100
}

$stopwatch.Stop()

# Final report
$count = 0; $avg = 0; $p50 = 0; $p95 = 0; $p99 = 0; $min = 0; $max = 0
lock ($latencies) {
    $count = $latencies.Count
    if ($count -gt 0) {
        $sorted = $latencies | Sort-Object
        $avg = [Math]::Round(($sorted | Measure-Object -Average).Average, 1)
        $min = $sorted[0]
        $max = $sorted[-1]
        $p50 = $sorted[[Math]::Floor($count * 0.50)]
        $p95 = $sorted[[Math]::Floor($count * 0.95)]
        $p99 = $sorted[[Math]::Floor($count * 0.99)]
    }
}
$totalRequests = $completedRequests + $failedRequests
$errRate = if ($totalRequests -gt 0) { [Math]::Round(100 * $failedRequests / $totalRequests, 2) } else { 0 }
$rps = [Math]::Round($completedRequests / [Math]::Max(1, $stopwatch.Elapsed.TotalSeconds), 1)
$duration = [Math]::Round($stopwatch.Elapsed.TotalSeconds, 1)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "         FINAL LOAD TEST RESULTS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Duration:        ${duration}s"
Write-Host "  Total Requests:  $totalRequests"
Write-Host "  Completed:       $completedRequests"
Write-Host "  Failed:          $failedRequests ($errRate%)"
Write-Host "  Throughput:      ${rps} req/s"
Write-Host "  Max Concurrent:  $MaxConcurrent"
Write-Host "  ----------------------------------------" -ForegroundColor Gray
Write-Host "  Latency (ms):" -ForegroundColor Yellow
Write-Host "    Min:   $min"
Write-Host "    Avg:   $avg"
Write-Host "    P50:   $p50"
Write-Host "    P95:   $p95"
Write-Host "    P99:   $p99"
Write-Host "    Max:   $max"
Write-Host "========================================" -ForegroundColor Cyan

# Verdict
$pass = $true
if ($p95 -gt 200) { Write-Host "  FAIL: P95 latency > 200ms" -ForegroundColor Red; $pass = $false }
if ($errRate -gt 0.1) { Write-Host "  FAIL: Error rate > 0.1%" -ForegroundColor Red; $pass = $false }
if ($pass) { Write-Host "  PASS: All thresholds met!" -ForegroundColor Green }
