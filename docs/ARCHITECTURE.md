# Architecture and implementation notes

This document explains how the pieces fit together and why several non-obvious
decisions were made. It is aimed at anyone reviewing or extending the project.

## 1. Layering

| Layer | Code | Responsibility |
| --- | --- | --- |
| UI | `frontend/src` | Rendering, forms, polling, confirmation flow. Knows nothing about RPC. |
| HTTP API | `backend/src/server.ts` | Routing, local-only guards, static UI hosting, error shaping. |
| Wallet session | `backend/src/walletManager.ts` | Which wallet is open, balances, history, prepared sends, caching. |
| RPC transport | `backend/src/moneroRpc.ts`, `digestAuth.ts` | JSON-RPC over HTTP with digest auth on one pinned socket. |
| Node probing | `backend/src/daemon.ts` | Daemon status/height with a stale-while-revalidate cache. |

The UI never receives RPC credentials, prepared transaction blobs, seeds or the
wallet password. It only sees normalised JSON.

## 2. Talking to `monero-wallet-rpc`

The wallet RPC protects its endpoint with **HTTP Digest** authentication whose nonce
is bound to the TCP connection that received the challenge. Two consequences were
discovered while building this project and are encoded in the client:

1. **The handshake must happen on one connection.** Node's `fetch`/undici pools
   connections, and with a pool the challenge from connection A is validated on
   connection B — the server answers `401` intermittently even with a correct
   password. The transport is therefore plain `node:http` with
   `new http.Agent({ keepAlive: true, maxSockets: 1 })`.
2. **The digest fields are order-sensitive and must not include `algorithm`.**
   `monero-wallet-rpc` answers with two `WWW-Authenticate` headers (`MD5` and
   `MD5-sess`); only the first may be used, and the response header has to be built as
   `username, realm, nonce, uri, qop, nc, cnonce, response`. Sending
   `algorithm=MD5` or the fields in another order produces `401` even though the hash
   is correct.

`moneroRpc.ts` keeps the parsed challenge, increments the nonce count per request and
re-runs the handshake once when the server reports a stale/nonexistent challenge.
Every call logs only the method name, duration and RPC error code.

## 3b. Optional price quote

`price.ts` keeps the fiat display honest and cheap:

- the feature is off unless `PRICE_SOURCE` (or `price-source.txt`, written by Settings)
  names a source: `kraken` (XMR/USDT), `coingecko` (XMR/USD) or `custom` via `PRICE_API_URL`;
- API responses are parsed into a decimal **string**, and the atomic balance is converted
  with `BigInt` in `formatUsdt()`, so no float ever touches money or rates;
- the quote is cached for 60 seconds and duplicate requests are de-duplicated;
  `/api/wallet/info` uses the non-blocking `snapshot()`, which returns the cached value and
  refreshes in the background, so a slow exchange API can never delay the wallet UI;
- failures leave the value empty: the UI says "price unavailable" instead of showing a
  stale or invented rate.

## 3. Wallet session state

`monero-wallet-rpc` holds exactly one open wallet file per process, and the file is
locked while open. The backend therefore tracks a single session
(`{ name, address, network, openedAt }`) and:

- closes the previous wallet when a different one is opened;
- runs wallet lifecycle operations (create/open/close/reload) inside an *exclusive*
  section, because during those operations the RPC legitimately reports
  "no wallet open". Without that guard a concurrent poll would clear the session and
  bounce the UI back to the wallet selection screen;
- clears the session whenever the RPC answers "no wallet file" outside an exclusive
  section (for example after the RPC process was restarted).

### Recovery phrase export

There is no RPC method to verify a wallet password of an already-open wallet, so the
export path is: `close_wallet` → `open_wallet(password)` → `query_key(mnemonic)`.
A wrong password leaves the wallet closed on purpose; the API returns
`401 BAD_PASSWORD` with the hint that the session was locked, and the UI returns to
the wallet selection screen. The phrase is never cached, logged or persisted.

## 4. Sending transactions

Default mode (`MONERO_SEND_MODE=prepare`):

```
POST /api/wallet/send/prepare   →  transfer { do_not_relay: true, get_tx_key: true }
                                   returns exact fee + signed blob (tx_metadata)
                                   backend stores the blob in memory (10 min TTL)
POST /api/wallet/send           →  relay_tx { hex: <stored blob> }
POST /api/wallet/send/cancel    →  drops the stored blob, nothing is broadcast
```

The `transfer` request body is built **as raw JSON text** so the atomic amount is
transmitted as exact integer digits; `JSON.stringify` would route it through a
JavaScript float. Amounts are validated (`> 0`, ≤ 12 decimals, within sane limits) and
compared against the *unlocked* balance before the transaction is built.

Direct mode exists for wallet RPC builds that do not return `tx_metadata`: the same
confirmation dialog is used, and the single `transfer` call happens only after the
user confirms; the fee in that dialog is explicitly labelled as an estimate.

## 5. Reading data

- `get_transfers` buckets (`in`, `out`, `pending`, `pool`, `failed`) are merged by
  txid, keeping the most final view while preserving pending/failed flags, and
  confirmations are derived from the wallet height when the RPC omits them.
- When there is nothing to return, `monero-wallet-rpc` answers with
  `{"error":{"code":0,"message":""}}`. That code is treated as an empty result, not as
  a failure.
- Read endpoints (`balance`, `address`, `transactions`) use a short-lived cache
  (3–5 s) plus in-flight coalescing. The wallet RPC is effectively single-threaded and
  a public node can make a single call take seconds, so this keeps multiple browser
  tabs and polling intervals from queueing.
- `get_info` does not exist on the wallet RPC in the tested version (`0.18.5.1`), so
  the network height is read from the daemon itself. The daemon probe runs
  `get_info` and `get_height` in parallel, caches the answer and refreshes it in the
  background (`stale-while-revalidate`); the very first request answers with
  `pending: true` after 2.5 s instead of blocking the UI.

## 6. Local-only hardening

Every API request must satisfy two checks:

1. the `Host` header must be a loopback host (`127.0.0.1`, `localhost`, `::1`);
2. when an `Origin` header is present, it must also be loopback.

This blocks two classes of attacks against local wallets: a web page in your browser
trying to drive the local API, and DNS-rebinding tricks that resolve an attacker's
domain to `127.0.0.1`. Responses are sent with `Cache-Control: no-store`,
`X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.

## 7. Frontend

- Small hash router (`#/welcome`, `#/dashboard`, `#/send`, `#/receive`,
  `#/transactions`, `#/settings`) so the built app works without server-side routes.
- `WalletProvider` polls `/api/wallet/info` (5 s) and exposes RPC/node/sync state to
  every page through context; pages poll their own data with `usePolling`.
- If the wallet session disappears (backend restart, wallet closed elsewhere) the
  shell navigates back to the welcome screen automatically.
- Responsive rules: sidebar ≥1024 px, slide-in drawer below; two-column card grids at
  `lg`; the transactions table becomes a card list below `lg`; modals become bottom
  sheets on phones with internally scrolling content.
- Focus styling is applied to the rounded container of an input (`focus-within`), so
  no rectangular native outline ever appears inside the rounded field.

## 8. Error mapping

`errors.ts` turns RPC failures into actionable API errors, for example:

| RPC message | API code | User-facing text |
| --- | --- | --- |
| `Invalid password` | `BAD_PASSWORD` (401) | Incorrect wallet password. |
| `file not found` | `WALLET_NOT_FOUND` (404) | Wallet file not found. |
| `Already exists` | `WALLET_EXISTS` (409) | A wallet with this name already exists. |
| `is opened by another wallet program` | `WALLET_IN_USE` (409) | Already open in another Monero program. |
| `not enough money` | `INSUFFICIENT_FUNDS` (400) | Not enough spendable balance. |
| `no connection to daemon` | `DAEMON_UNAVAILABLE` (503) | Wallet RPC cannot reach the daemon. |
| `Failed to parse tx metadata` | `TX_EXPIRED` (409) | The prepared transaction expired. |
| connection refused / timeout | `RPC_UNAVAILABLE` / `RPC_TIMEOUT` | Wallet RPC is offline / did not answer. |

Absolute file paths are stripped from messages before they reach the UI.

## 9. Diagnostics

`backend/scripts/doctor.mjs` prints the endpoint, whether credentials are configured,
and the result of a few RPC calls. It is the quickest way to distinguish
"wallet RPC is not running" from "credentials are wrong".
