## What does this change do?

<!-- One or two sentences. If it closes an issue, write "Closes #12". -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Documentation or packaging
- [ ] Refactor (no behaviour change)

## Checklist

- [ ] `npm --prefix backend run build` passes
- [ ] `npm --prefix frontend run build` passes
- [ ] `npm --prefix backend test` passes
- [ ] No mock or placeholder data was introduced — every user-facing button still performs a real wallet RPC call
- [ ] No wallet password, recovery phrase, private key, prepared transaction blob or RPC credential is logged, sent to the browser or stored anywhere
- [ ] Amounts are still handled as atomic units (`BigInt` / strings) — no floating point for money
- [ ] Any new wallet RPC method was verified against a real `monero-wallet-rpc` instance (state the version)
- [ ] Documentation updated where behaviour changed (README, `docs/`, `CHANGELOG.md`)
- [ ] Screenshots or a short recording attached for UI changes

## How was it tested?

<!-- Commands you ran, `monero-wallet-rpc` version, node type (local monerod / remote), operating system. -->

## Screenshots (UI changes)
