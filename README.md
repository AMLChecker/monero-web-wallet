<div align="center">

# Monero Web Wallet

**A self-hosted Monero web wallet with a premium dark UI — powered by the official `monero-wallet-rpc`, with no third-party servers, no telemetry and no mock data.**

[![build](https://github.com/AMLChecker/monero-web-wallet/actions/workflows/build.yml/badge.svg)](https://github.com/AMLChecker/monero-web-wallet/actions/workflows/build.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![platform: Windows](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6?logo=windows)](https://github.com/AMLChecker/monero-web-wallet)
[![node: >=18](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Monero: 0.18.x](https://img.shields.io/badge/Monero-0.18.x-FF6600)](https://www.getmonero.org/downloads/)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Website](https://amlchecker.github.io/monero-web-wallet/) · [Features](#features) · [Screenshots](#screenshots) · [Quick start](#quick-start-windows) · [Configuration](#configuration) · [Security](SECURITY.md) · [FAQ](#faq) · [Donate](#support-the-project) · [Русский](README.ru.md)

<a href="docs/screenshots/hero.png"><img src="docs/screenshots/hero.png" alt="Monero Web Wallet dashboard: total and unlocked balance, sync progress against the network, node status and recent activity" width="100%"></a>

</div>

---

**Monero Web Wallet** is a local web wallet (GUI) for [Monero (XMR)](https://www.getmonero.org/)
that runs entirely on your own computer. The React interface talks only to a small
Node.js backend on `127.0.0.1`, and every wallet operation — creating a wallet, showing
balances, building transactions, relaying them — is executed by the **official
`monero-wallet-rpc` binary**. No Monero cryptography is reimplemented here, no keys
ever leave your machine, and the UI never invents demo balances or fake transactions.

It is made for people who want a modern wallet interface with the privacy model of the
command-line wallet: your keys stay in your own wallet file, your node is your own
choice, and the only thing that touches the network is the Monero daemon.

```
Browser (React UI)  →  Node backend 127.0.0.1:18082  →  monero-wallet-rpc 127.0.0.1:18083  →  monerod / your node
        no keys                  no keys in the browser            official binary             full validation
```

<!-- SEO: monero web wallet, monero-wallet-rpc, self hosted monero wallet, monero gui, monero wallet windows, monero xmr wallet, privacy wallet, react monero wallet -->

## Table of contents

- [What is Monero Web Wallet?](#what-is-monero-web-wallet)
- [Why this wallet?](#why-this-wallet)
- [Features](#features)
- [Screenshots](#screenshots)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Quick start (Windows)](#quick-start-windows)
- [Quick start (Linux and macOS)](#quick-start-linux-and-macos)
- [Manual setup (any OS)](#manual-setup-any-os)
- [Configuration](#configuration)
- [Wallet files and directories](#wallet-files-and-directories)
- [Choosing a node (privacy)](#choosing-a-node-privacy)
- [How sending works](#how-sending-works)
- [Security model](#security-model)
- [HTTP API](#http-api)
- [Project structure](#project-structure)
- [Diagnostics](#diagnostics)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Roadmap](#roadmap)
- [Support the project](#support-the-project)
- [Contributing](#contributing)
- [License](#license)

## What is Monero Web Wallet?

**Monero Web Wallet is a self-hosted web interface for the official Monero wallet RPC.**
You run it locally, open it in your browser, and manage a real Monero wallet with a
desktop-class dark UI: balance and sync status, transaction history, sending with an
explicit review step, subaddresses with QR codes, node switching and recovery-phrase
backup.

What it is:

- a **local wallet application** (a web UI over `monero-wallet-rpc`), not a hosted service;
- **non-custodial** — your wallet file and keys stay on your disk;
- **transparent** — the source is short and readable: ~1.5k lines of TypeScript in the backend, a small React frontend;
- **honest** — if wallet RPC or your node is down, the UI says so instead of showing fake data.

What it is not:

- not a remote or custodial wallet: there is no server operated by the author;
- not a replacement for the official [Monero GUI](https://www.getmonero.org/downloads/) when you need its advanced tooling;
- not hardware-wallet aware yet (no Ledger/Trezor support);
- not audited — treat it as you would treat any small self-hosted wallet project (see [SECURITY.md](SECURITY.md)).

## Why this wallet?

| | Monero Web Wallet | Monero GUI | Monero CLI | Hosted web wallets |
| --- | --- | --- | --- | --- |
| Keys stay on your machine | ✅ | ✅ | ✅ | ❌ |
| Works in a browser | ✅ | ❌ | ❌ | ✅ |
| Open source & self-hosted | ✅ | ✅ | ✅ | ❌ |
| Modern responsive UI | ✅ | ⚠️ desktop only | ❌ | ⚠️ |
| Explicit two-phase send (review exact fee, then relay) | ✅ | ❌ | ❌ | ❌ |
| Any Monero wallet file can be opened | ✅ | ✅ | ✅ | ❌ |
| Depends on a third-party server | ❌ (only your node) | ❌ | ❌ | ✅ |

The design goal is simple: **the ergonomics of a modern app, the trust model of the CLI.**

## Features

### Wallet

- Create a new wallet (25-word recovery phrase shown once, with a hide toggle and copy buttons) or open any existing Monero wallet file — you are asked for its password every time.
- Total / unlocked / locked balance, with a sync progress bar comparing wallet height to network height.
- Full transaction history from `get_transfers`: received, sent, pending and failed transfers with confirmations, lock state, payment id, note and a details dialog.
- Subaddresses: create labeled subaddresses, list them, copy any of them, and show a QR code for the selected address.

### Sending

- Recipient address validation through `validate_address` (mainnet only) before anything is built.
- **Two-phase send:** the transaction is built and signed locally with `do_not_relay`, you see the **exact** network fee and the total, and only your explicit confirmation broadcasts it with `relay_tx`.
- **No fee-level control:** every transaction is sent at **Low**, the cheapest fee the network accepts, so there is nothing to guess and nothing to configure. A "MAX" helper respects locked balances.
- **Support for the project** — a **0.5%** tip is preselected on the Send page and `Off` or `1%` is one tap away. Nothing is ever charged quietly: the confirmation dialog lists the exact support amount and the address it goes to before anything is signed. The address is configurable with `SUPPORT_ADDRESS` (change it if you fork).
- Clear, human-readable errors instead of raw RPC codes ("Not enough spendable balance", "Wallet RPC cannot reach the Monero daemon", …).

### Supporting the project

- A dedicated **Support** page — reachable from the sidebar and from the Dashboard button next to Send and Receive — for a voluntary donation straight to the developer address, with the QR code and the address shown for anyone who would rather donate from another wallet.
- **No commission is ever added on a donation:** the whole amount reaches the address and the only other cost is the Monero network fee. The confirmation dialog prints the amount, the fee and "Commission taken by this wallet — None" before anything is signed.

### Node

- Live node status: daemon address, height, latency, connection state, wallet-vs-network sync percentage.
- Switch nodes at runtime from Settings (`set_daemon`); the choice is stored in `node-address.txt` for the next launch.
- Works with a local `monerod` or a remote node; the launcher prefers your local node automatically.

### Price

- Optional balance quote in **USDT** (Kraken XMR/USDT) or **USD** (CoinGecko), switchable in Settings and saved to `price-source.txt`.
- Off by default: when it is on, this is the only outbound request the wallet makes (at most once a minute, cached, refreshed in the background so the UI never waits).
- Never invents a rate: if the API is unreachable or not configured, no fiat amount is shown at all. A custom endpoint (`PRICE_API_URL`) is supported too.

### Interface

- Dark, minimal, premium look: background `#09090B`, cards `#111113`, hairline borders, 14–18 px radii, Monero-orange accent, Lucide icons, tabular numerals for amounts.
- Fully responsive: fixed 230 px sidebar on desktop, slide-in drawer on phones and tablets, tables that become card lists on small screens, modals that become bottom sheets.
- Status is always visible: wallet RPC state, node state, sync state, wallet name and address.

### Security

- `monero-wallet-rpc` is bound to `127.0.0.1`, HTTP digest authentication is enabled, and a **fresh random RPC login is generated on every launch**.
- The browser never receives RPC credentials, never talks to the wallet RPC port, and the wallet password is never stored in `localStorage`/`sessionStorage`.
- Passwords, seeds and private keys are never written to logs; prepared transactions live only in backend memory with a short expiry.
- All money math uses atomic units (`BigInt`/strings) — floats are never used for amounts.
- The backend rejects requests with a non-loopback `Host`/`Origin` header (DNS-rebinding and cross-site protection).

## Screenshots

All screenshots below are taken with a freshly created demo wallet that holds no funds — no real address, balance or transaction history is published in this repository.

![Animated tour of Monero Web Wallet: dashboard with balance and sync status, send form, creating a subaddress, transaction history and settings](docs/screenshots/demo.gif)

*A 25-second tour: dashboard and sync status → send form → subaddress with QR → history → settings.*

| Dashboard | Send Monero | Receive / subaddresses |
| --- | --- | --- |
| ![Monero wallet dashboard with balance and sync status](docs/screenshots/dashboard.png) | ![Send Monero form with fee review](docs/screenshots/send.png) | ![Receive page with QR code and subaddress list](docs/screenshots/receive.png) |

| Transactions | Support the project | Settings (wallet, node, security) |
| --- | --- | --- |
| ![Monero transaction history with confirmations and txid](docs/screenshots/transactions.png) | ![Support page: donation amount presets, QR code and the developer address](docs/screenshots/support.png) | ![Wallet settings: node address, lock wallet, backup phrase](docs/screenshots/settings.png) |

| Mobile layout with navigation drawer |
| --- |
| ![Mobile responsive wallet layout](docs/screenshots/mobile.png) |

## Architecture

```
┌──────────┐   HTTP (loopback only)   ┌────────────────┐      JSON-RPC       ┌───────────────────────┐
│ Browser  │ ───────────────────────► │  Node backend  │ ──────────────────► │ monero-wallet-rpc.exe │
│ React UI │ ◄─────────────────────── │ 127.0.0.1:18082│ ◄────────────────── │ 127.0.0.1:18083       │
└──────────┘                          └────────────────┘                     └───────────┬───────────┘
                                                                                         │
                                                                              ┌──────────▼──────────┐
                                                                              │ monerod / remote node│
                                                                              └─────────────────────┘
```

| Layer | Technology | Responsibility |
| --- | --- | --- |
| UI | React 18, Vite, TypeScript, Tailwind CSS, Lucide | Rendering, forms, polling, confirmation dialogs |
| Backend | Node.js, Express, TypeScript | Local-only API, wallet session, two-phase sending, error shaping |
| Wallet RPC client | `node:http` + HTTP digest | Authenticated JSON-RPC to the official binary on a pinned keep-alive socket |
| Wallet engine | `monero-wallet-rpc` (official binary) | All key handling, signing, scanning, relaying |

More detail — including the non-obvious digest-auth behaviour of `monero-wallet-rpc` —
is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Requirements

- **Windows 10/11** (`Start.bat`) or **Linux/macOS** (`start.sh` / `stop.sh`). Both
  launchers do the same work; the backend and frontend are cross-platform and also run
  manually (see [Manual setup](#manual-setup-any-os)).
- **Nothing else to install by hand.** The launcher prepares its own prerequisites: if
  Node.js is missing it installs it (winget, or the official portable build from
  <https://nodejs.org>), and if the Monero binaries are missing it downloads the official CLI
  archive from <https://www.getmonero.org/downloads/>. Every download is verified against the
  checksum its publisher ships (`SHASUMS256.txt` for Node.js, `hashes.txt` for Monero) and
  nothing is unpacked or executed before that check passes — see
  [scripts/ensure-deps.ps1](scripts/ensure-deps.ps1) and
  [scripts/ensure-deps.sh](scripts/ensure-deps.sh).
- The release archive already contains Node-free copies of everything: the Monero binaries
  (unmodified v0.18.5.1, see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)), a compiled
  backend with its `node_modules` and a prebuilt UI, so on a machine with Node.js it starts
  without a single download.
- A reachable Monero daemon: your own `monerod` (recommended for privacy) or a remote node.

## Quick start (Windows)

```text
1. Unpack monero-web-wallet-<version>.zip - or just clone the repository;
   the launcher downloads whatever is missing
2. Double-click Start.bat
3. Your browser opens http://127.0.0.1:18082/#/welcome
4. Click "Open main" (or "Create New Wallet") and enter your wallet password
```

What the launcher does:

1. prepares its prerequisites through `scripts\ensure-deps.ps1`: Node.js and the Monero
   binaries are installed (checksum-verified downloads) if they are missing;
2. installs npm dependencies in `backend` and `frontend` when they are missing;
3. builds the backend and the UI when their `dist` folders are missing;
4. starts `monero-wallet-rpc.exe` on `127.0.0.1:18083` with a fresh random RPC login;
5. starts the backend on `127.0.0.1:18082` (it also serves the built UI);
6. opens the wallet in your default browser.

```text
[Check] monero-wallet-rpc.exe found
[Check] Node.js v22.14.0 found
[Monero] Starting Wallet RPC...
[Backend] Starting...
[Frontend] Starting...
[Wallet] Ready
```

Services keep running in the background without extra windows; logs go to
`logs\backend.log` and `logs\wallet-rpc.log`, PID files to `.run\`.

**Commands**

```bat
Start.bat              start everything (builds if needed)
Start.bat --rebuild    force a rebuild of backend and frontend
Start.bat --dev        run the Vite dev server on 127.0.0.1:5173 (hot reload)
Start.bat --update-monero   update the Monero binaries to the current official release
Update-Monero.bat      same, for a double-click; Update-Monero.bat 0.18.5.1 pins a version
Stop.bat               stop all services (by PID file and by port)
```

**Keeping Monero current**

The binaries in the archive are a tested release (0.18.5.1). When the Monero project publishes
a new one, `Update-Monero.bat` replaces `monero-wallet-rpc`, `monerod` and `monero-wallet-cli`
in place: it takes the current version from the `downloads.getmonero.org/win64` redirect,
verifies the archive against the published `hashes.txt`, keeps what it replaced in
`.backup\monero-<version>\` and prints old → new. Passing a version (`Update-Monero.bat
0.18.5.1`) works as a rollback. On Linux/macOS the same is `./scripts/update-monero.sh`.

Nothing checks for new releases unless you ask: set `MONERO_CHECK_UPDATES=1` before starting and
the launcher prints a one-line notice when a newer release exists. The wallet itself keeps
making no outbound requests of its own.

## Quick start (Linux and macOS)

```bash
# 1. nothing to download by hand - start.sh fetches Node.js and the Monero binaries it needs
./start.sh             # prepares/installs what is missing, starts everything, opens the browser
./stop.sh              # stops the services and frees the ports
./start.sh --rebuild   # force a rebuild of backend and frontend
./start.sh --dev       # run the Vite dev server on 127.0.0.1:5173
./scripts/update-monero.sh   # update the Monero binaries to the current release
```

`start.sh` does exactly what `Start.bat` does: it checks that `monero-wallet-rpc` and
Node.js 18+ are present, installs npm dependencies and builds when their `dist` folders are
missing, generates a **fresh random RPC login**, starts `monero-wallet-rpc` on loopback
(`127.0.0.1`) only, starts the backend that serves the UI, waits for both to answer, and
opens `http://127.0.0.1:18082`. Everything is configurable with the same environment
variables as the Windows launcher: `MONERO_RPC_PORT`, `PORT`, `MONERO_WALLET_DIR`,
`MONERO_DAEMON_ADDRESS`, `MONERO_FALLBACK_NODE`, `MONERO_SEND_MODE`.

Logs go to `logs/wallet-rpc.log` (Monero's own log), `logs/wallet-rpc.out` and
`logs/backend.out`; PID files are written to `.run/`. The scripts need only `bash` and
`node` — no `lsof`, `ss` or `curl` required.

## Manual setup (any OS)

```bash
# 1. official wallet RPC (replace the path with your Monero binaries)
monero-wallet-rpc --wallet-dir . --rpc-bind-ip 127.0.0.1 --rpc-bind-port 18083 \
  --rpc-login user:pass --daemon-address 127.0.0.1:18081 --non-interactive

# 2. backend
cd backend
npm install
npm run build
MONERO_RPC_LOGIN=user:pass npm start        # Windows: set MONERO_RPC_LOGIN=user:pass

# 3. frontend (development, proxies /api to the backend)
cd ../frontend
npm install
npm run dev                                 # http://127.0.0.1:5173
npm run build                               # production bundle in frontend/dist
```

When `frontend/dist` exists, the backend serves it, so a "production" run is just
`npm run build` in both packages and `node backend/dist/server.js`.

## Configuration

All environment variables are optional.

| Variable | Default | Description |
| --- | --- | --- |
| `MONERO_RPC_URL` | `http://127.0.0.1:18083/json_rpc` | Wallet RPC endpoint |
| `MONERO_RPC_LOGIN` | value of `.rpc-credentials` | `user:password` for digest authentication |
| `MONERO_WALLET_DIR` | project root, or `wallets/` when it already contains wallets | Directory passed to `--wallet-dir` |
| `MONERO_DAEMON_ADDRESS` | `127.0.0.1:18081`, then `node-address.txt` | Monero daemon (`host:port` or `http(s)://host:port`) |
| `MONERO_SEND_MODE` | `prepare` | `prepare` = build → confirm → relay; `direct` = one confirmed `transfer` |
| `PRICE_SOURCE` | `none` (or the value in `price-source.txt`) | Balance quote: `none`, `kraken` (XMR/USDT), `coingecko` (XMR/USD), `custom` |
| `PRICE_API_URL` | empty | Endpoint for the `custom` source; must return JSON with a numeric `price` |
| `SUPPORT_ADDRESS` | the donation address from this README | Address that receives the optional per-transfer support amount (always shown in the confirmation dialog before signing) |
| `PORT` / `HOST` | `18082` / `127.0.0.1` | Backend bind address (keep it loopback) |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `MONERO_BACKEND_PORT` | `18082` | Backend port used by the Vite dev proxy |
| `MONERO_FRONTEND_PORT` | `5173` | Vite dev server port |

### Ports

| Service | Address |
| --- | --- |
| Wallet UI + backend API | `127.0.0.1:18082` |
| `monero-wallet-rpc` | `127.0.0.1:18083` |
| Vite dev server (`Start.bat --dev`) | `127.0.0.1:5173` |

## Wallet files and directories

`monero-wallet-rpc` is started with a fixed `--wallet-dir`; the launcher resolves it as:
`MONERO_WALLET_DIR` → `wallets/` (when it already contains `*.keys`) → the project root.

A Monero wallet is always a pair of files: `<name>` and `<name>.keys`. They are
git-ignored and this project never moves, copies or deletes them. Any wallet created by
the official CLI or GUI can be opened; the UI asks for its password.

## Choosing a node (privacy)

Resolution order: `MONERO_DAEMON_ADDRESS` → a locally running `monerod` on
`127.0.0.1:18081` → `node-address.txt` → the fallback node defined in `Start.bat`
(`FALLBACK_NODE`). You can switch at any time in **Settings → Change daemon**.

Running your own `monerod` is strongly recommended: it validates the chain yourself and
no third party sees your IP address or which blocks your wallet asks for. A remote node
will still work (and the UI warns you when one is used), but it can observe your wallet's
network activity.

## How sending works

```text
Review transaction                     Confirm & Send
        │                                     │
        ▼                                     ▼
transfer(do_not_relay: true)  ─────►  relay_tx(tx_metadata)  ─────►  Monero network
   builds & signs locally                only after your click
   shows the exact fee
```

1. **Review** — the backend builds the transaction locally (`do_not_relay: true`) and
   returns the exact fee, the amount and the total. The signed blob stays on the
   backend; the browser never sees it.
2. **Confirm & Send** — the backend relays it and returns the txid, which then appears
   in the history as pending until it is mined.

Cancelling the dialog discards the prepared transaction — nothing is broadcast, ever,
without that second click. If your wallet RPC build does not return `tx_metadata`, set
`MONERO_SEND_MODE=direct` to sign and broadcast in a single confirmed step.

## Security model

Short version: **loopback only, no credentials in the browser, no secrets in logs, no
float math, no automatic broadcasting.** The full model, threat boundaries and
recommendations are in [SECURITY.md](SECURITY.md).

| Concern | How it is handled |
| --- | --- |
| Wallet RPC exposure | `--rpc-bind-ip 127.0.0.1`, digest auth enabled, never `--disable-rpc-login` |
| RPC credentials | Generated per launch, backend-only (`.rpc-credentials`, git-ignored) |
| Wallet password | Asked per session, never persisted, never logged, never in `localStorage` |
| Recovery phrase | Shown only on creation or explicit export (password re-verified) |
| Prepared transactions | Backend memory only, 10-minute expiry, dropped on cancel |
| Amounts | Atomic units (`BigInt`) everywhere; no floating point |
| Local API access | `Host`/`Origin` must be loopback; `no-store`, `nosniff`, `no-referrer` |
| Accidental sends | Address validated first, explicit confirmation dialog, no auto-send |
| Optional price API | Off unless you enable it. When on it is the **only** outbound request the backend makes (once a minute, to the exchange you picked) — disable it to stay fully offline |

## HTTP API

The backend exposes a small JSON API on `127.0.0.1` (no authentication needed because it
is unreachable from other machines — see [SECURITY.md](SECURITY.md)).

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Backend and wallet RPC liveness |
| `GET` | `/api/wallets` | Wallet files found in the wallet directory |
| `POST` | `/api/wallet/create` | Create a wallet (returns address + recovery phrase) |
| `POST` | `/api/wallet/open` | Open a wallet (password required) |
| `POST` | `/api/wallet/close` | Close the wallet session (`/api/wallet/lock` is an alias) |
| `GET` | `/api/wallet/info` | RPC, wallet, node and sync state |
| `GET` | `/api/wallet/balance` | Total, unlocked and locked balance |
| `GET` | `/api/wallet/address` | Primary address, subaddresses, accounts |
| `GET` | `/api/wallet/transactions` | Normalised `get_transfers` history |
| `POST` | `/api/wallet/send/prepare` | Build a transaction without relaying |
| `POST` | `/api/wallet/send` | Confirm and broadcast a prepared transaction |
| `POST` | `/api/wallet/send/cancel` | Discard a prepared transaction |
| `POST` | `/api/wallet/subaddress` | Create a labeled subaddress |
| `POST` | `/api/wallet/phrase` | Export the recovery phrase (password re-check) |
| `POST` | `/api/wallet/address/validate` | Validate a Monero address |
| `POST` | `/api/wallet/refresh` | Force a wallet refresh |
| `GET` | `/api/node/status` | Daemon status, height and latency |
| `POST` | `/api/node/daemon` | Switch the daemon at runtime |
| `GET` | `/api/price` | Current quote: source, pair, value, timestamps |
| `POST` | `/api/price/source` | Switch the price source (`none`, `kraken`, `coingecko`, `custom`) |

Errors are always
`{ "error": { "code": "INSUFFICIENT_FUNDS", "message": "…", "hint": "…" } }` with
human-readable text instead of raw RPC codes.

## Project structure

```
Start.bat / Stop.bat          Windows launcher and shutdown helper
start.sh / stop.sh            launcher and shutdown helper for Linux and macOS
wallets/README.md             wallet directory notes
backend/
  src/server.ts               Express API, static hosting, loopback guards
  src/moneroRpc.ts            JSON-RPC client for monero-wallet-rpc
  src/walletManager.ts        sessions, balances, history, two-phase sending
  src/digestAuth.ts           HTTP digest handshake for the wallet RPC
  src/daemon.ts               daemon probing with stale-while-revalidate cache
  src/price.ts                optional USDT/USD quote (Kraken, CoinGecko, custom)
  src/amounts.ts              atomic-unit (BigInt) money handling
  src/errors.ts               RPC errors → actionable messages
  src/config.ts               ports, paths, credentials, wallet/node resolution
  src/logger.ts               logging that never records secrets
  scripts/doctor.mjs          standalone RPC diagnostic
frontend/
  src/pages/                  Welcome, CreateWallet, Dashboard, Send, Receive,
                              Transactions, Settings
  src/components/             UI kit, sidebar, transaction list, toasts, logo
  src/state/, src/hooks/      wallet context and polling hooks
  src/api/, src/lib/          typed backend client, XMR formatting, router
docs/ARCHITECTURE.md          implementation notes
docs/screenshots/             UI screenshots (demo wallet, no real funds)
SECURITY.md                   security model and vulnerability reporting
```

## Diagnostics

```bash
cd backend
node scripts/doctor.mjs
```

It prints the configured endpoint, whether credentials are present, a raw handshake
probe and a couple of RPC calls — the fastest way to distinguish "wallet RPC is not
running" from "credentials are wrong".

### Tests

```bash
npm --prefix backend test      # 53 tests, Node's built-in test runner, no extra dependencies
```

The suite covers money parsing and formatting (atomic units, no floating point),
transfer normalisation (`get_transfers` buckets, confirmations, locked funds), the RPC
error mapping table and the digest-auth handshake that `monero-wallet-rpc` requires.
CI runs it on every push together with both builds.

## Troubleshooting

Still stuck after reading this table? [Open an issue](https://github.com/AMLChecker/monero-web-wallet/issues/new?template=bug_report.yml) —
the bug template asks for exactly the details needed to help (component, OS, Node and wallet RPC version, node type and the relevant log lines).
Problems with `Start.bat`, ports or a missing node have their own [setup form](https://github.com/AMLChecker/monero-web-wallet/issues/new?template=setup_help.yml),
and ideas are welcome in the [feature request form](https://github.com/AMLChecker/monero-web-wallet/issues/new?template=feature_request.yml).
Never include your password, recovery phrase or private keys in a report.

| Symptom | Cause / fix |
| --- | --- |
| **Wallet RPC Offline** | `monero-wallet-rpc.exe` is not running or port 18083 is busy. Run `Stop.bat`, then `Start.bat`; check `logs\wallet-rpc.log`. |
| **This wallet is already open in another Monero program** | The wallet file is locked by `monero-wallet-cli.exe` or another wallet window. Close it and retry. |
| **Daemon unavailable** | The node is unreachable — start `monerod` or set another node in Settings. |
| **monero-wallet-rpc cannot see this wallet file** | The RPC process was started with a different `--wallet-dir`. Start everything with `Start.bat`, or align `MONERO_WALLET_DIR`. |
| **Port 18082/18083 already in use** | An older instance is still running: `Stop.bat` or end the process in Task Manager. |
| **Windows Defender removed `monero-wallet-rpc.exe`** | Defender classifies the official Monero binaries as potentially unwanted (they contain mining-related strings). Check Windows Security → Protection history, restore the file and add the project folder to Exclusions. This project runs a wallet, it never mines. |
| **`start.sh` says the wallet RPC did not start** | Look at `logs/wallet-rpc.log` (Monero's own log) and `logs/wallet-rpc.out` — usually a busy port (`MONERO_RPC_PORT`) or a node that cannot be reached. |
| **`start.sh` says the backend did not answer** | See `logs/backend.log` and `logs/backend.out`; the port can be changed with `PORT=18092 ./start.sh`. |
| UI shows old heights | Click **Sync now**; a remote node can be slow (latency is shown in Settings). |
| `npm install` warns about blocked install scripts (`esbuild`) | npm 11+ policy. The Vite build still works; otherwise run `npm install-scripts approve esbuild` inside `frontend`. |
| Address rejected when sending | The address must be a mainnet Monero address (or subaddress). Integrated addresses and testnet are not supported by the form. |

## FAQ

<details>
<summary><b>Is this a custodial or hosted wallet?</b></summary>

No. Nothing is hosted: you run the software on your own computer. There is no service
operated by the author that could see your keys, and the backend refuses connections
that do not come from your own machine.
</details>

<details>
<summary><b>Where are my private keys and seed stored?</b></summary>

Only in your own Monero wallet file (`<name>` + `<name>.keys`), exactly as with the
official CLI or GUI. The web UI never stores keys; the recovery phrase is displayed for
backup and is not persisted anywhere.
</details>

<details>
<summary><b>Do I need a full Monero node?</b></summary>

No — any reachable `monerod` or remote node works. Your own node is recommended for
privacy and reliability.
</details>

<details>
<summary><b>Does it work on Linux or macOS?</b></summary>

Yes, with the manual setup: run your platform's `monero-wallet-rpc`, the Node backend and
the Vite/`dist` frontend. Only `Start.bat`/`Stop.bat` are Windows-specific.
</details>

<details>
<summary><b>Can it open my existing wallet created by the Monero CLI or GUI?</b></summary>

Yes. Put the wallet files in the wallet directory (or set `MONERO_WALLET_DIR`), restart,
and open the wallet from the welcome screen with its password.
</details>

<details>
<summary><b>Is the wallet password stored anywhere?</b></summary>

It is used only to open the wallet file and is never written to disk, logs, cookies or
`localStorage`. If you export the recovery phrase, you are asked for it again and the
wallet file is re-opened to verify it.
</details>

<details>
<summary><b>Does it support hardware wallets (Ledger, Trezor)?</b></summary>

Not yet — it drives the software wallet RPC only.
</details>

<details>
<summary><b>Can I send a transaction without reviewing the fee?</b></summary>

There is no way to broadcast a transaction without pressing **Confirm & Send** on the
review dialog that shows the exact fee and total. That is intentional.
</details>

<details>
<summary><b>Can I pick a different transaction priority?</b></summary>

No — the wallet always sends at <b>Low</b>, the cheapest fee the network accepts, so a
transfer can take a little longer to confirm. Paying more never made a Monero transaction
private, and it is the kind of switch most people are not equipped to judge. The HTTP API
still accepts `priority` from `0` to `3` if you build on top of it.
</details>

<details>
<summary><b>Does the wallet show a fiat price?</b></summary>

Only if you ask it to. Settings → <b>Price</b> offers USDT via Kraken (XMR/USDT), USD via
CoinGecko (XMR/USD) or your own endpoint; it is off by default, cached for a minute and
switchable at any time. When no source is configured — or the API is unreachable — the UI
shows no fiat amount at all, because the project never invents a rate.
</details>

## Roadmap

**Shipped recently**

- **Balance quote in USDT / USD** ([#4](https://github.com/AMLChecker/monero-web-wallet/issues/4)) — Kraken XMR/USDT, CoinGecko XMR/USD or a custom endpoint, off by default. See [Price](#price).
- **Launcher scripts for Linux and macOS** ([#2](https://github.com/AMLChecker/monero-web-wallet/issues/2)) — `start.sh` / `stop.sh` with the same checks, flags and safety rules as `Start.bat`. See [Quick start (Linux and macOS)](#quick-start-linux-and-macos).

**Planned — contributions welcome** (each links to an issue you can pick up)

- Docker packaging — [#1](https://github.com/AMLChecker/monero-web-wallet/issues/1)
- Translated UI (currently English, Russian docs exist) — [#3](https://github.com/AMLChecker/monero-web-wallet/issues/3)
- Address book and labeled contacts
- Integrated addresses and payment IDs in the Receive page
- Multiple accounts (currently account 0 is used)
- Optional hardware-wallet support
- End-to-end tests against a regtest/stagenet daemon

## Support the project

Monero Web Wallet is developed in spare time, without ads, tracking or paid tiers. If it
is useful to you and you want to support further development (testing time, hardware for
verification, new features), a Monero donation is welcome — entirely optional and
non-refundable.

<div align="center">

<!-- Monero donation address -->
<img src="docs/screenshots/donate-qr.png" width="190" alt="Monero (XMR) donation address QR code">

**XMR (mainnet)**

```text
4ApMgwswd6rUeSu3K9bVoyV5hmjcVLuDUePgk4r8bqh85oQYjF3LVTnAiMfp4ukrAL4umhrV6DfaRP5nXbdLZ3CbMTzmico
```

<sub>Scan the QR code with any Monero wallet, or copy the address above.<br>
Send <b>XMR on mainnet only</b> — funds sent on another network or asset cannot be recovered.</sub>

</div>

The same address is wired into the wallet: open **Support** in the sidebar (or the button next to Send and Receive on the Dashboard), pick an amount and the transfer is built and reviewed like any other payment — with no commission added on top.

The address in `monero:` URI form:

```text
monero:4ApMgwswd6rUeSu3K9bVoyV5hmjcVLuDUePgk4r8bqh85oQYjF3LVTnAiMfp4ukrAL4umhrV6DfaRP5nXbdLZ3CbMTzmico
```

Other ways to help that cost nothing:

- ⭐ star the repository so more people find it;
- report bugs and rough edges in [Issues](https://github.com/AMLChecker/monero-web-wallet/issues);
- share your setup (local node, OS) in discussions — it directly shapes the roadmap;
- translate the UI or improve the documentation.

## Contributing

Pull requests are welcome. The fastest path is **fork → branch → PR**:

```bash
# 1. fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/monero-web-wallet.git
cd monero-web-wallet

# 2. create a branch
git checkout -b fix/short-description

# 3. make the change and verify that both packages still build
npm --prefix backend run build
npm --prefix frontend run build

# 4. commit, push to your fork and open a pull request against AMLChecker/monero-web-wallet:main
git commit -m "fix: short description"
git push origin fix/short-description
```

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR — the rules that keep this project trustworthy are short but strict: **no mock data, no secrets in logs, no float money math, clean TypeScript builds**, and every user-facing button has to perform a real wallet RPC call.

**Looking for something to build?** These are open and labelled:

- [#1 Docker packaging](https://github.com/AMLChecker/monero-web-wallet/issues/1) — image + docker-compose for the wallet RPC, backend and UI (`help wanted`)
- [#3 UI translations](https://github.com/AMLChecker/monero-web-wallet/issues/3) — extract strings, add Russian (`help wanted`)

Everything labelled [good first issue](https://github.com/AMLChecker/monero-web-wallet/labels/good%20first%20issue) and [help wanted](https://github.com/AMLChecker/monero-web-wallet/labels/help%20wanted) is fair game — comment on the issue if you want to take one, so we do not duplicate work.

Already shipped: [#2](https://github.com/AMLChecker/monero-web-wallet/issues/2) — Linux/macOS launchers and [#4](https://github.com/AMLChecker/monero-web-wallet/issues/4) — optional USDT/USD balance quote.

## License

[MIT](LICENSE). The Monero binaries used by this project are distributed by the Monero Project
under their own (BSD 3-Clause) license: they are not part of this repository, but the release
archive ships them unmodified. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

---

**Keywords:** monero web wallet · monero-wallet-rpc GUI · self-hosted Monero wallet · Monero wallet for Windows · XMR wallet UI · non-custodial Monero wallet · Monero privacy wallet · React Monero wallet · local Monero node wallet · monero-wallet-rpc JSON-RPC

*Not affiliated with or endorsed by the Monero Project. Use at your own risk — always keep an offline backup of your recovery phrase.*
