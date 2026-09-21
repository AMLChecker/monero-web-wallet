import http from 'node:http';
import https from 'node:https';

import { logger } from './logger';
import { RpcError } from './errors';
import { RPC_LOGIN, RPC_URL } from './config';
import { buildAuthorization, DigestChallenge, parseDigestChallenge, randomCnonce } from './digestAuth';

export type RpcLogin = { user: string; pass: string } | null;

type CallOptions = { timeoutMs?: number };

const DEFAULT_TIMEOUT_MS = 25_000;
const HEAVY_TIMEOUT_MS = 180_000;

type RawResponse = { status: number; rawHeaders: string[]; text: string };

/**
 * monero-wallet-rpc (epee) ties the digest nonce to the TCP connection it issued
 * it on, so the handshake must run over one pinned keep-alive socket. Node's
 * fetch/undici pools connections and produced intermittent 401s, therefore the
 * transport is plain node:http with a single-socket agent.
 */
function firstHeader(rawHeaders: string[], name: string): string | null {
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index].toLowerCase() === name) return rawHeaders[index + 1];
  }
  return null;
}

/**
 * Thin JSON-RPC client for the official monero-wallet-rpc binary.
 * Every wallet operation in this project goes through this client; the browser
 * never talks to the RPC port and the RPC credentials never leave the backend.
 */
export type TransferRequest = {
  address: string;
  amountAtomic: string;
  priority: number;
  accountIndex: number;
  doNotRelay: boolean;
  note?: string;
  /** Optional developer support: a second destination in the same transaction. */
  supportAddress?: string;
  supportAtomic?: string;
};

/**
 * Builds the `transfer` JSON-RPC body.
 *
 * `get_tx_metadata` is what makes a two-phase send possible at all: monero-wallet-rpc
 * only fills the `tx_metadata` field of its response when the request asks for it
 * (`COMMAND_RPC_TRANSFER::request` in wallet_rpc_server_commands_defs.h has
 * `get_tx_metadata` defaulting to false). Without it the wallet still signs the
 * transaction - hash, key images and fee all come back - and silently drops the
 * metadata, so `relay_tx` has nothing to relay later.
 */
export function buildTransferBody(params: TransferRequest): string {
  if (!/^\d+$/.test(params.amountAtomic)) {
    throw new RpcError(-1, 'Internal error: amount must be an integer in atomic units');
  }
  if (params.supportAtomic !== undefined && !/^\d+$/.test(params.supportAtomic)) {
    throw new RpcError(-1, 'Internal error: support amount must be an integer in atomic units');
  }
  const note = params.note ? `,"note":${JSON.stringify(params.note)}` : '';
  const support =
    params.supportAddress && params.supportAtomic && params.supportAtomic !== '0'
      ? `,{"amount":${params.supportAtomic},"address":${JSON.stringify(params.supportAddress)}}`
      : '';
  return (
    `{"jsonrpc":"2.0","id":"0","method":"transfer","params":{` +
    `"destinations":[{"amount":${params.amountAtomic},"address":${JSON.stringify(params.address)}}${support}],` +
    `"account_index":${params.accountIndex},"priority":${params.priority},` +
    `"get_tx_key":true,"get_tx_metadata":${params.doNotRelay ? 'true' : 'false'},` +
    `"do_not_relay":${params.doNotRelay ? 'true' : 'false'}${note}}}`
  );
}

export class MoneroRpcClient {
  private challenge: DigestChallenge | null = null;
  private nonceCount = 0;
  private readonly agent = new http.Agent({ keepAlive: true, maxSockets: 1, keepAliveMsecs: 10_000 });
  private readonly secureAgent = new https.Agent({ keepAlive: true, maxSockets: 1, keepAliveMsecs: 10_000 });

  constructor(
    private readonly url: string = RPC_URL,
    private readonly login: RpcLogin = RPC_LOGIN,
  ) {}

  get endpoint(): string {
    return this.url;
  }

  get authenticated(): boolean {
    return this.login !== null;
  }

  private get uri(): string {
    try {
      const parsed = new URL(this.url);
      return `${parsed.pathname}${parsed.search}` || '/json_rpc';
    } catch {
      return '/json_rpc';
    }
  }

  private send(body: string, authorization: string | null, timeoutMs: number): Promise<RawResponse> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.url);
      const secure = url.protocol === 'https:';
      const transport = secure ? https : http;

      const request = transport.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || (secure ? 443 : 80),
          path: `${url.pathname}${url.search}`,
          method: 'POST',
          agent: secure ? this.secureAgent : this.agent,
          headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(body),
            ...(authorization ? { authorization } : {}),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () =>
            resolve({
              status: response.statusCode ?? 0,
              rawHeaders: response.rawHeaders,
              text: Buffer.concat(chunks).toString('utf8'),
            }),
          );
          response.on('error', reject);
        },
      );

      request.setTimeout(timeoutMs, () => {
        request.destroy(new Error(`Wallet RPC request timed out after ${timeoutMs} ms`));
      });
      request.on('error', reject);
      request.end(body);
    });
  }

  async call<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
    options: CallOptions = {},
  ): Promise<T> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const body = JSON.stringify({ jsonrpc: '2.0', id: '0', method, params });
    return this.callWithBody<T>(method, body, timeoutMs);
  }

  /**
   * Sends a pre-serialised body. Used for transfer requests so that the atomic
   * amount is transmitted as exact integer digits instead of a JavaScript float.
   */
  async callWithBody<T = Record<string, unknown>>(method: string, body: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    const startedAt = Date.now();

    let response: RawResponse;
    try {
      response = await this.send(body, this.authorizationHeader('POST'), timeoutMs);
      if (response.status === 401 && this.login) {
        // Cached nonce went stale (or this is the first call): redo the handshake once.
        this.challenge = parseDigestChallenge(firstHeader(response.rawHeaders, 'www-authenticate'));
        this.nonceCount = 0;
        if (!this.challenge) {
          throw new RpcError(-401, 'monero-wallet-rpc rejected the configured RPC credentials', 401);
        }
        response = await this.send(body, this.authorizationHeader('POST'), timeoutMs);
      }
    } catch (error) {
      logger.warn('wallet rpc call failed', {
        method,
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    if (response.status === 401) {
      throw new RpcError(-401, 'monero-wallet-rpc requires RPC authentication', 401);
    }

    const text = response.text;
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new RpcError(-1, `Wallet RPC returned a non-JSON response (HTTP ${response.status})`, response.status);
    }

    const error = payload?.error;
    if (error && typeof error === 'object' && (typeof error.code !== 'number' || error.code !== 0 || (error.message ?? '') !== '')) {
      logger.warn('wallet rpc error', {
        method,
        durationMs: Date.now() - startedAt,
        rpcCode: error.code,
      });
      throw new RpcError(Number(error.code ?? -1), String(error.message ?? ''), response.status);
    }
    if (error && typeof error === 'object') {
      // monero-wallet-rpc answers with {"error":{"code":0,"message":""}} when there is simply nothing to return.
      logger.debug('wallet rpc empty result', { method });
      return {} as T;
    }

    logger.debug('wallet rpc ok', { method, durationMs: Date.now() - startedAt });
    return (payload?.result ?? {}) as T;
  }

  private authorizationHeader(method: string): string | null {
    if (!this.login || !this.challenge) return null;
    this.nonceCount += 1;
    return buildAuthorization({
      user: this.login.user,
      pass: this.login.pass,
      method,
      uri: this.uri,
      challenge: this.challenge,
      nonceCount: this.nonceCount,
      cnonce: randomCnonce(),
    });
  }

  // --- wallet lifecycle -------------------------------------------------
  /**
   * `restoreHeight` is the height the wallet starts scanning from. Without it a
   * freshly created wallet keeps restore height 0 and, after the next RPC
   * restart, rescans the whole chain from block 1 — so the caller passes the
   * current daemon height for new wallets.
   */
  createWallet(filename: string, password: string, language = 'English', restoreHeight?: number) {
    const params: Record<string, unknown> = { filename, password, language };
    if (typeof restoreHeight === 'number' && Number.isFinite(restoreHeight) && restoreHeight > 0) {
      params.restore_height = Math.floor(restoreHeight);
    }
    return this.call('create_wallet', params, { timeoutMs: HEAVY_TIMEOUT_MS });
  }

  openWallet(filename: string, password: string) {
    return this.call('open_wallet', { filename, password }, { timeoutMs: HEAVY_TIMEOUT_MS });
  }

  closeWallet() {
    return this.call('close_wallet', {}, { timeoutMs: 60_000 });
  }

  store() {
    return this.call('store', {}, { timeoutMs: 60_000 });
  }

  refresh() {
    return this.call('refresh', {}, { timeoutMs: HEAVY_TIMEOUT_MS });
  }

  // --- read-only data ---------------------------------------------------
  getVersion() {
    return this.call<{ version: number; release: boolean }>('get_version');
  }

  getHeight() {
    return this.call<{ height: number }>('get_height');
  }

  getBalance(accountIndex = 0) {
    return this.call<{
      balance: number;
      unlocked_balance: number;
      blocks_to_unlock?: number;
      time_to_unlock?: number;
      multisig_import_needed?: boolean;
    }>('get_balance', { account_index: accountIndex });
  }

  getAddress(accountIndex = 0) {
    return this.call<{
      address: string;
      addresses?: Array<{ address: string; address_index: number; label: string; used: boolean }>;
    }>('get_address', { account_index: accountIndex });
  }

  getAccounts() {
    return this.call<{
      total_balance: number;
      total_unlocked_balance: number;
      subaddress_accounts: Array<{
        account_index: number;
        base_address: string;
        balance: number;
        unlocked_balance: number;
        label: string;
        tag?: string;
      }>;
    }>('get_accounts');
  }

  getTransfers(accountIndex = 0) {
    return this.call<{
      in?: any[];
      out?: any[];
      pending?: any[];
      failed?: any[];
      pool?: any[];
    }>('get_transfers', {
      in: true,
      out: true,
      pending: true,
      failed: true,
      pool: true,
      account_index: accountIndex,
    });
  }

  createAddress(accountIndex: number, label: string) {
    return this.call<{ address: string; address_index: number }>('create_address', {
      account_index: accountIndex,
      label,
    });
  }

  validateAddress(address: string) {
    return this.call<{
      valid: boolean;
      integrated: boolean;
      subaddress: boolean;
      nettype: string;
      openalias_address?: string;
    }>('validate_address', { address, any_net_type: false, allow_openalias: false });
  }

  queryKey(keyType: 'mnemonic' | 'spend_key' | 'view_key') {
    return this.call<{ key: string }>('query_key', { key_type: keyType }, { timeoutMs: 60_000 });
  }

  setDaemon(address: string, trusted = false) {
    return this.call('set_daemon', { address, trusted }, { timeoutMs: 30_000 });
  }

  // --- spending ---------------------------------------------------------
  transfer(params: TransferRequest) {
    const body = buildTransferBody(params);
    return this.callWithBody<{
      amount: number;
      fee: number;
      tx_hash: string;
      tx_key?: string;
      tx_metadata?: string;
      tx_blob?: string;
    }>('transfer', body, HEAVY_TIMEOUT_MS);
  }

  relayTx(txMetadata: string) {
    return this.call<{ tx_hash: string }>('relay_tx', { hex: txMetadata }, { timeoutMs: HEAVY_TIMEOUT_MS });
  }

  estimateTxSizeAndWeight(nInputs: number, nOutputs: number) {
    return this.call<{ size: number; weight: number }>(
      'estimate_tx_size_and_weight',
      { rct: true, n_inputs: nInputs, n_outputs: nOutputs },
      { timeoutMs: 15_000 },
    );
  }
}
