# Publishing checklist (GitHub metadata)

The README is optimised for GitHub search and Google indexing (keyword headings, badges,
comparison table, FAQ, alt text on screenshots). The repository **settings** below matter
just as much, because GitHub uses them for search, topic pages and social previews.

## Repository

- **Name:** `monero-web-wallet`
- **Description (About field):**

  ```
  Self-hosted Monero web wallet with a dark responsive UI, powered by the official monero-wallet-rpc — non-custodial, local-only, two-phase transaction sending.
  ```

- **Website:** leave empty, or use your fork's Pages URL.
- **Social preview:** upload `docs/screenshots/dashboard.png` (Settings → General → Social preview).

## Topics

Paste these 20 topics (Settings → Topics):

```
monero
xmr
crypto-wallet
wallet
web-wallet
monero-wallet
monero-wallet-rpc
self-hosted
non-custodial
privacy
blockchain
react
vite
typescript
tailwindcss
express
nodejs
windows
gui
json-rpc
```

## Apply it from the CLI

```bash
gh repo edit AMLChecker/monero-web-wallet \
  --description "Self-hosted Monero web wallet with a dark responsive UI, powered by the official monero-wallet-rpc — non-custodial, local-only, two-phase transaction sending." \
  --add-topic monero --add-topic xmr --add-topic crypto-wallet --add-topic wallet \
  --add-topic web-wallet --add-topic monero-wallet --add-topic monero-wallet-rpc \
  --add-topic self-hosted --add-topic non-custodial --add-topic privacy \
  --add-topic blockchain --add-topic react --add-topic vite --add-topic typescript \
  --add-topic tailwindcss --add-topic express --add-topic nodejs --add-topic windows \
  --add-topic gui --add-topic json-rpc
```

## First release (optional, helps discovery)

```bash
git tag -a v1.0.0 -m "Monero Web Wallet 1.0.0"
git push origin v1.0.0
gh release create v1.0.0 --title "v1.0.0" --notes "First public release: wallet creation and opening, balances and sync status, transaction history, two-phase sending, subaddresses with QR codes, node switching, recovery phrase backup, responsive dark UI, Windows launcher."
```

## Why these keywords

GitHub search ranks repository *name*, *description*, *topics* and README headings. The
README therefore leads with "Monero Web Wallet", repeats the natural phrases
("monero-wallet-rpc", "self-hosted Monero wallet", "non-custodial", "Monero wallet for
Windows") in headings and body text, and answers the questions people actually type into
search engines in the FAQ section.
