# ==============================================================================
# Dentist App — Unified Startup Script
# ==============================================================================
param(
    [switch]$NoBrowser,
    [switch]$IncludeLandingPage
)

$ErrorActionPreference = "Continue"
$projectRoot = $PSScriptRoot
if (-not $projectRoot) { $projectRoot = Get-Location }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Starting Dentist App Stack...         " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

function Test-PortOpen([int]$port) {
    try {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        return ($null -ne $conn)
    } catch {
        return $false
    }
}

$totalSteps = if ($IncludeLandingPage) { 5 } else { 4 }

# 1. PostgreSQL Database in Docker
Write-Host "`n[1/$totalSteps] Checking PostgreSQL Docker container..." -ForegroundColor Yellow
$containers = docker ps --format "{{.Names}}" 2>$null
if ($containers -notcontains "dentist-db") {
    Write-Host "  -> Starting Docker PostgreSQL (dentist-db)..." -ForegroundColor Gray
    docker compose -f "$projectRoot\docker-compose.yml" up -d db
} else {
    Write-Host "  -> PostgreSQL container is already running." -ForegroundColor Green
}

# 2. Local .NET 8 Backend API (Port 8080)
Write-Host "`n[2/$totalSteps] Checking .NET Backend API (:8080)..." -ForegroundColor Yellow
if (-not (Test-PortOpen 8080)) {
    if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
        Write-Warning ".NET SDK ('dotnet') not found in PATH. Install .NET SDK 8 or 10 before starting."
    } else {
        Write-Host "  -> Launching .NET 8 API on http://localhost:8080..." -ForegroundColor Gray
        Start-Process -FilePath "dotnet" `
            -ArgumentList "run" `
            -WorkingDirectory "$projectRoot\dentist backend" `
            -WindowStyle Hidden
    }
} else {
    Write-Host "  -> .NET Backend API is already listening on :8080." -ForegroundColor Green
}

# 3. FastAPI SMS Gateway (Port 8000)
Write-Host "`n[3/$totalSteps] Checking FastAPI SMS Gateway (:8000)..." -ForegroundColor Yellow
if (-not (Test-PortOpen 8000)) {
    Write-Host "  -> Launching SMS Gateway on http://localhost:8000..." -ForegroundColor Gray
    $pythonPath = "$projectRoot\sms\.venv\Scripts\python.exe"
    if (Test-Path $pythonPath) {
        Start-Process -FilePath $pythonPath `
            -ArgumentList "-m uvicorn app.main:app --port 8000" `
            -WorkingDirectory "$projectRoot\sms" `
            -WindowStyle Hidden
    } else {
        Write-Warning "Python venv not found at $pythonPath. Run 'python -m venv .venv' inside sms directory."
    }
} else {
    Write-Host "  -> FastAPI SMS Gateway is already listening on :8000." -ForegroundColor Green
}

# 4. React Frontend (Port 5173)
Write-Host "`n[4/$totalSteps] Checking Frontend Dev Server (:5173)..." -ForegroundColor Yellow
if (-not (Test-PortOpen 5173)) {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Warning "Node.js / npm not found in PATH. Install Node.js 20+ before starting."
    } else {
        $nodeModules = "$projectRoot\dentist front\node_modules"
        if (-not (Test-Path $nodeModules)) {
            Write-Warning "Node modules not found at '$nodeModules'. Run 'npm install' inside 'dentist front' before starting."
        } else {
            Write-Host "  -> Launching Vite dev server on http://localhost:5173..." -ForegroundColor Gray
            Start-Process -FilePath "cmd.exe" `
                -ArgumentList "/c npm run dev" `
                -WorkingDirectory "$projectRoot\dentist front" `
                -WindowStyle Hidden
        }
    }
} else {
    Write-Host "  -> Frontend dev server is already listening on :5173." -ForegroundColor Green
}

# 5. Landing Page Showcase (Port 5174)
if ($IncludeLandingPage) {
    Write-Host "`n[5/$totalSteps] Checking Landing Page Dev Server (:5174)..." -ForegroundColor Yellow
    if (-not (Test-PortOpen 5174)) {
        if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
            Write-Warning "Node.js / npm not found in PATH. Install Node.js 20+ before starting."
        } else {
            $landingModules = "$projectRoot\dr-nadia-clinic\node_modules"
            if (-not (Test-Path $landingModules)) {
                Write-Warning "Node modules not found at '$landingModules'. Run 'npm install' inside 'dr-nadia-clinic' before starting."
            } else {
                Write-Host "  -> Launching Landing Page dev server on http://localhost:5174..." -ForegroundColor Gray
                Start-Process -FilePath "cmd.exe" `
                    -ArgumentList "/c npm run dev" `
                    -WorkingDirectory "$projectRoot\dr-nadia-clinic" `
                    -WindowStyle Hidden
            }
        }
    } else {
        Write-Host "  -> Landing Page dev server is already listening on :5174." -ForegroundColor Green
    }
}

# Wait briefly for services to be ready
Write-Host "`nVerifying stack health..." -ForegroundColor Gray
Start-Sleep -Seconds 2

$frontendReady = Test-PortOpen 5173
$backendReady  = Test-PortOpen 8080
$smsReady      = Test-PortOpen 8000
$landingReady  = if ($IncludeLandingPage) { Test-PortOpen 5174 } else { $false }

Write-Host "`n----------------------------------------" -ForegroundColor Cyan
Write-Host " Stack Status Summary:                  " -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host ("  [+] Frontend (React SPA) : " + $(if ($frontendReady) { "RUNNING -> http://localhost:5173" } else { "STARTING / PENDING" })) -ForegroundColor $(if ($frontendReady) { "Green" } else { "Yellow" })
if ($IncludeLandingPage) {
    Write-Host ("  [+] Landing Page (Vite)  : " + $(if ($landingReady) { "RUNNING -> http://localhost:5174" } else { "STARTING / PENDING" })) -ForegroundColor $(if ($landingReady) { "Green" } else { "Yellow" })
}
Write-Host ("  [+] Backend (.NET API)   : " + $(if ($backendReady)  { "RUNNING -> http://localhost:8080" } else { "OFFLINE" })) -ForegroundColor $(if ($backendReady)  { "Green" } else { "Red" })
Write-Host ("  [+] SMS Gateway (FastAPI): " + $(if ($smsReady)      { "RUNNING -> http://localhost:8000" } else { "STARTING / PENDING" })) -ForegroundColor $(if ($smsReady)      { "Green" } else { "Yellow" })
Write-Host "----------------------------------------" -ForegroundColor Cyan

if (-not $NoBrowser -and $frontendReady) {
    Write-Host "`nOpening Dashboard in browser: http://localhost:5173" -ForegroundColor Green
    Start-Process "http://localhost:5173"
}

