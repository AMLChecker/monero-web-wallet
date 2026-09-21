# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- The send form no longer shows any transaction priority control: every transfer goes out at
  **Low**, the cheapest fee the network accepts. The API still accepts `priority` `0`–`3` for
  integrations.

### Added

- Support for the project on the Send page: a **0.5%** tip is preselected (`Off` and `1%` are
  one tap away), and the exact support amount plus the destination address are listed in the
  confirmation dialog before signing. The address is configurable through `SUPPORT_ADDRESS`.

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

[Unreleased]: https://github.com/AMLChecker/monero-web-wallet/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/AMLChecker/monero-web-wallet/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/AMLChecker/monero-web-wallet/releases/tag/v1.0.0
