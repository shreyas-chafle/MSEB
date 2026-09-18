#!/usr/bin/env pwsh
# clean-start.ps1 — Wipes Next.js stale cache & restarts dev server

Write-Host "`n🧹 Cleaning Next.js build cache..." -ForegroundColor Cyan

# Remove stale .next build output
if (Test-Path "frontend\.next") {
    Remove-Item -Recurse -Force "frontend\.next"
    Write-Host "  ✅ Removed frontend\.next" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  frontend\.next not found, skipping." -ForegroundColor Yellow
}

# Remove webpack module cache inside node_modules
if (Test-Path "frontend\node_modules\.cache") {
    Remove-Item -Recurse -Force "frontend\node_modules\.cache"
    Write-Host "  ✅ Removed frontend\node_modules\.cache" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  node_modules\.cache not found, skipping." -ForegroundColor Yellow
}

Write-Host "`n🚀 Starting Next.js dev server..." -ForegroundColor Cyan
Write-Host "   (Do a hard reload in browser with Ctrl+Shift+R after it's ready)`n" -ForegroundColor DarkGray

Set-Location -Path "frontend"
npm run dev
