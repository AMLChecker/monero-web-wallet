#!/usr/bin/env bash
#
# Updates the Monero binaries next to start.sh to an official release.
#
#   scripts/update-monero.sh                 # newest release on downloads.getmonero.org
#   scripts/update-monero.sh 0.18.5.1        # a specific release (also a rollback)
#   FORCE=1 scripts/update-monero.sh         # reinstall even if already current
#
# The download is verified against the hashes.txt published for the release, and the
# binaries that get replaced are copied into .backup/monero-<old> first.
#
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
WANTED="${1:-}"
SUFFIX="$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m)"
case "$SUFFIX" in
  linux-x86_64|linux-amd64) PART='linux-x64' ;;
  darwin-x86_64) PART='mac-x64' ;;
  darwin-arm64|linux-aarch64|linux-arm64) PART="${SUFFIX%%-*}-arm64" ;;
  *) PART='linux-x64' ;;
esac

BINARIES=(monero-wallet-rpc monerod monero-wallet-cli)

say() { printf '[Monero] %s\n' "$1"; }
fail() { printf '[Error] %s\n' "$1" >&2; exit 1; }

download() {
  if command -v curl >/dev/null 2>&1; then curl -fsSL --max-time 900 -o "$2" "$1"
  elif command -v wget >/dev/null 2>&1; then wget -q -O "$2" "$1"
  else fail 'Neither curl nor wget is available.'; fi
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else fail 'No sha256 tool available (install coreutils).'; fi
}

local_version() {
  local exe="$ROOT/monero-wallet-rpc"
  [ -x "$exe" ] || return 0
  "$exe" --version 2>/dev/null | sed -n 's/.*v\([0-9][0-9.]*\)-release.*/\1/p' | head -1
}

if [ -n "$WANTED" ]; then
  NAME="monero-$PART-v$WANTED.tar.bz2"
else
  # downloads.getmonero.org/<platform> redirects to the current release.
  case "$PART" in
    linux-*) LATEST_URL='https://downloads.getmonero.org/linux64' ;;
    mac-*) LATEST_URL='https://downloads.getmonero.org/mac64' ;;
    *) LATEST_URL='https://downloads.getmonero.org/linux64' ;;
  esac
  NAME="$(curl -fsSI --max-time 60 "$LATEST_URL" | tr -d '\r' | sed -n 's/^[Ll]ocation: //p' | head -1 | xargs -r basename)"
  [ -n "$NAME" ] || fail 'Could not determine the current Monero release.'
fi

TARGET="$(printf '%s' "$NAME" | sed -n 's/.*-v\([0-9][0-9.]*\)\.tar\.bz2$/\1/p')"
[ -n "$TARGET" ] || fail "Could not read the version from '$NAME'."

LOCAL="$(local_version || true)"
if [ "$LOCAL" = "$TARGET" ] && [ "${FORCE:-0}" != "1" ]; then
  say "already on the current release: $LOCAL"
  exit 0
fi
say "installed: ${LOCAL:-none} -> target: $TARGET"

CACHE="$ROOT/.cache"
mkdir -p "$CACHE"
say "Downloading $NAME ..."
download "https://downloads.getmonero.org/cli/$NAME" "$CACHE/$NAME" || fail 'Download failed.'
download 'https://www.getmonero.org/downloads/hashes.txt' "$CACHE/monero-hashes.txt" || fail 'Could not download the published hashes.'

EXPECTED="$(grep "$NAME\$" "$CACHE/monero-hashes.txt" | awk '{print $1}' | head -1)"
[ -n "$EXPECTED" ] || fail "hashes.txt does not list $NAME - refusing to install unverified binaries."
ACTUAL="$(sha256_of "$CACHE/$NAME")"
[ "$EXPECTED" = "$ACTUAL" ] || fail 'Checksum mismatch - nothing was changed.'
say 'Checksum verified'

EXISTING=()
for binary in "${BINARIES[@]}"; do
  [ -f "$ROOT/$binary" ] && EXISTING+=("$binary")
done
if [ "${#EXISTING[@]}" -gt 0 ]; then
  LABEL="${LOCAL:-previous}"
  mkdir -p "$ROOT/.backup/monero-$LABEL"
  for binary in "${BINARIES[@]}"; do
    [ -f "$ROOT/$binary" ] && cp -f "$ROOT/$binary" "$ROOT/.backup/monero-$LABEL/$binary"
  done
  say "Previous binaries kept in .backup/monero-$LABEL"
fi

EXTRACT="$CACHE/monero"
rm -rf "$EXTRACT"
mkdir -p "$EXTRACT"
tar -xjf "$CACHE/$NAME" -C "$EXTRACT" || fail 'Could not unpack the archive.'
for binary in "${BINARIES[@]}"; do
  found="$(find "$EXTRACT" -name "$binary" -type f -perm -u+x | head -1)"
  [ -n "$found" ] || fail "$binary is missing from the archive - nothing was replaced."
  cp -f "$found" "$ROOT/$binary"
  chmod +x "$ROOT/$binary"
done

rm -f "$CACHE/$NAME"
rm -rf "$EXTRACT"
say "done: $(local_version || printf '%s' "$TARGET")"
say 'Restart the wallet (./stop.sh, then ./start.sh) so the new binaries are used.'
