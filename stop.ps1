# ==============================================================================
# Dentist App — Unified Stop Script
# ==============================================================================
param(
    [switch]$IncludeDocker
)

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Stopping Dentist App Host Services...  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

function Stop-ProcessByPort([int]$port, [string]$name) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($conn in $conns) {
                $pidToKill = $conn.OwningProcess
                if ($pidToKill -gt 0) {
                    Write-Host "  -> Stopping $name (PID $pidToKill on port $port)..." -ForegroundColor Yellow
                    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                }
            }
        } else {
            Write-Host "  -> $name (: $port) is not running." -ForegroundColor Gray
        }
    } catch {
        Write-Warning "Failed to stop process on port $port: $_"
    }
}

Stop-ProcessByPort -port 5173 -name "Frontend Dev Server (Admin Dashboard)"
Stop-ProcessByPort -port 5174 -name "Landing Page Dev Server"
Stop-ProcessByPort -port 8080 -name "Backend API (.NET)"
Stop-ProcessByPort -port 8000 -name "FastAPI SMS Gateway"

if ($IncludeDocker) {
    Write-Host "`nStopping Docker services..." -ForegroundColor Yellow
    docker compose -f "$PSScriptRoot\docker-compose.yml" stop
} else {
    Write-Host "`nNote: Docker containers (dentist-api, dentist-db) were left running." -ForegroundColor Gray
    Write-Host "Run '.\stop.ps1 -IncludeDocker' or 'docker compose stop' if you wish to stop them too." -ForegroundColor Gray
}

Write-Host "`nDone." -ForegroundColor Green
