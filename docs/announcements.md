# Announcement kit

Ready-to-use texts for telling people about **Monero Web Wallet** (`AMLChecker/monero-web-wallet`).
Everything here is optional — but for a new repository, mentions and links from other places are the
single biggest ranking factor, more than any README tweak.

**Rules of engagement (read first)**

- Always disclose that you are the author ("I built this"), and never pretend to be a happy user.
- Post to one community at a time, answer the replies, and do not cross-post the same text everywhere the
  same day. Most communities (including r/Monero) remove drive-by promotion.
- Never ask anyone to install it with real funds first; the honest framing is "unaudited, test with small
  amounts, keep your seed backed up".
- On Stack Exchange, do not post promotional questions or answers. Only answer real questions, and mention
  the project as one option when it genuinely fits.

## 1. Project links

| What | URL |
| --- | --- |
| Landing page | https://amlchecker.github.io/monero-web-wallet/ |
| Repository | https://github.com/AMLChecker/monero-web-wallet |
| Releases | https://github.com/AMLChecker/monero-web-wallet/releases |
| Issues | https://github.com/AMLChecker/monero-web-wallet/issues |

## 2. Short pitch (one line)

> A self-hosted, non-custodial web wallet for Monero — dark responsive UI on top of the official
> `monero-wallet-rpc`, with a mandatory fee review before anything is broadcast.

## 3. Two-sentence pitch

> Monero Web Wallet is a local web wallet: your browser talks only to a backend on `127.0.0.1`, and every key
> operation is done by the official `monero-wallet-rpc` binary, so your seed never leaves your machine. It
> builds each payment locally first (`do_not_relay`), shows the exact fee, and only relays it after you press
> **Confirm & Send**.

## 4. Reddit — r/Monero

Title:

```
I built an open-source self-hosted web wallet for Monero (monero-wallet-rpc + React UI)
```

Body:

```
Hi r/Monero,

I wrote a local web wallet for Monero because I wanted a modern wallet UI without handing my keys to
anyone and without using a GUI tool that only exists as a desktop app.

How it works:
- the browser talks ONLY to a local Node backend on 127.0.0.1;
- all key operations go through the official monero-wallet-rpc binary, which the launcher starts with
  --rpc-bind-ip 127.0.0.1 and a fresh random RPC login on every launch;
- sending is two-phase: the transaction is built and signed locally with do_not_relay, you see the exact
  network fee, and it is relayed only after you confirm. Cancelling discards it;
- your wallet password is never stored in the browser, localStorage or logs, and the seed is shown only on
  wallet creation or an explicit export that re-verifies the password;
- you can point it at your own monerod or a remote node, and switch nodes later in Settings;
- there is a Support page for voluntary donations (it adds no commission of its own), and the wallet takes
  no cut of any transaction.

Stack: TypeScript (Node/Express backend), React + Vite + Tailwind frontend, Windows one-click Start.bat.
It is MIT-licensed, unaudited, and it does not phone home to anything.

Source + screenshots: https://github.com/AMLChecker/monero-web-wallet
Landing page: https://amlchecker.github.io/monero-web-wallet/

It has only been tested by me so far, so I would genuinely like feedback — especially from people running a
local node: does the sync/height handling look right, and are there wallet workflows you would miss from the
CLI/GUI? Issues and pull requests are welcome. If you want to support the work, there is an XMR address in
the README (completely optional).
```

## 5. Hacker News — Show HN

Title:

```
Show HN: Monero Web Wallet – self-hosted, non-custodial wallet on official monero-wallet-rpc
```

First comment (post it yourself right after submitting):

```
Author here. I wanted a Monero wallet with a modern web UI that keeps the CLI's trust model, so this is a
thin React/Express layer over the official monero-wallet-rpc binary: the browser never sees RPC credentials,
the RPC binds to loopback with a per-launch random login, and amounts are handled as atomic units in BigInt.

Two details that took real work: monero-wallet-rpc uses HTTP digest auth whose nonce is bound to the TCP
connection, so the backend pins a single keep-alive socket and sends the digest fields in the exact order the
server expects; and sending uses a two-phase flow (transfer with do_not_relay, then relay_tx) so the user sees
the exact fee before anything hits the network. Notes on both are in docs/ARCHITECTURE.md.

It is MIT, unaudited, Windows-first launcher but the backend/frontend run anywhere Node runs. Happy to answer
questions about the RPC quirks or the wallet flow.
```

## 6. X / Twitter (280 characters)

```
Monero Web Wallet — self-hosted, non-custodial XMR wallet in your browser.

• only the official monero-wallet-rpc touches your keys
• loopback-only, random RPC login per launch
• you review the exact fee before anything is broadcast

MIT, open source 👇
github.com/AMLChecker/monero-web-wallet
```

## 7. Telegram / Discord / Matrix (Monero community chats)

```
Self-hosted web wallet for Monero, in case it is useful to someone: it drives the official
monero-wallet-rpc from a React UI, keys stay local, two-phase send with an explicit fee review, MIT.
https://github.com/AMLChecker/monero-web-wallet — feedback welcome (I am the author).
```

## 8. Awesome lists (PRs that bring permanent links)

Add an entry, open a pull request, wait for review. Keep the wording short and in the style of the list.

### 8.1 `hundehausen/awesome-monero` → section **### Other Wallets**

Line to add (keep the file's alphabetical-ish order):

```markdown
- [Monero Web Wallet](https://github.com/AMLChecker/monero-web-wallet) - Self-hosted, non-custodial web wallet with a dark responsive UI, powered by the official monero-wallet-rpc (two-phase sending with explicit fee review).
```

### 8.2 `awesome-selfhosted/awesome-selfhosted` → section **### Money, Budgeting & Management**

Their format is `- [Name](homepage) - Description. ([Source Code](repo)) \`License\` \`Language\``:

```markdown
- [Monero Web Wallet](https://amlchecker.github.io/monero-web-wallet/) - Self-hosted web wallet for Monero (XMR) that drives the official monero-wallet-rpc binary, with a review step before any transaction is broadcast. ([Source Code](https://github.com/AMLChecker/monero-web-wallet)) `MIT` `Nodejs`
```

Read their `CONTRIBUTING.md` first: entries must be free software, actively maintained and self-hosted —
this project satisfies all three, but they also reject anything that looks like an abandoned test project,
so make sure the repository has recent commits when you submit.

### 8.3 Other candidate lists

- `yjjnls/awesome-blockchain` — has a Monero/tools area; only add it if a wallet actually fits the section.
- `Mikerah/awesome-privacy-on-blockchains` — privacy tooling; a wallet entry needs a clear privacy angle.
- Search GitHub for `awesome monero`, `awesome privacy`, `awesome selfhosted` and check each list's rules
  before submitting; do not add the project to lists that explicitly exclude wallets or crypto software.

## 9. Stack Exchange (Monero site)

Do **not** create a question or answer just to link the project. Instead:

- watch the `monero-wallet-rpc`, `monero-wallet-gui`, `monero-wallet-cli` and `web-wallet` tags;
- when someone asks how to build a web UI over `monero-wallet-rpc`, how to keep RPC off the public network, or
  how to implement a review-before-send flow, answer the technical question fully and mention the project only
  as a working reference implementation;
- disclose your authorship in the answer ("I maintain a project that does this: …").

## 10. Tracking checklist

- [ ] Landing page shared on X / Twitter
- [ ] Post in r/Monero
- [ ] Show HN submitted
- [ ] Message in one Monero Telegram / Matrix / Discord chat
- [ ] PR to `hundehausen/awesome-monero`
- [ ] PR to `awesome-selfhosted/awesome-selfhosted`
- [ ] Answered at least one relevant question on Monero Stack Exchange with disclosure
- [ ] Release notes for `v1.0.1` linked in every post
