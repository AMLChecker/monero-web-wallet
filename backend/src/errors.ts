export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class RpcError extends Error {
  constructor(
    public readonly rpcCode: number,
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

/** Removes absolute filesystem paths and internal noise from wallet RPC messages. */
export function sanitizeRpcMessage(message: string): string {
  return message
    .replace(/[A-Za-z]:\\[^\s"']+/g, '<path>')
    .replace(/(?:\/[\w.\-]+){2,}\/?/g, '<path>')
    .replace(/internal error:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const INSUFFICIENT = /not enough money|insufficient|balance too low|not enough unlocked/i;
const DAEMON_DOWN = /no connection to daemon|failed to get height|no connection|cannot connect|connect failed|failed to connect|daemon.*unavailable/i;
const TIMEOUT = /timed out|timeout|etimedout|aborted|abort/i;

/** Turns a wallet RPC failure into a message a wallet user can act on. */
export function mapRpcError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof RpcError) {
    const raw = sanitizeRpcMessage(error.message);
    const lower = raw.toLowerCase();

    if (/invalid password|wrong password/i.test(lower)) {
      return new AppError(401, 'BAD_PASSWORD', 'Incorrect wallet password. Please try again.', 'Monero wallet files cannot be opened without their password.');
    }
    if (/file not found|failed to open wallet.*not found|no such file/i.test(lower)) {
      return new AppError(404, 'WALLET_NOT_FOUND', 'Wallet file not found.', 'Check the wallet name and the wallet directory.');
    }
    if (/already exists/i.test(lower)) {
      return new AppError(409, 'WALLET_EXISTS', 'A wallet with this name already exists.', 'Pick another name or open the existing wallet.');
    }
    if (/opened by another wallet program|already open|is opened/i.test(lower)) {
      return new AppError(
        409,
        'WALLET_IN_USE',
        'This wallet is already open in another Monero program.',
        'Close monero-wallet-cli or another wallet window that uses the same wallet file and try again.',
      );
    }
    if (/no wallet file|wallet.*not open|not opened|no wallet/i.test(lower)) {
      return new AppError(409, 'WALLET_NOT_OPEN', 'No wallet is currently open.', 'Open a wallet first.');
    }
    if (INSUFFICIENT.test(lower)) {
      return new AppError(
        400,
        'INSUFFICIENT_FUNDS',
        'Not enough spendable balance for this transaction.',
        'Funds that arrived recently stay locked for about 20 minutes before they can be spent.',
      );
    }
    if (DAEMON_DOWN.test(lower)) {
      return new AppError(
        503,
        'DAEMON_UNAVAILABLE',
        'Wallet RPC cannot reach the Monero daemon.',
        'Start monerod or point the wallet at a reachable node in Settings, then try again.',
      );
    }
    if (/failed to parse tx metadata|metadata/i.test(lower)) {
      return new AppError(409, 'TX_EXPIRED', 'The prepared transaction is no longer valid.', 'Review the transaction again and confirm.');
    }
    if (/tx id|txid|transaction id/i.test(lower) && /invalid/i.test(lower)) {
      return new AppError(400, 'INVALID_TXID', 'Transaction id is not valid.');
    }
    if (/method not found/i.test(lower)) {
      return new AppError(501, 'RPC_METHOD_UNAVAILABLE', 'This wallet RPC version does not support the requested operation.', 'Update the Monero binaries in the project folder.');
    }
    if (/invalid address/i.test(lower)) {
      return new AppError(400, 'INVALID_ADDRESS', 'The recipient address is not valid.');
    }
    if (error.rpcCode === 0 && raw.length === 0) {
      return new AppError(200, 'EMPTY', '');
    }
    return new AppError(502, 'RPC_ERROR', raw.length > 0 ? raw : 'Wallet RPC returned an unknown error.');
  }

  const message = error instanceof Error ? error.message : String(error);
  if (TIMEOUT.test(message) || /TimeoutError/i.test(message)) {
    return new AppError(
      504,
      'RPC_TIMEOUT',
      'Wallet RPC did not answer in time.',
      'The wallet may still be synchronising. Try again in a moment.',
    );
  }
  if (/ECONNREFUSED|ECONNRESET|socket hang up|fetch failed/i.test(message)) {
    return new AppError(
      503,
      'RPC_UNAVAILABLE',
      'Wallet RPC is offline.',
      'Start the wallet with Start.bat so monero-wallet-rpc is running on 127.0.0.1.',
    );
  }
  return new AppError(500, 'INTERNAL', 'Unexpected backend error.', sanitizeRpcMessage(message));
}

export function isRpcUnavailable(error: AppError): boolean {
  return error.code === 'RPC_UNAVAILABLE' || error.code === 'RPC_TIMEOUT';
}
