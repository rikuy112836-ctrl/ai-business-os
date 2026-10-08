# PC check for the TikTok AI character live prototype (READ ONLY: changes nothing, installs nothing)
# Run:  powershell -ExecutionPolicy Bypass -File tools\check-pc.ps1
# Result is also saved to pc-check-result.txt in the project folder.

$ErrorActionPreference = 'SilentlyContinue'
$out = New-Object System.Collections.Generic.List[string]
function Say($s) { $out.Add($s); Write-Host $s }

Say "=== PC check $(Get-Date -Format 'yyyy-MM-dd HH:mm') ==="

$os = Get-CimInstance Win32_OperatingSystem
Say "OS        : $($os.Caption) ($($os.Version))"

$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
Say "CPU       : $($cpu.Name.Trim()) / $($cpu.NumberOfCores) cores / $($cpu.NumberOfLogicalProcessors) threads"

$ramGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
Say "RAM       : $ramGB GB"

# GPU (VRAM from the registry; Win32_VideoController caps at 4GB)
$vram = @{}
Get-ItemProperty 'HKLM:\SYSTEM\ControlSet001\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0*' |
  ForEach-Object { if ($_.'HardwareInformation.qwMemorySize') { $vram[$_.DriverDesc] = [math]::Round($_.'HardwareInformation.qwMemorySize' / 1GB, 1) } }
$gpus = Get-CimInstance Win32_VideoController
foreach ($g in $gpus) {
  $v = if ($vram[$g.Name]) { "$($vram[$g.Name]) GB" } else { "unknown" }
  Say "GPU       : $($g.Name) / VRAM $v / driver $($g.DriverVersion) / $($g.CurrentHorizontalResolution)x$($g.CurrentVerticalResolution)"
}

$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
Say "Disk C:   : $([math]::Round($disk.FreeSpace / 1GB, 1)) GB free"

Say ""
Say "--- Installed software ---"
$apps = @(Get-ItemProperty 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*') | Where-Object { $_.DisplayName }
$targets = [ordered]@{
  'OBS Studio'        = 'OBS Studio'
  'TikTok LIVE Studio'= 'TikTok LIVE Studio|LIVE Studio'
  'TikFinity'         = 'TikFinity'
  'VOICEVOX'          = 'VOICEVOX'
  'Streamlabs'        = 'Streamlabs'
  'Node.js'           = '^Node\.js'
  'Google Chrome'     = 'Google Chrome'
  'VB-CABLE'          = 'VB-Audio|VB-CABLE'
}
foreach ($k in $targets.Keys) {
  $hit = $apps | Where-Object { $_.DisplayName -match $targets[$k] } | Select-Object -First 1
  if ($hit) { Say ("[x] {0,-20} {1} {2}" -f $k, $hit.DisplayName, $hit.DisplayVersion) } else { Say ("[ ] {0,-20} not found" -f $k) }
}
$node = Get-Command node
if ($node) { Say "node -v   : $(& node -v)" }

Say ""
Say "--- Local services (listening ports) ---"
foreach ($p in @(@{n='TikFinity Events API'; port=21213}, @{n='VOICEVOX engine'; port=50021}, @{n='This prototype'; port=8787}, @{n='OBS WebSocket'; port=4455})) {
  $l = Get-NetTCPConnection -LocalPort $p.port -State Listen
  Say ("{0,-22} port {1,-6} {2}" -f $p.n, $p.port, $(if ($l) { 'RUNNING' } else { 'not running' }))
}

Say ""
Say "--- Quick assessment (vertical 1080x1920 @30fps) ---"
$score = @()
if ($ramGB -ge 16) { $score += 'RAM OK' } elseif ($ramGB -ge 8) { $score += 'RAM minimum (16GB recommended)' } else { $score += 'RAM LOW (<8GB)' }
if ($cpu.NumberOfLogicalProcessors -ge 8) { $score += 'CPU OK' } else { $score += 'CPU may be tight (8+ threads recommended)' }
$enc = ($gpus.Name -join ' ')
if ($enc -match 'NVIDIA') { $score += 'GPU encoder: NVENC available' }
elseif ($enc -match 'AMD|Radeon') { $score += 'GPU encoder: AMD AMF available' }
elseif ($enc -match 'Intel') { $score += 'GPU encoder: Intel QuickSync (likely)' }
else { $score += 'GPU encoder: unknown' }
$score | ForEach-Object { Say "- $_" }
Say "- Upload speed: check at https://fast.com (6 Mbps+ recommended)"

$file = Join-Path (Split-Path $PSScriptRoot -Parent) 'pc-check-result.txt'
$out | Out-File -FilePath $file -Encoding utf8
Write-Host ""
Write-Host "Saved: $file  (paste this text to Claude)"
