# Starts Spring Boot backend with JDK 21 and skips frontend npm steps.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# L1 security: enforce shared API token, but do not store secret in this file.
$env:SCR_API_REQUIRE_TOKEN = "true"
if (-not $env:SCR_API_TOKEN -or [string]::IsNullOrWhiteSpace($env:SCR_API_TOKEN)) {
    $tokenUser = [Environment]::GetEnvironmentVariable("SCR_API_TOKEN", "User")
    $tokenMachine = [Environment]::GetEnvironmentVariable("SCR_API_TOKEN", "Machine")
    $resolvedToken = if (-not [string]::IsNullOrWhiteSpace($tokenUser)) { $tokenUser } else { $tokenMachine }
    if ([string]::IsNullOrWhiteSpace($resolvedToken)) {
        Write-Error "SCR_API_TOKEN not found. Set it once: [Environment]::SetEnvironmentVariable('SCR_API_TOKEN','YOUR_TOKEN','User'), then reopen terminal."
    }
    $env:SCR_API_TOKEN = $resolvedToken
}

# Avoid "Port 8080 already in use": stop previous process if needed.
$listener = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    $listenerPid = $listener.OwningProcess
    if ($listenerPid -and $listenerPid -ne $PID) {
        try {
            $proc = Get-Process -Id $listenerPid -ErrorAction Stop
            Write-Host "Port 8080 busy by PID $listenerPid ($($proc.ProcessName)) - stopping..." -ForegroundColor Yellow
            Stop-Process -Id $listenerPid -Force -ErrorAction Stop
            Start-Sleep -Milliseconds 300
        } catch {
            Write-Error "Cannot free port 8080 (PID $listenerPid): $($_.Exception.Message)"
        }
    }
}

$adoptiumRoot = 'C:\Program Files\Eclipse Adoptium'
$jdk21 = Get-ChildItem -LiteralPath $adoptiumRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '^jdk-21\.' } |
    Sort-Object Name -Descending |
    Select-Object -First 1
if (-not $jdk21) {
    Write-Error "JDK 21 not found under $adoptiumRoot. Install Temurin 21 or set JAVA_HOME."
}

$env:JAVA_HOME = $jdk21.FullName
$env:Path = "$($jdk21.FullName)\bin;$env:Path"
Write-Host "JAVA_HOME=$($env:JAVA_HOME)" -ForegroundColor DarkGray

& mvn "-Dskip.npm=true" spring-boot:run
exit $LASTEXITCODE
