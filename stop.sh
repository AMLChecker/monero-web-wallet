#!/usr/bin/env bash
#
# Monero Web Wallet - stops the services started by start.sh (equivalent of Stop.bat).
# It kills the processes recorded in .run/*.pid and, as a fallback, whatever still
# listens on the wallet ports.
#
#   ./stop.sh
#
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
RUN_DIR="$ROOT/.run"
RPC_PORT="${MONERO_RPC_PORT:-18083}"
BACKEND_PORT="${PORT:-18082}"
FRONTEND_PORT="${MONERO_FRONTEND_PORT:-5173}"

say() { printf '%s\n' "$*"; }

say "Stopping Monero Web Wallet services..."

port_pids() { # port -> pids listening on it, one per line
  node -e '
    const { execSync } = require("child_process");
    const port = Number(process.argv[1]);
    const commands = [
      `lsof -nP -iTCP:${port} -sTCP:LISTEN -t`,
      `ss -ltnpH "sport = :${port}"`,
    ];
    const found = new Set();
    for (const command of commands) {
      try {
        const out = execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString();
        for (const line of out.split("\n")) {
          const match = line.match(/pid=(\d+)/);
          const pid = match ? match[1] : line.trim();
          if (/^\d+$/.test(pid)) found.add(pid);
        }
      } catch { /* the tool is missing or nothing listens */ }
    }
    process.stdout.write([...found].join("\n"));
  ' "$1" 2>/dev/null || true
}

kill_pid_file() { # path, label
  local file="$1" label="$2" pid
  [ -f "$file" ] || return 0
  pid="$(tr -d '\r\n' < "$file")"
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    say "  stopping $label (pid $pid)"
    kill "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.5
    done
    if kill -0 "$pid" 2>/dev/null; then kill -9 "$pid" 2>/dev/null || true; fi
  fi
  rm -f "$file"
}

kill_port() { # port, label
  local port="$1" label="$2" pid
  for pid in $(port_pids "$port"); do
    say "  stopping $label on port $port (pid $pid)"
    kill "$pid" 2>/dev/null || true
    sleep 1
    kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
  done

  # Git Bash / Cygwin on Windows: PIDs there live in a different namespace, so ask
  # Windows who owns the port. On Linux and macOS this block is simply skipped.
  if command -v taskkill.exe >/dev/null 2>&1 && command -v powershell.exe >/dev/null 2>&1; then
    local win_pids
    win_pids="$(powershell.exe -NoProfile -Command \
      "(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).OwningProcess" \
      2>/dev/null | tr -d '\r' || true)"
    for pid in $win_pids; do
      case "$pid" in
        0|'') continue ;;
      esac
      say "  stopping $label on port $port (windows pid $pid)"
      # MSYS2_ARG_CONV_EXCL stops Git Bash from turning /PID into a path.
      MSYS2_ARG_CONV_EXCL='*' taskkill.exe /PID "$pid" /T /F >/dev/null 2>&1 || true
    done
  fi
}

kill_pid_file "$RUN_DIR/backend.pid" "backend"
kill_pid_file "$RUN_DIR/frontend.pid" "frontend"
kill_pid_file "$RUN_DIR/wallet-rpc.pid" "wallet rpc"

# The wallet RPC writes its PID only in some environments, so always check ports too.
kill_port "$BACKEND_PORT" "backend"
kill_port "$RPC_PORT" "wallet rpc"
kill_port "$FRONTEND_PORT" "dev server"

rm -f "$RUN_DIR/backend.pid" "$RUN_DIR/frontend.pid" "$RUN_DIR/wallet-rpc.pid"

sleep 1
LEFT=""
for port in "$BACKEND_PORT" "$RPC_PORT" "$FRONTEND_PORT"; do
  if node -e '
    const net = require("net");
    const socket = net.connect({ host: "127.0.0.1", port: Number(process.argv[1]) });
    socket.on("connect", () => { socket.destroy(); process.exit(0); });
    socket.on("error", () => process.exit(1));
    socket.setTimeout(1500, () => { socket.destroy(); process.exit(1); });
  ' "$port"; then LEFT="$LEFT $port"; fi
done

if [ -n "$LEFT" ]; then
  say "Still listening:$LEFT"
  say "If a service keeps restarting, stop it manually (kill, or the system monitor)."
else
  say "All wallet services stopped. Ports $BACKEND_PORT, $RPC_PORT and $FRONTEND_PORT are free."
fi
