# Wallet directory

`monero-wallet-rpc` is started with `--wallet-dir` pointing at the folder that holds
your wallet files. The launcher resolves that folder in this order:

1. the `MONERO_WALLET_DIR` environment variable, when set;
2. this `wallets` folder, when it contains at least one `*.keys` file;
3. the project root.

Existing wallet files are never moved, copied or deleted by this project. A wallet is
always the pair `<name>` and `<name>.keys` — keep both files together.

Wallet files, keys and this repository's `.rpc-credentials` are git-ignored on
purpose: never commit them.
