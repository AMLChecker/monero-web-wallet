<#
    Updates the Monero binaries that sit next to Start.bat to an official release.

      scripts\update-monero.ps1                 # newest release on downloads.getmonero.org
      scripts\update-monero.ps1 -Version 0.18.5.1   # a specific release (also a rollback)
      scripts\update-monero.ps1 -Force          # reinstall even if already current

    The download is verified against the hashes.txt that the Monero project publishes
    for the release, and the binaries that are replaced are kept in .backup\monero-<old>
    so a bad update can be undone by copying them back.
#>
param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot),
  [string]$Version = '',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch { }

$Binaries = @('monero-wallet-rpc.exe', 'monerod.exe', 'monero-wallet-cli.exe')
$HashesUrl = 'https://www.getmonero.org/downloads/hashes.txt'
$LatestUrl = 'https://downloads.getmonero.org/win64'

function Say([string]$Message) { Write-Host "[Monero] $Message" }
function Fail([string]$Message) { Write-Host "[Error] $Message" -ForegroundColor Red; exit 1 }
function Get-Sha256([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }

function Get-LocalVersion {
  $exe = Join-Path $Root 'monero-wallet-rpc.exe'
  if (-not (Test-Path -LiteralPath $exe)) { return $null }
  try {
    $output = & $exe --version 2>&1 | Out-String
    $match = [regex]::Match($output, 'v(\d+\.\d+\.\d+(?:\.\d+)?)-release')
    if ($match.Success) { return $match.Groups[1].Value }
    $match = [regex]::Match($output, 'v(\d+\.\d+\.\d+(?:\.\d+)?)')
    if ($match.Success) { return $match.Groups[1].Value }
  } catch { }
  return $null
}

function Get-LatestName {
  # Invoke-WebRequest follows the redirect and then has no Location header left, so
  # the redirect is read with a request that is not allowed to follow it.
  $request = [System.Net.HttpWebRequest]::Create($LatestUrl)
  $request.Method = 'HEAD'
  $request.AllowAutoRedirect = $false
  $request.Timeout = 60000
  $response = $request.GetResponse()
  $location = $response.Headers['Location']
  $response.Close()
  if (-not $location) { Fail 'downloads.getmonero.org did not report the current release.' }
  return (Split-Path -Leaf $location)
}

$zipName = if ($Version) { "monero-win-x64-v$Version.zip" } else { Get-LatestName }
$targetVersion = [regex]::Match($zipName, 'v(\d+\.\d+\.\d+(?:\.\d+)?)').Groups[1].Value
if (-not $targetVersion) { Fail "Could not read the version from '$zipName'." }

$local = Get-LocalVersion
if ($local -eq $targetVersion -and -not $Force) {
  Say "already on the current release: $local"
  exit 0
}
Say "installed: $(if ($local) { $local } else { 'none' }) -> target: $targetVersion"

$cache = Join-Path $Root '.cache'
New-Item -ItemType Directory -Force -Path $cache | Out-Null
$zipPath = Join-Path $cache $zipName
$hashesPath = Join-Path $cache 'monero-hashes.txt'

Say "Downloading $zipName ..."
try {
  Invoke-WebRequest -Uri "https://downloads.getmonero.org/cli/$zipName" -OutFile $zipPath -UseBasicParsing -TimeoutSec 900
  Invoke-WebRequest -Uri $HashesUrl -OutFile $hashesPath -UseBasicParsing -TimeoutSec 120
} catch {
  Fail "Download failed: $($_.Exception.Message)"
}

$line = (Get-Content -LiteralPath $hashesPath | Where-Object { $_ -match [regex]::Escape($zipName) } | Select-Object -First 1)
if (-not $line) { Fail "hashes.txt does not list $zipName - refusing to install unverified binaries." }
$expected = ($line -split '\s+')[0].ToLowerInvariant()
$actual = Get-Sha256 $zipPath
if ($expected -ne $actual) { Fail "Checksum mismatch (expected $expected, got $actual) - nothing was changed." }
Say 'Checksum verified'

$extract = Join-Path $cache 'monero'
if (Test-Path -LiteralPath $extract) { Remove-Item -LiteralPath $extract -Recurse -Force }
try {
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extract -Force
} catch {
  Fail "Could not unpack the archive: $($_.Exception.Message). Windows Defender may be blocking it - add this folder to Exclusions."
}

$existing = $Binaries | Where-Object { Test-Path -LiteralPath (Join-Path $Root $_) }
if ($existing.Count -gt 0) {
  $label = if ($local) { $local } else { 'previous' }
  $backup = Join-Path $Root ".backup\monero-$label"
  New-Item -ItemType Directory -Force -Path $backup | Out-Null
  foreach ($binary in $existing) {
    $current = Join-Path $Root $binary
    Copy-Item -LiteralPath $current -Destination (Join-Path $backup $binary) -Force
  }
  Say "Previous binaries kept in .backup\monero-$label"
}

foreach ($binary in $Binaries) {
  $source = Get-ChildItem -LiteralPath $extract -Recurse -Filter $binary -File | Select-Object -First 1
  if (-not $source) { Fail "$binary is missing from the archive - nothing was replaced." }
  Copy-Item -LiteralPath $source.FullName -Destination (Join-Path $Root $binary) -Force
}

Start-Sleep -Seconds 2
$gone = $Binaries | Where-Object { -not (Test-Path -LiteralPath (Join-Path $Root $_)) }
if ($gone) { Fail "Windows Defender removed $($gone -join ', ') right after unpacking. Restore it in Protection history and add this folder to Exclusions." }

Remove-Item -LiteralPath $zipPath -Force
Remove-Item -LiteralPath $extract -Recurse -Force

$now = Get-LocalVersion
Say "done: $now"
Say 'Restart the wallet (Stop.bat, then Start.bat) so the new binaries are used.'
exit 0
