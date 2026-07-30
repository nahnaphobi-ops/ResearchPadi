# Investor demo — run locally if Render is down
# Usage (PowerShell, from repo root):
#   .\scripts\demo-local.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
if (-not $root) { $root = Get-Location }

Write-Host "== ResearchPadi local demo ==" -ForegroundColor Cyan

# Backend env (matches known ResearchPadi Supabase project)
$env:NODE_ENV = "production"
$env:PORT = "5000"
$env:ADMIN_MFA = "false"
$env:SUPABASE_URL = "https://bpmfpxkuknchflpctmbr.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwbWZweGt1a25jaGZscGN0bWJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTcxMzY0MSwiZXhwIjoyMDk3Mjg5NjQxfQ.6Ocm3mVytezSVLC78pRwERFChlx1URlniFVQJxdOB2g"
$env:DATABASE_URL = "postgresql://postgres:%23Bigbo55man88%2F%2F@db.bpmfpxkuknchflpctmbr.supabase.co:5432/postgres"
$env:JWT_SECRET = "researchpadi-demo-secret-114107571161025654111112521061131195311899"
$env:ADMIN_EMAIL = "admin@researchpadi.com"
$env:ADMIN_PASSWORD = "ResearchPadi#Admin2026"
$env:FRONTEND_URL = "http://localhost:5173"
$env:SUPABASE_PROJECT_REF = "bpmfpxkuknchflpctmbr"

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
