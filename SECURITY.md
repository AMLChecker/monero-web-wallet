# Security model

This application manages real Monero keys and funds, so it is deliberately small,
local-only and explicit about what it does with secrets.

## Architecture and trust boundaries

```
browser (untrusted UI)  →  backend on 127.0.0.1  →  monero-wallet-rpc on 127.0.0.1  →  daemon
```

- The browser **never** talks to `monero-wallet-rpc` and never receives RPC
  credentials. Only the backend knows them.
- `monero-wallet-rpc` is started with `--rpc-bind-ip 127.0.0.1` and HTTP digest
  authentication enabled (`--disable-rpc-login` is never used).
- The RPC login/password are generated **fresh on every launch** and stored in
  `.rpc-credentials` (git-ignored) for backend-only use.
- The backend refuses requests whose `Host` or `Origin` header is not loopback, which
  blocks DNS-rebinding and "malicious website talks to your local wallet" attacks.

## What is never stored or logged

- The wallet password is used only for the duration of an `open_wallet` call, is
  never written to disk, and is never placed in `localStorage`/`sessionStorage`. It
  is asked for again whenever the wallet must be reloaded (for example to export the
  recovery phrase).
- The recovery phrase is shown only while creating a wallet or after an explicit
  export that re-verifies the password, and it is dropped from the UI as soon as you
  leave the screen.
- Logs contain RPC method names, durations and error codes only — never passwords,
  seeds, private keys, prepared transaction blobs or request bodies.
- Prepared (not yet broadcast) transactions are kept in the backend process memory
  only, with a 10-minute expiry, and are deleted when used or cancelled.

## Money handling

- Amounts are parsed, compared and formatted as atomic units (piconero) using
  `BigInt`/strings; JavaScript floating point is never used for money.
- The recipient address is validated through `validate_address` before a transaction
  is built.
- Nothing is broadcast without an explicit confirmation step in the UI. In the
  default two-phase mode the transaction is built with `do_not_relay` first, and only
  relayed after you press **Confirm & Send**.
- `locked` (unspendable) balances are distinguished from unlocked balances in the API
  and in the UI.

## Recommendations

- Run your own `monerod` and point the wallet at `127.0.0.1:18081`; a remote node sees
  your IP address and request pattern.
- Keep the machine patched, use full-disk encryption, and do not expose ports 18082
  or 18083 to your network.
- Use a dedicated "hot" wallet with a small balance for day-to-day spending, and keep
  long-term funds in an offline wallet.
- Verify recipient addresses on a second device when transferring large amounts.
- Store the recovery phrase offline; never type it into a website.

## Reporting a vulnerability

Please open a private security advisory on GitHub (Security → Advisories) or contact
the maintainer directly. Include the version, steps to reproduce and the impact.
Please do not open a public issue for vulnerabilities that could put funds at risk.

## Known limitations

- The project is unaudited; review the code before trusting it with large balances.
- The app trusts the local machine: anyone with access to this account can read the
  wallet files and use the running services.
- The backend has no user authentication because it only listens on loopback — do not
  put it behind a reverse proxy or on a public interface.

## Optional price request

Showing the balance in USDT or USD is **off by default**. When enabled in Settings, the
backend asks the exchange you selected at most once a minute, only to display an
approximate value; it is the only outbound request this project makes on its own, and no
wallet data (addresses, balances, transaction ids) is ever sent with it. Disable it to
keep the wallet fully offline.
