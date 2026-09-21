<#
    Prepares everything the launcher needs, so a fresh machine only has to unpack
    the release archive and double-click Start.bat:

      1. Node.js  - used from PATH, from the portable copy inside this folder, or
                    installed from nodejs.org (portable zip, checksum verified).
      2. Monero   - the three official CLI binaries, downloaded from getmonero.org
                    and verified against the published hashes.txt when they are
                    missing (the release package already ships them).

    Every download is checked against the checksum the vendor publishes; nothing is
    executed before that check passes. The script writes the directory that holds
    node.exe to .run\node-dir.txt so Start.bat can put it in front of PATH.

    Exit codes: 0 = everything ready, 1 = something could not be prepared.
#>
param(
  [string]$Root = (Split-Path -Parent $PSScriptRoot),
  [switch]$ForceDownload
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Windows PowerShell on older Windows 10 builds still defaults to TLS 1.0, which
# nodejs.org and getmonero.org refuse.
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch { }

$MoneroZipName = 'monero-win-x64-v0.18.5.1.zip'
$MoneroUrl = "https://downloads.getmonero.org/cli/$MoneroZipName"
$MoneroHashesUrl = 'https://www.getmonero.org/downloads/hashes.txt'
$MoneroBinaries = @('monero-wallet-rpc.exe', 'monerod.exe', 'monero-wallet-cli.exe')

function Say([string]$Message) { Write-Host "[Setup] $Message" }
function Fail([string]$Message) { Write-Host "[Error] $Message" -ForegroundColor Red; exit 1 }

function Get-Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Download([string]$Url, [string]$Destination) {
  Say "Downloading $(Split-Path -Leaf $Url) ..."
  try {
    Invoke-WebRequest -Uri $Url -OutFile $Destination -UseBasicParsing -TimeoutSec 300
  } catch {
    return $false
  }
  return (Test-Path -LiteralPath $Destination)
}

# --- Node.js ---------------------------------------------------------------

function Resolve-Node {
  if (-not $ForceDownload) {
    $onPath = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($onPath) { return (Split-Path -Parent $onPath.Source) }

    $portable = Join-Path $Root 'node\node.exe'
    if (Test-Path -LiteralPath $portable) {
      Say 'Using the portable Node.js copy in this folder'
      return (Split-Path -Parent $portable)
    }

    foreach ($candidate in @("$env:ProgramFiles\nodejs", "${env:ProgramFiles(x86)}\nodejs", "$env:LOCALAPPDATA\Programs\nodejs")) {
      if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'node.exe'))) { return $candidate }
    }
  }

  # winget knows how to install the LTS build; it needs no checksum logic from us
  # because the manifest is signed by Microsoft.
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if ($winget -and -not $ForceDownload) {
    Say 'Installing Node.js LTS with winget (this can take a minute)...'
    & $winget.Source install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements 2>&1 | Out-Null
    foreach ($candidate in @("$env:ProgramFiles\nodejs", "${env:ProgramFiles(x86)}\nodejs", "$env:LOCALAPPDATA\Programs\nodejs")) {
      if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate 'node.exe'))) { return $candidate }
    }
  }

  # Last resort: the official portable zip, unpacked inside this folder.
  Say 'Fetching the latest Node.js LTS from nodejs.org...'
  $cache = Join-Path $Root '.cache'
  New-Item -ItemType Directory -Force -Path $cache | Out-Null

  $indexPath = Join-Path $cache 'node-index.json'
  if (-not (Download 'https://nodejs.org/dist/index.json' $indexPath)) { return $null }
  # Regex instead of ConvertFrom-Json: Windows PowerShell 5.1 hands back the whole
  # array as one object, which used to turn the version into a list of 800 strings.
  $index = Get-Content -LiteralPath $indexPath -Raw
  $match = [regex]::Match($index, '\{"version":"(v[\d.]+)"[^{]*?"lts":"[^"]+"')
  if (-not $match.Success) { Say 'Could not read the Node.js release index.'; return $null }
  $version = $match.Groups[1].Value
  Say "Latest LTS: $version"
  $zipName = "node-$version-win-x64.zip"
  $zipPath = Join-Path $cache $zipName
  $nodeUrl = "https://nodejs.org/dist/$version/$zipName"
  if (-not (Download $nodeUrl $zipPath)) { return $null }

  $shasumsPath = Join-Path $cache 'SHASUMS256.txt'
  if (-not (Download "https://nodejs.org/dist/$version/SHASUMS256.txt" $shasumsPath)) { return $null }
  $expected = (Get-Content -LiteralPath $shasumsPath | Where-Object { $_ -match "\s$([regex]::Escape($zipName))$" } | Select-Object -First 1)
  if (-not $expected) { Fail "no checksum published for $zipName" }
  $expectedHash = ($expected -split '\s+')[0].ToLowerInvariant()
  $actualHash = Get-Sha256 $zipPath
  if ($expectedHash -ne $actualHash) { Fail "checksum mismatch for $zipName (expected $expectedHash, got $actualHash)" }
  Say "Checksum verified ($version)"

  $extract = Join-Path $cache "node-$version"
  if (Test-Path -LiteralPath $extract) { Remove-Item -LiteralPath $extract -Recurse -Force }
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extract -Force

  $target = Join-Path $Root 'node'
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
  Move-Item -LiteralPath (Join-Path $extract "node-$version-win-x64") -Destination $target
  Remove-Item -LiteralPath $zipPath -Force
  Say "Node.js $version installed into $target"
  return $target
}

# --- Monero binaries -------------------------------------------------------

function Resolve-Monero {
  $missing = $MoneroBinaries | Where-Object { -not (Test-Path -LiteralPath (Join-Path $Root $_)) }
  if (-not $missing) { return $true }

  Say "Monero binaries missing ($($missing -join ', ')) - downloading the official archive..."
  $cache = Join-Path $Root '.cache'
  New-Item -ItemType Directory -Force -Path $cache | Out-Null
  $zipPath = Join-Path $cache $MoneroZipName

  if (-not (Download $MoneroUrl $zipPath)) {
    Say 'Could not download the Monero archive - check the internet connection.'
    return $false
  }

  $hashesPath = Join-Path $cache 'monero-hashes.txt'
  if (-not (Download $MoneroHashesUrl $hashesPath)) { Say 'Could not download the published hashes.'; return $false }
  $line = (Get-Content -LiteralPath $hashesPath | Where-Object { $_ -match [regex]::Escape($MoneroZipName) } | Select-Object -First 1)
  if (-not $line) { Say "hashes.txt does not list $MoneroZipName - refusing to install unverified binaries."; return $false }
  $expectedHash = ($line -split '\s+')[0].ToLowerInvariant()
  $actualHash = Get-Sha256 $zipPath
  if ($expectedHash -ne $actualHash) {
    Say "checksum mismatch (expected $expectedHash, got $actualHash) - refusing to install."
    return $false
  }
  Say 'Monero checksum verified'

  $extract = Join-Path $cache 'monero'
  if (Test-Path -LiteralPath $extract) { Remove-Item -LiteralPath $extract -Recurse -Force }
  try {
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extract -Force
  } catch {
    Say "Could not unpack the Monero archive: $($_.Exception.Message)"
    Say 'Windows Defender may be blocking it - add this folder to Exclusions and retry.'
    return $false
  }

  foreach ($binary in $MoneroBinaries) {
    $source = Get-ChildItem -LiteralPath $extract -Recurse -Filter $binary -File | Select-Object -First 1
    if (-not $source) { Say "$binary not found in the archive."; return $false }
    Copy-Item -LiteralPath $source.FullName -Destination (Join-Path $Root $binary) -Force
  }
  Start-Sleep -Seconds 2
  $stillMissing = $MoneroBinaries | Where-Object { -not (Test-Path -LiteralPath (Join-Path $Root $_)) }
  if ($stillMissing) {
    Say "Windows Defender removed $($stillMissing -join ', ') right after unpacking."
    Say 'Restore it in Windows Security - Protection history and add this folder to Exclusions.'
    return $false
  }

  Remove-Item -LiteralPath $zipPath -Force
  Remove-Item -LiteralPath $extract -Recurse -Force
  Say 'Monero binaries are in place'
  return $true
}

# --- run -------------------------------------------------------------------

$nodeDir = Resolve-Node
if (-not $nodeDir) { Fail 'Node.js could not be installed automatically. Install it manually from https://nodejs.org (18 or newer).' }

$nodeExe = Join-Path $nodeDir 'node.exe'
if (-not (Test-Path -LiteralPath $nodeExe)) { $nodeExe = Join-Path $nodeDir 'node' }
Say "Node.js found: $(& $nodeExe -v)"

if (-not (Resolve-Monero)) { exit 1 }

# Optional, off by default so the wallet never talks to the internet unless it has to:
# set MONERO_CHECK_UPDATES=1 to be told when the Monero project publishes a new release.
if ($env:MONERO_CHECK_UPDATES -eq '1') {
  try {
    # Not following the redirect is what makes the Location header readable.
    $head = [System.Net.HttpWebRequest]::Create('https://downloads.getmonero.org/win64')
    $head.Method = 'HEAD'
    $head.AllowAutoRedirect = $false
    $head.Timeout = 30000
    $response = $head.GetResponse()
    $location = $response.Headers['Location']
    $response.Close()
    $latest = [regex]::Match("$location", 'v(\d+\.\d+\.\d+(?:\.\d+)?)').Groups[1].Value
    $current = $null
    $exe = Join-Path $Root 'monero-wallet-rpc.exe'
    if (Test-Path -LiteralPath $exe) {
      $current = [regex]::Match((& $exe --version 2>&1 | Out-String), 'v(\d+\.\d+\.\d+(?:\.\d+)?)').Groups[1].Value
    }
    if ($latest -and $current -and $latest -ne $current) {
      Say "A newer Monero release is available: $current -> $latest (run Update-Monero.bat to install it)"
    }
  } catch {
    Say 'Could not check for a newer Monero release.'
  }
}

$runDir = Join-Path $Root '.run'
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
Set-Content -LiteralPath (Join-Path $runDir 'node-dir.txt') -Value $nodeDir -Encoding ASCII

exit 0
