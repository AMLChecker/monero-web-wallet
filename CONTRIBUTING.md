# Contributing

Thanks for taking the time to improve Monero Web Wallet.

## Development setup

```bash
git clone <your-fork> && cd MoneroWebWallet
cd backend  && npm install && npm run build
cd ../frontend && npm install && npm run build
```

To run the app against a real wallet RPC instance, either use `Start.bat` (Windows) or
start the two processes manually:

```bash
# terminal 1 – official Monero binary
monero-wallet-rpc --wallet-dir . --rpc-bind-ip 127.0.0.1 --rpc-bind-port 18083 \
  --rpc-login user:pass --daemon-address 127.0.0.1:18081 --non-interactive

# terminal 2 – backend
cd backend && MONERO_RPC_LOGIN=user:pass node dist/server.js

# terminal 3 – frontend dev server (proxies /api to the backend)
cd frontend && npm run dev
```

`node backend/scripts/doctor.mjs` is a quick check of the credentials and handshake.

## Before opening a pull request

- `npm run build` must pass in **both** `backend` and `frontend` (the Windows launcher
  relies on clean TypeScript builds).
- `npm --prefix backend test` must pass — the suite covers money parsing and formatting,
  transfer normalisation, RPC error mapping and the digest-auth handshake. Add a test
  when you touch any of those.
- Keep the UI free of mock data: every button must perform a real wallet RPC call.
- Never log or transmit wallet passwords, seeds, private keys or prepared transaction
  blobs, and never store the wallet password in the browser.
- Money must stay in atomic units (`BigInt`/strings) — no floats, anywhere.
- Match the existing code style: TypeScript strict mode, functional React components,
  Tailwind utility classes, Lucide icons, small focused modules.
- Describe user-visible changes in the PR and include screenshots for UI work.

## Commit messages

Short imperative subject lines (`fix: keep the digest nonce on one socket`) are
preferred; add a body when the reasoning is not obvious.

## Branch protection and dependency updates

`main` is protected: force pushes and branch deletion are blocked, and the `build`
status check (backend build → backend tests → frontend build → dependency audits) must
pass before a pull request can be merged. Maintainers can still push directly;
everyone else contributes through a fork and a pull request, which is the normal
GitHub flow.

Dependabot keeps dependencies fresh conservatively:

- **minor and patch** updates arrive grouped into one pull request per package, weekly;
- **GitHub Actions** updates arrive grouped, monthly;
- **major** version bumps are intentionally not automated — do them on purpose, in
  their own pull request, with the test suite green (a tailwind or vite major has real
  chances of breaking the build, which CI will show immediately).

## License

By contributing you agree that your work is released under the MIT license of this
repository.
