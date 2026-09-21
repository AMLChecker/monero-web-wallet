# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.5] - 2026-09-22

### Changed

- The release package (`monero-web-wallet-<version>.zip`) now bundles the three official Monero
  binaries — `monero-wallet-rpc.exe`, `monerod.exe` and `monero-wallet-cli.exe`, version
  **0.18.5.1 (Fluorine Fermi)**, byte for byte from getmonero.org. Unpacking the archive and
  running `Start.bat` is now the whole installation; the only remaining step on a fresh machine
  is Node.js. Their licence and provenance are documented in
  [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
- Only one archive is published per release: the complete package. The separate web-UI archive
  is gone, so there is nothing to choose between.

## [1.0.4] - 2026-09-22

### Added

- **Confirmations you can see.** The transaction details and every history row now draw the ten
  blocks a payment needs before its outputs become spendable again: a ten-segment meter that fills
  as the chain confirms the transfer, next to `n / 10`, the remaining blocks and a rough estimate
  (`6 blocks, ≈ 12 min`).

### Fixed

- A transfer to your own address is no longer printed as `-0.000000 XMR`. `monero-wallet-rpc`
  reports an amount of 0 for it, because every output stayed inside the wallet; the UI now says so
  outright — "This went to your own address — the funds stayed in this wallet" with the fee that
  actually left ("Only the network fee left your balance: 0.0000444 XMR"), and the history row
  reads **Self-transfer**.

### Changed

- The launchers (`Start.bat`, `start.sh`) install the frontend npm packages only when the UI really
  has to be built. The release package ships a prebuilt `frontend/dist` and a compiled
  `backend/dist` (plus `backend/node_modules` in the full download), so `Start.bat` starts the
  wallet without running npm at all.

## [1.0.3] - 2026-09-22

### Fixed

- **Two-phase sending did not work at all with `monero-wallet-rpc` 0.18**: the transfer signed
  the transaction and returned its hash, key images and fee, but the `tx_metadata` field came
  back empty, so the wallet refused to continue and nothing could be relayed. The cause is in
  the RPC contract itself — `tx_metadata` is only filled when the request sets
  `get_tx_metadata: true` (`COMMAND_RPC_TRANSFER::request` in
  `wallet_rpc_server_commands_defs.h` defaults it to false), which the backend never sent. The
  transfer body now asks for the metadata whenever the transaction is prepared instead of
  relayed, and a regression test pins the flag down. Verified against Monero 0.18.5.1: the
  same request now returns ~12 KB of metadata instead of an empty string.
- The "no transaction metadata" error now says that nothing was broadcast and keeps
  `MONERO_SEND_MODE=direct` as a fallback instead of the only advice.

## [1.0.2] - 2026-09-21

### Changed

- The send form no longer shows any transaction priority control: every transfer goes out at
  **Low**, the cheapest fee the network accepts. The API still accepts `priority` `0`–`3` for
  integrations.

### Added

- A **Support** page — with a button on the Dashboard next to Send and Receive and an entry in
  the sidebar — for a voluntary donation to the developer address: presets or a custom amount,
  QR code and address for donations sent from another wallet, and a confirmation dialog that
  states plainly that no commission is added (only the Monero network fee). The address comes
  from `SUPPORT_ADDRESS` / `support-address.txt` and reaches the UI through `GET /api/support`,
  so a fork shows its own address.
- Support for the project on the Send page: a **0.5%** tip is preselected (`Off` and `1%` are
  one tap away), and the exact support amount plus the destination address are listed in the
  confirmation dialog before signing. The address is configurable through `SUPPORT_ADDRESS`.

### Fixed

- Settings → **About** claimed "Price API: not configured — USD values hidden" no matter what the
  price source actually was. It now reports the truth: the configured source, its pair and the
  current rate, an explicit error when the API cannot be reached, or that the price API is off.

## [1.0.1] - 2026-09-21

### Fixed

- New wallets are created at the current chain height (`restore_height`), so a freshly
  created wallet no longer rescans the chain from block 1 after a wallet RPC restart.
- A comma in an amount sent by an API client is treated as a decimal separator
  (`1,5` means 1.5 XMR) instead of being silently dropped (which turned it into 15 XMR).
- Amounts smaller than one micro-XMR are no longer displayed as `0.000000`.
- The backend closes the wallet file on shutdown, so the next start can open the same
  wallet again (it used to stay locked by `monero-wallet-rpc`).

### Added

- `start.sh` and `stop.sh` for Linux and macOS: the same checks as `Start.bat`, a fresh
  random RPC login, loopback-only wallet RPC, wait-for-ready checks, `--rebuild` and
  `--dev` modes, PID files in `.run/` and a port-based fallback when stopping. The scripts
  need only `bash` and `node`.
- Optional balance quote in **USDT** (Kraken XMR/USDT) or **USD** (CoinGecko), plus a custom
  endpoint. Off by default, cached for a minute, refreshed in the background, converted with
  `BigInt`, and never an invented rate when the API is unreachable. Switchable in Settings,
  stored in `price-source.txt`.
- Backend test suite (53 tests) covering money parsing/formatting, transfer
  normalisation, RPC error mapping and the digest-auth handshake, wired into CI.
- GitHub Pages landing page, `llms.txt` and `llms-full.txt` for AI assistants,
  plus `robots.txt` and `sitemap.xml`.
- Issue templates, pull request template, code of conduct, Dependabot configuration
  and starter issues for Docker packaging, Linux/macOS launchers, interface
  translations and an optional fiat price display.

## [1.0.0] - 2026-09-21

### Added

- First public release: create and open wallets, balances with unlock and sync status,
  transaction history, two-phase sending (exact fee review before broadcasting),
  subaddresses with QR codes, runtime node switching, recovery phrase backup behind a
  password check, and a responsive dark interface driven by the official
  `monero-wallet-rpc`. Windows one-click launcher (`Start.bat` / `Stop.bat`).

[Unreleased]: https://github.com/AMLChecker/monero-web-wallet/compare/v1.0.5...HEAD
[1.0.5]: https://github.com/AMLChecker/monero-web-wallet/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/AMLChecker/monero-web-wallet/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/AMLChecker/monero-web-wallet/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/AMLChecker/monero-web-wallet/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/AMLChecker/monero-web-wallet/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/AMLChecker/monero-web-wallet/releases/tag/v1.0.0
