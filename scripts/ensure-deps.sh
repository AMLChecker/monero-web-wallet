#!/usr/bin/env bash
#
# Prepares everything start.sh needs, so a fresh machine only has to unpack the
# release archive and run ./start.sh:
#
#   1. Node.js - used from PATH, from the portable copy inside this folder, or
#                downloaded from nodejs.org (checksum verified) into ./node.
#   2. Monero  - the official CLI archive, downloaded from getmonero.org and
#                verified against the published hashes.txt when the binaries are
#                missing (the release package already ships them on Windows).
#
# Exit codes: 0 = everything ready, 1 = something could not be prepared.
#
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
MONERO_VERSION="0.18.5.1"
MONERO_BINARIES=(monero-wallet-rpc monerod monero-wallet-cli)

say() { printf '[Setup] %s\n' "$1"; }
fail() { printf '[Error] %s\n' "$1" >&2; exit 1; }

download() {
  local url="$1" dest="$2"
  say "Downloading $(basename "$url") ..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --max-time 600 -o "$dest" "$url" || return 1
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$dest" "$url" || return 1
  else
    say 'Neither curl nor wget is available.'
    return 1
  fi
  [ -s "$dest" ]
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else return 1; fi
}

# --- Node.js ----------------------------------------------------------------
resolve_node() {
  if command -v node >/dev/null 2>&1; then
    dirname "$(command -v node)"
    return 0
  fi
  if [ -x "$ROOT/node/bin/node" ]; then
    say 'Using the portable Node.js copy in this folder'
    printf '%s\n' "$ROOT/node/bin"
    return 0
  fi

  local platform arch suffix
  case "$(uname -s)" in
    Linux) platform='linux' ;;
    Darwin) platform='darwin' ;;
    *) fail 'Unsupported system - install Node.js 18+ from https://nodejs.org' ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) arch='x64' ;;
    arm64|aarch64) arch='arm64' ;;
    *) fail 'Unsupported architecture - install Node.js 18+ from https://nodejs.org' ;;
  esac
  suffix="$platform-$arch"

  say 'Fetching the latest Node.js LTS from nodejs.org...'
  local cache="$ROOT/.cache"
  mkdir -p "$cache"
  download 'https://nodejs.org/dist/index.json' "$cache/node-index.json" || fail 'Could not reach nodejs.org'

  # The index is a JSON array; splitting on "{" gives one record per line, so the
  # first line carrying an "lts" name is the latest LTS release.
  local version
  version="$(tr '{' '\n' < "$cache/node-index.json" | grep '"lts":"' | grep -v '"lts":false' | head -1 | grep -o '"version":"v[0-9.]*"' | head -1 | cut -d'"' -f4)"
  [ -n "$version" ] || fail 'Could not determine the latest Node.js version'

  local tarball="node-$version-$suffix.tar.gz"
  download "https://nodejs.org/dist/$version/$tarball" "$cache/$tarball" || fail 'Could not download Node.js'
  download "https://nodejs.org/dist/$version/SHASUMS256.txt" "$cache/SHASUMS256.txt" || fail 'Could not download the Node.js checksums'

  local expected actual
  expected="$(grep " $tarball\$" "$cache/SHASUMS256.txt" | awk '{print $1}' | head -1)"
  [ -n "$expected" ] || fail "No checksum published for $tarball"
  actual="$(sha256_of "$cache/$tarball")" || fail 'No sha256 tool available (install coreutils)'
  [ "$expected" = "$actual" ] || fail "Checksum mismatch for $tarball"
  say "Checksum verified ($version)"

  rm -rf "$ROOT/node"
  mkdir -p "$ROOT/node"
  tar -xzf "$cache/$tarball" -C "$ROOT/node" --strip-components=1
  rm -f "$cache/$tarball"
  say "Node.js $version installed into $ROOT/node"
  printf '%s\n' "$ROOT/node/bin"
}

# --- Monero binaries --------------------------------------------------------
resolve_monero() {
  local missing=()
  for binary in "${MONERO_BINARIES[@]}"; do
    if [ ! -x "$ROOT/$binary" ] && [ ! -x "$ROOT/$binary.exe" ]; then missing+=("$binary"); fi
  done
  if [ "${#missing[@]}" -eq 0 ]; then return 0; fi

  say "Monero binaries missing (${missing[*]}) - downloading the official archive..."
  local platform arch os_part suffix zip name
  case "$(uname -s)" in
    Linux) os_part='linux' ;;
    Darwin) os_part='mac' ;;
    *) say 'Automatic download is only wired for Linux and macOS.'; return 1 ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) arch='x64' ;;
    arm64|aarch64) arch='arm64' ;;
    *) arch='x64' ;;
  esac
  name="monero-$os_part-$arch-v$MONERO_VERSION.tar.bz2"

  local cache="$ROOT/.cache"
  mkdir -p "$cache"
  download "https://downloads.getmonero.org/cli/$name" "$cache/$name" || { say 'Could not download the Monero archive.'; return 1; }
  download 'https://www.getmonero.org/downloads/hashes.txt' "$cache/monero-hashes.txt" || { say 'Could not download the published hashes.'; return 1; }

  local expected actual
  expected="$(grep "$name\$" "$cache/monero-hashes.txt" | awk '{print $1}' | head -1)"
  [ -n "$expected" ] || { say "hashes.txt does not list $name - refusing to install unverified binaries."; return 1; }
  actual="$(sha256_of "$cache/$name")" || { say 'No sha256 tool available.'; return 1; }
  [ "$expected" = "$actual" ] || { say 'Checksum mismatch - refusing to install.'; return 1; }
  say 'Monero checksum verified'

  local extract="$cache/monero"
  rm -rf "$extract"
  mkdir -p "$extract"
  tar -xjf "$cache/$name" -C "$extract" || { say 'Could not unpack the Monero archive.'; return 1; }
  for binary in "${MONERO_BINARIES[@]}"; do
    local found
    found="$(find "$extract" -name "$binary" -type f -perm -u+x | head -1)"
    if [ -z "$found" ]; then say "$binary not found in the archive."; return 1; fi
    cp -f "$found" "$ROOT/$binary"
    chmod +x "$ROOT/$binary"
  done
  rm -f "$cache/$name"
  rm -rf "$extract"
  say 'Monero binaries are in place'
}

NODE_DIR="$(resolve_node)"
[ -n "$NODE_DIR" ] || fail 'Node.js could not be installed automatically.'
export PATH="$NODE_DIR:$PATH"
say "Node.js ready: $(node -v)"

resolve_monero || exit 1

mkdir -p "$ROOT/.run"
printf '%s\n' "$NODE_DIR" > "$ROOT/.run/node-dir.txt"
exit 0
