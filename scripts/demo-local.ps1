# Investor demo — run locally if Render is down
# Usage (PowerShell, from repo root):
#   .\scripts\demo-local.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = Get-Location }

Write-Host "== ResearchPadi local demo ==" -ForegroundColor Cyan

# Backend env (matches known ResearchPadi Supabase project).
# Secrets are never stored here: set them in your shell first, e.g.
#   $env:SUPABASE_SERVICE_ROLE_KEY = "..."; $env:DATABASE_URL = "..."; $env:JWT_SECRET = "..."
$env:NODE_ENV = "production"
$env:PORT = "5000"
$env:ADMIN_MFA = "false"
$env:SUPABASE_URL = "https://bpmfpxkuknchflpctmbr.supabase.co"
$env:FRONTEND_URL = "http://localhost:5173"
$env:SUPABASE_PROJECT_REF = "bpmfpxkuknchflpctmbr"

$missing = @("SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL", "JWT_SECRET") |
  Where-Object { -not [Environment]::GetEnvironmentVariable($_) }
if ($missing) {
  Write-Host "Set these in your shell before running the demo: $($missing -join ', ')" -ForegroundColor Red
  exit 1
}

if (-not $env:ANTHROPIC_API_KEY) {
  Write-Host "WARN: ANTHROPIC_API_KEY not set — paper AI will be limited" -ForegroundColor Yellow
}
if (-not $env:OPENAI_API_KEY) {
  Write-Host "WARN: OPENAI_API_KEY not set — some AI features will be limited" -ForegroundColor Yellow
}

Push-Location (Join-Path $root "backend")
if (-not (Test-Path "node_modules")) { npm install --legacy-peer-deps --no-audit --no-fund }
npm run build
Write-Host "Starting API on http://localhost:5000 ..." -ForegroundColor Green
Start-Process -NoNewWindow -FilePath "node" -ArgumentList "dist/index.js" -WorkingDirectory (Get-Location)
Pop-Location

Start-Sleep -Seconds 2
Push-Location (Join-Path $root "frontend")
if (-not (Test-Path "node_modules")) { npm install --legacy-peer-deps --no-audit --no-fund }
$env:VITE_API_URL = "http://localhost:5000/api"
Write-Host "Starting frontend on http://localhost:5173 ..." -ForegroundColor Green
Write-Host ""
Write-Host "Demo checklist:" -ForegroundColor Cyan
Write-Host "  1. Open http://localhost:5173"
Write-Host "  2. Register a student OR admin login: admin@researchpadi.com"
Write-Host "  3. Show Landing -> Dashboard -> New Paper / Workspace"
Write-Host "  4. For a public URL, run: npx cloudflared tunnel --url http://localhost:5173"
npm run dev
