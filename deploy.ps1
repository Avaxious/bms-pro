# BMS Dashboard (Vite) Deploy via GitHub Contents API
# No git needed - just API calls
param([string]$Branch = "gh-pages")

$ErrorActionPreference = "Stop"

$Token = $null
if ($env:GITHUB_TOKEN) { $Token = $env:GITHUB_TOKEN }
if (-not $Token) {
    $TokenFile = Join-Path $PSScriptRoot ".github_token"
    if (Test-Path $TokenFile) { $Token = (Get-Content $TokenFile -Raw).Trim() }
}
if (-not $Token) { Write-Host "ERROR: No token" -ForegroundColor Red; exit 1 }

$Repo = "Avaxious/BMS"
$Api = "https://api.github.com/repos/$Repo"
$Headers = @{ Authorization = "token $Token"; Accept = "application/vnd.github.v3+json" }

# --- Build ---
Write-Host "Building..." -ForegroundColor Cyan
node node_modules/vite/bin/vite.js build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }

# --- Ensure branch exists ---
try {
    $null = Invoke-RestMethod -Uri "$Api/git/ref/heads/$Branch" -Headers $Headers
    Write-Host "  Branch '$Branch' exists" -ForegroundColor DarkGray
} catch {
    Write-Host "  Creating branch '$Branch'..." -ForegroundColor DarkGray
    $mainRef = Invoke-RestMethod -Uri "$Api/git/ref/heads/main" -Headers $Headers
    $null = Invoke-RestMethod -Uri "$Api/git/refs" -Headers $Headers -Body (@{ ref = "refs/heads/$Branch"; sha = $mainRef.object.sha } | ConvertTo-Json) -Method Post
}

# --- Upload each file ---
$distPath = Join-Path $PSScriptRoot "dist"
$files = Get-ChildItem -Path $distPath -Recurse -File
Write-Host "Deploying $($files.Count) files to '$Branch'..." -ForegroundColor Cyan

$success = 0; $fail = 0

foreach ($f in $files) {
    $relative = $f.FullName.Substring($distPath.Length + 1).Replace("\", "/")
    try {
        $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($f.FullName))

        # Try to get existing file SHA on this branch
        $sha = $null
        try {
            $resp = Invoke-RestMethod -Uri "$Api/contents/$relative`?ref=$Branch" -Headers $Headers -Method Get
            if ($resp.sha) { $sha = $resp.sha }
        } catch {}

        $body = @{ message = "deploy $relative"; content = $b64; branch = $Branch }
        if ($sha) { $body["sha"] = $sha }

        $json = [System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 3))
        $null = Invoke-RestMethod -Uri "$Api/contents/$relative" -Headers $Headers -Body $json -Method Put -ContentType "application/json"

        $success++
        $label = if ($sha) { "updated" } else { "created" }
        Write-Host "  OK ($label): $relative" -ForegroundColor Green
    } catch {
        $fail++
        Write-Host "  FAIL: $relative" -ForegroundColor Red
        Write-Host "    $($_.Exception.Message)" -ForegroundColor DarkRed
    }
}

Write-Host ""
if ($fail -eq 0) {
    Write-Host "Deployed $success files!" -ForegroundColor Green
    Write-Host "https://Avaxious.github.io/BMS/" -ForegroundColor Green
} else {
    Write-Host "$success/$($files.Count) OK, $fail failed." -ForegroundColor Yellow
}
