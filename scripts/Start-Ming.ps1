[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)][int]$Port = 4001,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$mingRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$mingUrl = "http://127.0.0.1:$Port"
$mingEntry = Join-Path $mingRoot 'apps\server\dist\index.js'
$mingWeb = Join-Path $mingRoot 'apps\web\dist\index.html'

function Get-MingCapabilities {
    try {
        $capabilities = Invoke-RestMethod -Uri "$mingUrl/api/capabilities" -TimeoutSec 2
        if ($capabilities.ok -eq $true -and $capabilities.sourceBinding -eq 'self-contained-html-snapshot') { return $capabilities }
        return $null
    } catch { return $null }
}

$existingMing = Get-MingCapabilities
if ($existingMing -and $existingMing.readOnly -eq $true) {
    throw "Port $Port is running Ming's read-only public viewer. Nothing was stopped. Close that viewer first, or use -Port 4002 for the local app. The MCP adapter requires port 4001."
}
if ($existingMing -and $existingMing.readOnly -eq $false) {
    Write-Host "Ming is already running: $mingUrl"
    if (-not $NoBrowser) { Start-Process $mingUrl }
    exit 0
}

$portProbe = [System.Net.Sockets.TcpClient]::new()
try {
    $connectTask = $portProbe.ConnectAsync('127.0.0.1', $Port)
    if ($connectTask.Wait(800) -and $portProbe.Connected) {
        throw "Port $Port is used by another service. Nothing was stopped. Close that service or run this launcher with -Port 4002."
    }
} catch [System.AggregateException] {
    # Connection refused means the requested port is available.
} finally { $portProbe.Dispose() }

$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) { throw 'Node.js is not installed or is not available in PATH. Install Node.js before starting Ming.' }
if (-not (Test-Path -LiteralPath $mingEntry) -or -not (Test-Path -LiteralPath $mingWeb)) {
    throw "Ming needs its first build. From the project folder run: pnpm install; pnpm build. Then double-click Start-Ming.cmd again."
}

$mingRuntime = Join-Path $mingRoot 'runtime'
$null = New-Item -ItemType Directory -Path $mingRuntime -Force
$launchStamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$stdoutPath = Join-Path $mingRuntime "launcher-$launchStamp.out.log"
$stderrPath = Join-Path $mingRuntime "launcher-$launchStamp.err.log"
$savedEnvironment = @{}
foreach ($name in @('HOST', 'PORT', 'MING_PUBLIC_DEMO', 'MING_TEST_MODE')) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
    [Environment]::SetEnvironmentVariable('HOST', '127.0.0.1', 'Process')
    [Environment]::SetEnvironmentVariable('PORT', [string]$Port, 'Process')
    [Environment]::SetEnvironmentVariable('MING_PUBLIC_DEMO', $null, 'Process')
    [Environment]::SetEnvironmentVariable('MING_TEST_MODE', $null, 'Process')
    $mingProcess = Start-Process -FilePath $nodePath -ArgumentList @('"' + $mingEntry + '"') -WorkingDirectory $mingRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
    $mingStartedAt = $mingProcess.StartTime
} finally {
    foreach ($name in $savedEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
    }
}

$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
    $mingProcess.Refresh()
    if ($mingProcess.HasExited) { break }
    $startedMing = Get-MingCapabilities
    if ($startedMing -and $startedMing.readOnly -eq $false) { $ready = $true; break }
    Start-Sleep -Milliseconds 250
}

if (-not $ready) {
    $ownedProcess = Get-Process -Id $mingProcess.Id -ErrorAction SilentlyContinue
    if ($ownedProcess -and $ownedProcess.StartTime -eq $mingStartedAt -and $ownedProcess.Path -eq $nodePath) {
        Stop-Process -Id $ownedProcess.Id
    }
    throw "Ming could not start. Details: $stderrPath"
}

[PSCustomObject]@{
    processId = $mingProcess.Id
    startedAt = $mingStartedAt.ToString('o')
    nodePath = $nodePath
    port = $Port
    projectRoot = $mingRoot
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $mingRuntime 'launcher.json') -Encoding UTF8

Write-Host "Ming is ready: $mingUrl"
Write-Host 'The local service will keep running after this window closes. No model request is made by this launcher.'
if (-not $NoBrowser) { Start-Process $mingUrl }
