#!/usr/bin/env bash
#
# Monero Web Wallet - launcher for Linux and macOS (equivalent of Start.bat).
#
# It checks the requirements, installs npm dependencies when they are missing,
# builds backend and frontend when their dist folders are absent, starts
# monero-wallet-rpc (loopback only, fresh random RPC login on every run) and the
# backend that serves the wallet UI, then opens the browser.
#
#   ./start.sh              build if needed, start everything, open the browser
#   ./start.sh --rebuild    force a rebuild of backend and frontend
#   ./start.sh --dev        run the Vite dev server on 127.0.0.1:5173 instead
#   ./stop.sh               stop all services
#
# Environment variables (all optional):
#   MONERO_RPC_PORT        wallet RPC port              (default 18083)
#   PORT                   backend port                 (default 18082)
#   MONERO_DAEMON_ADDRESS  Monero node                  (default: auto)
#   MONERO_WALLET_DIR      wallet directory             (default: auto)
#   MONERO_FALLBACK_NODE   node used when nothing else is available
#
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

RPC_PORT="${MONERO_RPC_PORT:-18083}"
BACKEND_PORT="${PORT:-18082}"
FRONTEND_PORT="${MONERO_FRONTEND_PORT:-5173}"
RPC_USER="monero-wallet"
FALLBACK_NODE="${MONERO_FALLBACK_NODE:-xmr-node.cakewallet.com:18081}"
LOG_DIR="$ROOT/logs"
RUN_DIR="$ROOT/.run"

REBUILD=0
DEVMODE=0
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    --dev) DEVMODE=1 ;;
    *) printf '[Warn] Unknown option: %s\n' "$arg" ;;
  esac
done

say() { printf '%s\n' "$*"; }
fail() { printf '\n[Error] %s\n\n' "$*" >&2; exit 1; }

# Ports and HTTP checks go through node: it is already a hard requirement of the
# project, and this avoids depending on lsof/ss/curl being installed.
port_in_use() {
  node -e '
    const net = require("net");
    const socket = net.connect({ host: "127.0.0.1", port: Number(process.argv[1]) });
    socket.on("connect", () => { socket.destroy(); process.exit(0); });
    socket.on("error", () => process.exit(1));
    socket.setTimeout(1500, () => { socket.destroy(); process.exit(1); });
  ' "$1"
}

url_status() { # url, timeout_ms -> prints the HTTP status or 000
  node -e '
    const [url, timeout] = process.argv.slice(1);
    fetch(url, { signal: AbortSignal.timeout(Number(timeout)) })
      .then((response) => { process.stdout.write(String(response.status)); process.exit(0); })
      .catch(() => { process.stdout.write("000"); process.exit(0); });
  ' "$1" "${2:-3000}"
}

wait_for_port() { # port, tries
  local port="$1" tries="${2:-45}" i=0
  while [ "$i" -lt "$tries" ]; do
    if port_in_use "$port"; then return 0; fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

say "=========================================================="
say "  Monero Web Wallet"
say "=========================================================="
say ""

# --- 1. requirements ---------------------------------------------------------
RPC_BIN=""
# The .exe name is checked first on purpose: in Git Bash/MSYS a bare name also
# matches "monero-wallet-rpc.exe", but the extension-less path cannot be executed.
for candidate in "$ROOT/monero-wallet-rpc.exe" "$ROOT/monero-wallet-rpc"; do
  if [ -f "$candidate" ]; then RPC_BIN="$candidate"; break; fi
done
if [ -z "$RPC_BIN" ]; then
  fail "monero-wallet-rpc was not found in $ROOT.
        Download the official Monero binaries from https://www.getmonero.org/downloads/
        and put monero-wallet-rpc next to start.sh."
fi
command -v node >/dev/null 2>&1 || fail "Node.js was not found in PATH. Install Node.js 18 or newer from https://nodejs.org."

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  fail "Node.js $(node -v) is too old. Version 18 or newer is required."
fi
say "[Check] $(basename "$RPC_BIN") found"
say "[Check] Node.js $(node -v) found"

if port_in_use "$RPC_PORT"; then
  fail "Port $RPC_PORT is already in use (another monero-wallet-rpc?).
        Run ./stop.sh first."
fi
if port_in_use "$BACKEND_PORT"; then
  fail "Port $BACKEND_PORT is already in use (the backend is probably running).
        Run ./stop.sh first."
fi
say "[Check] Ports $RPC_PORT and $BACKEND_PORT are free"

# --- 2. dependencies and build ----------------------------------------------
if [ ! -d "$ROOT/backend/node_modules" ]; then
  say "[Setup] Installing backend dependencies - this can take a minute..."
  (cd "$ROOT/backend" && npm install --no-audit --no-fund)
fi
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  say "[Setup] Installing frontend dependencies - this can take a minute..."
  (cd "$ROOT/frontend" && npm install --no-audit --no-fund)
fi
say "[Check] npm dependencies are installed"

if [ "$REBUILD" -eq 1 ] || [ ! -f "$ROOT/backend/dist/server.js" ]; then
  say "[Setup] Building the backend..."
  (cd "$ROOT/backend" && npm run build)
fi
if [ "$DEVMODE" -eq 0 ] && { [ "$REBUILD" -eq 1 ] || [ ! -f "$ROOT/frontend/dist/index.html" ]; }; then
  say "[Setup] Building the wallet UI..."
  (cd "$ROOT/frontend" && npm run build)
fi

mkdir -p "$LOG_DIR" "$RUN_DIR"

# --- 3. wallet directory and node -------------------------------------------
WALLET_DIR="${MONERO_WALLET_DIR:-$ROOT}"
if [ -z "${MONERO_WALLET_DIR:-}" ]; then
  for keys in "$ROOT"/wallets/*.keys; do
    if [ -f "$keys" ]; then WALLET_DIR="$ROOT/wallets"; break; fi
  done
fi

NODE_ADDRESS=""
NODE_SOURCE=""
if [ -n "${MONERO_DAEMON_ADDRESS:-}" ]; then
  NODE_ADDRESS="$MONERO_DAEMON_ADDRESS"
  NODE_SOURCE="MONERO_DAEMON_ADDRESS"
elif [ "$(url_status "http://127.0.0.1:18081/get_height" 2000)" = "200" ]; then
  NODE_ADDRESS="127.0.0.1:18081"
  NODE_SOURCE="local monerod"
elif [ -s "$ROOT/node-address.txt" ]; then
  NODE_ADDRESS="$(head -n 1 "$ROOT/node-address.txt" | tr -d '\r')"
  NODE_SOURCE="node-address.txt"
else
  NODE_ADDRESS="$FALLBACK_NODE"
  NODE_SOURCE="fallback"
  printf '%s\n' "$NODE_ADDRESS" > "$ROOT/node-address.txt"
fi

say "[Check] Daemon address: $NODE_ADDRESS"
say "[Check] Wallet directory: $WALLET_DIR"
case "$NODE_ADDRESS" in
  *127.0.0.1*|*localhost*) : ;;
  *)
    say "[Info] This is a remote node, so it sees your wallet traffic."
    say "       For maximum privacy run monerod locally and set"
    say "       MONERO_DAEMON_ADDRESS=127.0.0.1:18081."
    ;;
esac

# --- 4. credentials ----------------------------------------------------------
RPC_PASS="$(node -p 'require("crypto").randomBytes(24).toString("hex")')"
RPC_LOGIN="$RPC_USER:$RPC_PASS"
umask 077
printf '%s\n' "$RPC_LOGIN" > "$ROOT/.rpc-credentials"

# --- 5. monero-wallet-rpc ----------------------------------------------------
say "[Monero] Starting Wallet RPC..."
nohup "$RPC_BIN" \
  --wallet-dir "$WALLET_DIR" \
  --rpc-bind-ip 127.0.0.1 \
  --rpc-bind-port "$RPC_PORT" \
  --rpc-login "$RPC_LOGIN" \
  --daemon-address "$NODE_ADDRESS" \
  --non-interactive \
  --log-level 1 \
  --log-file "$LOG_DIR/wallet-rpc.log" \
  --max-log-file-size 10485000 \
  --max-log-files 5 \
  >"$LOG_DIR/wallet-rpc.out" 2>&1 &
RPC_PID=$!
printf '%s\n' "$RPC_PID" > "$RUN_DIR/wallet-rpc.pid"

if ! wait_for_port "$RPC_PORT" 60; then
  fail "Wallet RPC did not start listening on 127.0.0.1:$RPC_PORT.
        See $LOG_DIR/wallet-rpc.log for details."
fi
say "[Check] Wallet RPC listening on 127.0.0.1:$RPC_PORT"

# --- 6. backend --------------------------------------------------------------
say "[Backend] Starting..."
MONERO_RPC_URL="http://127.0.0.1:$RPC_PORT/json_rpc" \
MONERO_RPC_LOGIN="$RPC_LOGIN" \
MONERO_WALLET_DIR="$WALLET_DIR" \
MONERO_DAEMON_ADDRESS="$NODE_ADDRESS" \
PORT="$BACKEND_PORT" \
nohup node "$ROOT/backend/dist/server.js" >"$LOG_DIR/backend.out" 2>&1 &
BACKEND_PID=$!
printf '%s\n' "$BACKEND_PID" > "$RUN_DIR/backend.pid"

HEALTH=""
for _ in $(seq 1 45); do
  if [ "$(url_status "http://127.0.0.1:$BACKEND_PORT/api/health" 2000)" = "200" ]; then HEALTH="ok"; break; fi
  sleep 1
done
if [ "$HEALTH" != "ok" ]; then
  fail "The backend did not answer on http://127.0.0.1:$BACKEND_PORT/api/health
        See $LOG_DIR/backend.log for details."
fi
say "[Check] Backend ready on 127.0.0.1:$BACKEND_PORT"

# --- 7. frontend -------------------------------------------------------------
if [ "$DEVMODE" -eq 1 ]; then
  say "[Frontend] Starting the Vite dev server..."
  (cd "$ROOT/frontend" && nohup npm run dev >"$LOG_DIR/frontend.out" 2>&1 & echo $! > "$RUN_DIR/frontend.pid")
  if ! wait_for_port "$FRONTEND_PORT" 60; then
    fail "The Vite dev server did not start on 127.0.0.1:$FRONTEND_PORT.
          See $LOG_DIR/frontend.out for details."
  fi
  UI_URL="http://127.0.0.1:$FRONTEND_PORT/#/welcome"
else
  say "[Frontend] Serving the built wallet UI from the backend..."
  UI_URL="http://127.0.0.1:$BACKEND_PORT/#/welcome"
fi
say "[Frontend] UI available at $UI_URL"

# --- 8. open the browser -----------------------------------------------------
if command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$UI_URL" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
  open "$UI_URL" >/dev/null 2>&1 || true
elif command -v cmd.exe >/dev/null 2>&1; then
  cmd.exe /c start "" "$UI_URL" >/dev/null 2>&1 || true
else
  say "[Info] Open $UI_URL in your browser."
fi

say ""
say "[Wallet] Ready"
say "----------------------------------------------------------"
say "  Wallet UI      $UI_URL"
say "  Wallet RPC     127.0.0.1:$RPC_PORT  (login enabled, loopback only)"
say "  Backend API    127.0.0.1:$BACKEND_PORT"
say "  Daemon         $NODE_ADDRESS"
say "  Wallet files   $WALLET_DIR"
say "  Logs           $LOG_DIR"
say "----------------------------------------------------------"
say "  Services run in the background. Stop them with ./stop.sh"
say ""
