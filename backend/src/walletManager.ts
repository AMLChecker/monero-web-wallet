import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  APP_VERSION,
  SEND_MODE,
  WALLET_DIR,
  getDaemonAddress,
  getSupportAddress,
  listWalletNames,
  setDaemonAddress,
} from './config';
import { MoneroRpcClient } from './moneroRpc';
import { AppError, mapRpcError } from './errors';
import { atomicToBigInt, clampSupportPercent, computeSupportAmount, parseXmrToAtomic } from './amounts';
import { getDaemonStatus, invalidateDaemonStatus, type DaemonStatus } from './daemon';
import { formatUsdt, priceService } from './price';
import { logger } from './logger';

export type WalletSession = {
  name: string;
  address: string;
  network: string;
  openedAt: number;
};

type PreparedSend = {
  id: string;
  createdAt: number;
  mode: 'prepare' | 'direct';
  address: string;
  amountAtomic: string;
  feeAtomic: string | null;
  priority: number;
  note?: string;
  txMetadata?: string;
  /** Optional developer support included in the same transaction. */
  support: {
    enabled: boolean;
    percent: number;
    address: string | null;
    amountAtomic: string;
  };
};

export type TxRecord = {
  txid: string;
  direction: 'received' | 'sent';
  status: 'received' | 'sent' | 'pending' | 'failed';
  amountAtomic: string;
  feeAtomic: string | null;
  timestamp: number;
  height: number | null;
  confirmations: number | null;
  address: string | null;
  paymentId: string | null;
  note: string | null;
  unlockTime: number | null;
  locked: boolean;
  subaddressIndex: number | null;
  pending: boolean;
  failed: boolean;
};

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MIN_PASSWORD_LENGTH = 8;
const PREPARED_SEND_TTL_MS = 10 * 60 * 1000;
const INFO_CACHE_MS = 3_000;
const HEIGHT_CACHE_MS = 2_000;

function toAtomicString(value: unknown): string {
  return atomicToBigInt(value ?? 0).toString();
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export class WalletManager {
  private session: WalletSession | null = null;
  private prepared = new Map<string, PreparedSend>();
  private infoCache: { at: number; value: any } | null = null;
  private rpcStatusCache: { at: number; value: { online: boolean; version: string | null } } | null = null;
  /** Short-lived result cache plus in-flight de-duplication for read-only calls. */
  private readCache = new Map<string, { at: number; value: unknown }>();
  private readInFlight = new Map<string, Promise<unknown>>();
  /** Non-zero while the wallet file is being opened, closed or reloaded. */
  private exclusiveDepth = 0;

  constructor(private readonly rpc: MoneroRpcClient) {}

  get current(): WalletSession | null {
    return this.session;
  }

  private get reconfiguring(): boolean {
    return this.exclusiveDepth > 0;
  }

  /**
   * Wallet lifecycle operations close and reopen the wallet file. While that
   * happens the wallet RPC legitimately reports "no wallet open", so concurrent
   * pollers must not be allowed to treat that as a lost session.
   */
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    this.exclusiveDepth += 1;
    try {
      return await operation();
    } finally {
      this.exclusiveDepth -= 1;
      this.invalidate();
    }
  }

  invalidate(): void {
    this.infoCache = null;
    this.readCache.clear();
  }

  /**
   * monero-wallet-rpc processes one request at a time on the connection this
   * backend pins, and a slow node can make a single call take seconds. Caching
   * short-lived reads and coalescing concurrent ones keeps several open tabs
   * (and the dashboard polls) from queueing behind each other.
   */
  private async cachedRead<T>(key: string, ttlMs: number, producer: () => Promise<T>): Promise<T> {
    const hit = this.readCache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;

    const running = this.readInFlight.get(key);
    if (running) return running as Promise<T>;

    const promise = producer()
      .then((value) => {
        this.readCache.set(key, { at: Date.now(), value });
        return value;
      })
      .finally(() => {
        this.readInFlight.delete(key);
      });
    this.readInFlight.set(key, promise);
    return promise;
  }

  private requireSession(): WalletSession {
    if (!this.session) {
      throw new AppError(409, 'WALLET_NOT_OPEN', 'No wallet is currently open.', 'Open a wallet first.');
    }
    return this.session;
  }

  /** Runs a wallet call and drops the cached session when wallet RPC says no wallet is open. */
  private async guarded<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const mapped = mapRpcError(error);
      if (!this.reconfiguring && (mapped.code === 'WALLET_NOT_OPEN' || mapped.code === 'WALLET_NOT_FOUND')) {
        this.session = null;
        this.invalidate();
      }
      if (mapped.code !== 'EMPTY') {
        logger.warn('wallet operation failed', { code: mapped.code, status: mapped.status });
      }
      throw mapped;
    }
  }

  async rpcStatus(force = false): Promise<{ online: boolean; version: string | null }> {
    if (!force && this.rpcStatusCache && Date.now() - this.rpcStatusCache.at < 5_000) {
      return this.rpcStatusCache.value;
    }
    let value = { online: false, version: null as string | null };
    try {
      const version = await this.rpc.getVersion();
      value = { online: true, version: version?.version ? formatVersion(version.version) : null };
    } catch (error) {
      const mapped = mapRpcError(error);
      logger.debug('wallet rpc offline', { code: mapped.code });
    }
    this.rpcStatusCache = { at: Date.now(), value };
    return value;
  }

  listWalletFiles(): Array<{ name: string; sizeBytes: number | null; modifiedAt: number | null }> {
    return listWalletNames(WALLET_DIR).map((name) => {
      const keysFile = path.join(WALLET_DIR, `${name}.keys`);
      try {
        const stat = fs.statSync(keysFile);
        return { name, sizeBytes: stat.size, modifiedAt: stat.mtimeMs };
      } catch {
        return { name, sizeBytes: null, modifiedAt: null };
      }
    });
  }

  walletDir(): string {
    return WALLET_DIR;
  }

  // --- lifecycle --------------------------------------------------------

  private assertName(name: unknown): string {
    if (typeof name !== 'string' || !NAME_PATTERN.test(name.trim())) {
      throw new AppError(
        400,
        'INVALID_WALLET_NAME',
        'Wallet name may only contain letters, digits, dot, dash and underscore (max 64 characters).',
      );
    }
    return name.trim();
  }

  async createWallet(rawName: unknown, rawPassword: unknown) {
    const name = this.assertName(rawName);
    if (typeof rawPassword !== 'string' || rawPassword.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(400, 'WEAK_PASSWORD', `Wallet password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    }
    if (fs.existsSync(path.join(WALLET_DIR, `${name}.keys`))) {
      throw new AppError(409, 'WALLET_EXISTS', 'A wallet with this name already exists.', 'Pick another name or open the existing wallet.');
    }
    if (this.session) {
      await this.closeWallet().catch(() => undefined);
    }

    return this.exclusive(() =>
      this.guarded(async () => {
        // Start a brand-new wallet at the current chain height: its history is
        // empty, so scanning from genesis would waste hours and bandwidth.
        let restoreHeight: number | undefined;
        try {
          const daemon = await getDaemonStatus();
          if (daemon.online && daemon.height) restoreHeight = daemon.height;
        } catch {
          /* no node reachable: fall back to the RPC default */
        }
        await this.rpc.createWallet(name, rawPassword, 'English', restoreHeight);
        logger.info('wallet created', { restoreHeight: restoreHeight ?? 'rpc-default' });
        const addressResult = await this.rpc.getAddress(0);
        const validation = await this.rpc.validateAddress(addressResult.address).catch(() => null);
        this.session = {
          name,
          address: addressResult.address,
          network: validation?.nettype || 'mainnet',
          openedAt: Date.now(),
        };
        this.invalidate();

        let words: string[] = [];
        try {
          const seed = await this.rpc.queryKey('mnemonic');
          words = String(seed.key || '').trim().split(/\s+/).filter(Boolean);
        } catch (error) {
          logger.warn('could not read the mnemonic of the new wallet', { code: mapRpcError(error).code });
        }

        return {
          wallet: publicSession(this.session),
          network: this.session.network,
          recoveryWords: words,
          recoveryPhrase: words.join(' '),
        };
      }),
    );
  }

  async openWallet(rawName: unknown, rawPassword: unknown) {
    const name = this.assertName(rawName);
    if (typeof rawPassword !== 'string' || rawPassword.length === 0) {
      throw new AppError(400, 'INVALID_PASSWORD', 'Enter the wallet password.');
    }
    if (!fs.existsSync(path.join(WALLET_DIR, `${name}.keys`))) {
      throw new AppError(404, 'WALLET_NOT_FOUND', `Wallet "${name}" was not found in the wallet directory.`, `Wallet directory: ${WALLET_DIR}`);
    }
    if (this.session && this.session.name !== name) {
      await this.closeWallet().catch(() => undefined);
    }

    return this.exclusive(() =>
      this.guarded(async () => {
        try {
          await this.rpc.openWallet(name, rawPassword);
        } catch (error) {
          const mapped = mapRpcError(error);
          if (mapped.code === 'WALLET_NOT_FOUND') {
            // The file exists in our wallet dir, so the RPC process must have been
            // started with a different --wallet-dir.
            throw new AppError(
              409,
              'WALLET_DIR_MISMATCH',
              'monero-wallet-rpc cannot see this wallet file.',
              `The RPC process was started with another --wallet-dir than "${WALLET_DIR}". Start the wallet with Start.bat or set MONERO_WALLET_DIR to the RPC directory.`,
            );
          }
          throw mapped;
        }
        const addressResult = await this.rpc.getAddress(0);
        const validation = await this.rpc.validateAddress(addressResult.address).catch(() => null);
        this.session = {
          name,
          address: addressResult.address,
          network: validation?.nettype || 'mainnet',
          openedAt: Date.now(),
        };
        this.invalidate();
        return { wallet: publicSession(this.session), network: this.session.network };
      }),
    );
  }

  async closeWallet() {
    return this.exclusive(async () => {
      this.prepared.clear();
      if (!this.session) return { closed: false };
      try {
        await this.rpc.closeWallet();
      } catch (error) {
        const mapped = mapRpcError(error);
        if (mapped.code !== 'RPC_UNAVAILABLE' && mapped.code !== 'RPC_TIMEOUT' && mapped.code !== 'WALLET_NOT_OPEN') {
          throw mapped;
        }
      } finally {
        this.session = null;
        this.invalidate();
      }
      return { closed: true };
    });
  }

  /**
   * Re-verifies the wallet password by reloading the wallet file, then exports the
   * mnemonic. The password and the seed are never logged and never cached.
   */
  async revealRecoveryPhrase(rawPassword: unknown) {
    const session = this.requireSession();
    if (typeof rawPassword !== 'string' || rawPassword.length === 0) {
      throw new AppError(400, 'INVALID_PASSWORD', 'Enter the wallet password to continue.');
    }
    return this.exclusive(() =>
      this.guarded(async () => {
        await this.rpc.closeWallet().catch(() => undefined);
        try {
          await this.rpc.openWallet(session.name, rawPassword);
        } catch (error) {
          const mapped = mapRpcError(error);
          this.session = null;
          this.invalidate();
          if (mapped.code === 'BAD_PASSWORD') {
            throw new AppError(
              401,
              'BAD_PASSWORD',
              'Incorrect wallet password. The wallet was locked again.',
              'Open the wallet with the correct password.',
            );
          }
          throw mapped;
        }
        const seed = await this.rpc.queryKey('mnemonic');
        const words = String(seed.key || '').trim().split(/\s+/).filter(Boolean);
        this.invalidate();
        return { address: session.address, words, wordCount: words.length };
      }),
    );
  }

  // --- data -------------------------------------------------------------

  async balance(force = false) {
    this.requireSession();
    const produce = () =>
      this.guarded(async () => {
      const balance = await this.rpc.getBalance(0);
      const total = toAtomicString(balance.balance);
      const unlocked = toAtomicString(balance.unlocked_balance);
      return {
        balanceAtomic: total,
        unlockedAtomic: unlocked,
        lockedAtomic: (atomicToBigInt(total) - atomicToBigInt(unlocked)).toString(),
        blocksToUnlock: numeric(balance.blocks_to_unlock),
        timeToUnlock: numeric(balance.time_to_unlock),
        price: await this.priceBlock(total, unlocked),
        updatedAt: Date.now(),
      };
    });
    return force ? produce() : this.cachedRead('balance', 3_000, produce);
  }

  /**
   * Converts the balance into the configured quote. The quote is cached for a
   * minute, so polling never spams the price API, and a failure simply leaves the
   * values empty — the wallet never invents a rate.
   */
  private async priceBlock(balanceAtomic: string | null, unlockedAtomic: string | null) {
    // snapshot() never waits for the network: the UI gets the cached quote and a
    // background refresh fills it in on the next poll.
    const quote = priceService.snapshot();
    return {
      enabled: quote.enabled,
      source: quote.source,
      label: quote.label,
      pair: quote.pair,
      value: quote.value,
      updatedAt: quote.updatedAt,
      error: quote.error,
      totalUsdt: quote.value && balanceAtomic ? formatUsdt(balanceAtomic, quote.value) : null,
      unlockedUsdt: quote.value && unlockedAtomic ? formatUsdt(unlockedAtomic, quote.value) : null,
    };
  }

  async addresses(force = false) {
    const session = this.requireSession();
    const produce = () =>
      this.guarded(async () => {
        const [addressResult, accounts] = await Promise.all([this.rpc.getAddress(0), this.rpc.getAccounts()]);
        const subaddresses = (addressResult.addresses ?? []).map((entry) => ({
          index: entry.address_index,
          address: entry.address,
          label: entry.label || (entry.address_index === 0 ? 'Primary address' : `Subaddress #${entry.address_index}`),
          used: Boolean(entry.used),
        }));
        return {
          address: addressResult.address || session.address,
          subaddresses,
          accounts: (accounts.subaddress_accounts ?? []).map((entry) => ({
            accountIndex: entry.account_index,
            label: entry.label || `Account ${entry.account_index}`,
            address: entry.base_address,
            balanceAtomic: toAtomicString(entry.balance),
            unlockedAtomic: toAtomicString(entry.unlocked_balance),
          })),
          totalBalanceAtomic: toAtomicString(accounts.total_balance),
          totalUnlockedAtomic: toAtomicString(accounts.total_unlocked_balance),
        };
      });
    return force ? produce() : this.cachedRead('addresses', 5_000, produce);
  }

  async createSubaddress(rawLabel: unknown) {
    this.requireSession();
    const label = typeof rawLabel === 'string' ? rawLabel.trim().slice(0, 64) : '';
    return this.guarded(async () => {
      const created = await this.rpc.createAddress(0, label);
      this.readCache.clear();
      const list = await this.addresses(true);
      return {
        address: created.address,
        index: created.address_index,
        subaddresses: list.subaddresses,
      };
    });
  }

  async validateAddress(rawAddress: unknown) {
    if (typeof rawAddress !== 'string' || rawAddress.trim().length < 90) {
      return { valid: false, integrated: false, subaddress: false, nettype: '', openaliasAddress: '' };
    }
    try {
      const result = await this.rpc.validateAddress(rawAddress.trim());
      return {
        valid: Boolean(result.valid),
        integrated: Boolean(result.integrated),
        subaddress: Boolean(result.subaddress),
        nettype: result.nettype || '',
        openaliasAddress: result.openalias_address || '',
      };
    } catch (error) {
      throw mapRpcError(error);
    }
  }

  async transactions(limit = 200, force = false) {
    this.requireSession();
    const produce = () =>
      this.guarded(async () => {
      const [raw, heightResult] = await Promise.all([this.rpc.getTransfers(0), this.rpc.getHeight().catch(() => null)]);
      const walletHeight = heightResult?.height ?? null;
      const records = normalizeTransfers(raw as Record<string, any[] | undefined>, walletHeight);
      return {
        transactions: records.slice(0, Math.max(1, Math.min(1_000, limit))),
        total: records.length,
        walletHeight,
        fetchedAt: Date.now(),
      };
    });
    return force ? produce() : this.cachedRead(`transactions:${limit}`, 5_000, produce);
  }

  async info() {
    if (this.reconfiguring && this.infoCache) return this.infoCache.value;

    const rpc = await this.rpcStatus();
    const daemon: DaemonStatus | null = await getDaemonStatus().catch(() => null);

    let walletHeight: number | null = null;
    let balanceAtomic: string | null = null;
    let unlockedAtomic: string | null = null;

    if (this.session && rpc.online) {
      try {
        const height = await this.rpc.getHeight();
        walletHeight = numeric(height?.height);
      } catch (error) {
        const mapped = mapRpcError(error);
        if (mapped.code === 'WALLET_NOT_OPEN') this.session = null;
      }
      if (this.session) {
        try {
          const balance = await this.balance();
          balanceAtomic = balance.balanceAtomic;
          unlockedAtomic = balance.unlockedAtomic;
        } catch {
          /* balance stays null, the UI shows a sync hint */
        }
      }
    }

    const daemonHeight = daemon?.height ?? null;
    const progress =
      walletHeight !== null && daemonHeight !== null && daemonHeight > 0
        ? Math.min(100, Math.max(0, (walletHeight / daemonHeight) * 100))
        : null;

    const quote = await priceService.quote();
    const price = {
      enabled: quote.enabled,
      source: quote.source,
      label: quote.label,
      pair: quote.pair,
      value: quote.value,
      updatedAt: quote.updatedAt,
      error: quote.error,
      totalUsdt: quote.value && balanceAtomic ? formatUsdt(balanceAtomic, quote.value) : null,
      unlockedUsdt: quote.value && unlockedAtomic ? formatUsdt(unlockedAtomic, quote.value) : null,
    };

    return {
      app: { name: 'Monero Web Wallet', version: APP_VERSION, walletDir: WALLET_DIR, sendMode: SEND_MODE },
      rpc: { online: rpc.online, version: rpc.version },
      wallet: publicSession(this.session),
      daemon: daemon
        ? {
            address: daemon.address,
            online: daemon.online,
            pending: daemon.pending === true,
            height: daemon.height,
            targetHeight: daemon.targetHeight,
            synchronized: daemon.synchronized,
            status: daemon.status,
            version: daemon.version,
            latencyMs: daemon.latencyMs,
            error: daemon.error,
          }
        : {
            address: getDaemonAddress(),
            online: false,
            pending: false,
            height: null,
            targetHeight: null,
            synchronized: false,
            status: null,
            version: null,
            latencyMs: null,
            error: 'Daemon status is unavailable.',
          },
      sync: {
        walletHeight,
        daemonHeight,
        progressPercent: progress,
        synchronized: Boolean(walletHeight !== null && daemonHeight !== null && walletHeight >= daemonHeight - 1),
      },
      balance: { balanceAtomic, unlockedAtomic, fetched: balanceAtomic !== null },
      price,
      priceSources: priceService.availableSources(),
      fetchedAt: Date.now(),
    };
  }

  /** Cached variant of info() for the frequently polled /api/wallet/info endpoint. */
  async cachedInfo() {
    if (this.reconfiguring && this.infoCache) return this.infoCache.value;
    if (this.infoCache && Date.now() - this.infoCache.at < INFO_CACHE_MS) return this.infoCache.value;
    const value = await this.info();
    this.infoCache = { at: Date.now(), value };
    return value;
  }

  async refreshWallet() {
    this.requireSession();
    return this.guarded(async () => {
      await this.rpc.refresh();
      this.invalidate();
      const height = await this.rpc.getHeight().catch(() => null);
      return { walletHeight: numeric(height?.height), refreshedAt: Date.now() };
    });
  }

  async setDaemon(rawAddress: unknown, trusted = false) {
    if (typeof rawAddress !== 'string' || rawAddress.trim().length === 0) {
      throw new AppError(400, 'INVALID_DAEMON', 'Enter a daemon address, for example 127.0.0.1:18081.');
    }
    const address = rawAddress.trim().replace(/\/+$/, '').replace(/^json_rpc/i, '');
    const candidate = address.replace(/^https?:\/\//i, '');
    if (!/^[A-Za-z0-9.\-_]+(:\d{1,5})?$/.test(candidate)) {
      throw new AppError(400, 'INVALID_DAEMON', 'Daemon address must look like host:port, for example node.example.org:18089.');
    }

    try {
      await this.rpc.setDaemon(address, trusted);
    } catch (error) {
      const mapped = mapRpcError(error);
      if (mapped.code !== 'RPC_METHOD_UNAVAILABLE') throw mapped;
      logger.warn('set_daemon is not supported by this wallet RPC build');
      throw new AppError(
        501,
        'RPC_METHOD_UNAVAILABLE',
        'This wallet RPC build cannot change the daemon at runtime.',
        'Set MONERO_DAEMON_ADDRESS in Start.bat (or edit node-address.txt) and restart the wallet.',
      );
    }

    setDaemonAddress(address);
    invalidateDaemonStatus();
    this.invalidate();
    if (this.session) {
      // Refresh in the background: a full rescan can take a while and must not block the request.
      this.rpc.refresh().catch((error) => logger.debug('background refresh after set_daemon failed', { error: String(error) }));
    }
    const status = await getDaemonStatus();
    return {
      daemonAddress: address,
      online: status.online,
      height: status.height,
      error: status.error,
      note: status.online
        ? 'Daemon updated. The wallet will resynchronise in the background.'
        : 'Address saved, but the daemon did not answer yet.',
    };
  }

  // --- sending ----------------------------------------------------------

  private prunePrepared() {
    const now = Date.now();
    for (const [id, entry] of this.prepared) {
      if (now - entry.createdAt > PREPARED_SEND_TTL_MS) this.prepared.delete(id);
    }
  }

  private async estimatedFeeAtomic(priority: number): Promise<string | null> {
    try {
      const status = await getDaemonStatus();
      if (!status.online || !status.url) return null;
      const response = await fetch(`${status.url}/json_rpc`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: '0', method: 'get_fee_estimate' }),
        signal: AbortSignal.timeout(8_000),
      });
      const payload: any = await response.json();
      const fees: number[] = payload?.result?.fees ?? [];
      if (fees.length === 0) return null;
      const perByte = BigInt(Math.round(fees[Math.min(priority, fees.length - 1)]));
      let size = 2_000n;
      try {
        const estimate = await this.rpc.estimateTxSizeAndWeight(1, 2);
        if (estimate?.size) size = BigInt(Math.round(estimate.size));
      } catch {
        /* fall back to a typical one-input transaction size */
      }
      return (perByte * size).toString();
    } catch {
      return null;
    }
  }

  async prepareSend(input: {
    address?: unknown;
    amount?: unknown;
    priority?: unknown;
    note?: unknown;
    supportPercent?: unknown;
  }) {
    this.requireSession();
    this.prunePrepared();

    const address = typeof input.address === 'string' ? input.address.trim() : '';
    if (address.length === 0) throw new AppError(400, 'INVALID_ADDRESS', 'Enter the recipient address.');

    const validation = await this.validateAddress(address);
    if (!validation.valid) {
      throw new AppError(400, 'INVALID_ADDRESS', 'The recipient address is not a valid Monero address.', 'Check for missing or extra characters.');
    }

    const amountAtomic = parseXmrToAtomic(input.amount);
    const priority = Math.min(3, Math.max(0, Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0));
    const note = typeof input.note === 'string' ? input.note.trim().slice(0, 200) : undefined;

    // Optional, opt-in developer support: a second destination in the same
    // transaction. It is always shown in the confirmation dialog before signing.
    const supportPercent = clampSupportPercent(input.supportPercent);
    const supportAddress = supportPercent > 0 ? getSupportAddress() : null;
    const supportAtomic = supportPercent > 0 ? computeSupportAmount(amountAtomic, supportPercent) : 0n;
    const support = {
      enabled: supportAtomic > 0n && supportAddress !== null,
      percent: supportPercent,
      address: supportAtomic > 0n ? supportAddress : null,
      amountAtomic: supportAtomic.toString(),
    };

    const balance = await this.balance();
    const unlocked = atomicToBigInt(balance.unlockedAtomic);
    if (amountAtomic + supportAtomic > unlocked) {
      throw new AppError(
        400,
        'INSUFFICIENT_FUNDS',
        'Not enough spendable balance for this transaction.',
        support.enabled
          ? 'The amount plus the optional developer support exceeds the unlocked balance — turn the support off and try again.'
          : 'Recently received funds stay locked for about 20 minutes before they can be spent.',
      );
    }

    if (SEND_MODE === 'direct') {
      const fee = await this.estimatedFeeAtomic(priority);
      const entry: PreparedSend = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        mode: 'direct',
        address,
        amountAtomic: amountAtomic.toString(),
        feeAtomic: fee,
        priority,
        note,
        support,
      };
      this.prepared.set(entry.id, entry);
      const totalAtomic = amountAtomic + supportAtomic + (fee ? BigInt(fee) : 0n);
      return {
        prepareId: entry.id,
        mode: 'direct' as const,
        address,
        amountAtomic: entry.amountAtomic,
        feeAtomic: fee,
        feeEstimated: true,
        totalAtomic: totalAtomic.toString(),
        support,
        priority,
        expiresAt: entry.createdAt + PREPARED_SEND_TTL_MS,
      };
    }

    const session = this.session!;
    const prepared = await this.guarded(() =>
      this.rpc.transfer({
        address,
        amountAtomic: amountAtomic.toString(),
        priority,
        accountIndex: 0,
        doNotRelay: true,
        note,
        supportAddress: support.enabled ? support.address ?? undefined : undefined,
        supportAtomic: support.enabled ? support.amountAtomic : undefined,
      }),
    );

    if (!prepared.tx_metadata) {
      throw new AppError(
        501,
        'SEND_MODE_UNSUPPORTED',
        'This wallet RPC build did not return transaction metadata for a two-phase send.',
        'Set MONERO_SEND_MODE=direct in Start.bat to sign and broadcast in a single confirmed step.',
      );
    }

    const feeAtomic = toAtomicString(prepared.fee);
    const entry: PreparedSend = {
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      mode: 'prepare',
      address,
      amountAtomic: amountAtomic.toString(),
      feeAtomic,
      priority,
      note,
      support,
      txMetadata: prepared.tx_metadata,
    };
    this.prepared.set(entry.id, entry);
    logger.info('transaction prepared (not relayed)', {
      wallet: session.name,
      priority,
      supportPercent: support.enabled ? support.percent : 0,
    });

    return {
      prepareId: entry.id,
      mode: 'prepare' as const,
      address,
      amountAtomic: entry.amountAtomic,
      feeAtomic,
      feeEstimated: false,
      totalAtomic: (
        atomicToBigInt(entry.amountAtomic) +
        atomicToBigInt(support.amountAtomic) +
        atomicToBigInt(feeAtomic)
      ).toString(),
      support,
      priority,
      expiresAt: entry.createdAt + PREPARED_SEND_TTL_MS,
    };
  }

  async confirmSend(prepareId: unknown) {
    this.requireSession();
    this.prunePrepared();
    if (typeof prepareId !== 'string' || prepareId.length === 0) {
      throw new AppError(400, 'INVALID_REQUEST', 'Missing prepared transaction id.');
    }
    const entry = this.prepared.get(prepareId);
    if (!entry) {
      throw new AppError(409, 'TX_EXPIRED', 'The prepared transaction expired.', 'Review the transaction again and confirm.');
    }

    if (entry.mode === 'prepare' && entry.txMetadata) {
      const result = await this.guarded(() => this.rpc.relayTx(entry.txMetadata!));
      this.prepared.delete(prepareId);
      this.invalidate();
      logger.info('transaction relayed', { priority: entry.priority });
      return {
        txHash: result.tx_hash,
        feeAtomic: entry.feeAtomic,
        amountAtomic: entry.amountAtomic,
        address: entry.address,
        support: entry.support,
        sentAt: Date.now(),
      };
    }

    const result = await this.guarded(() =>
      this.rpc.transfer({
        address: entry.address,
        amountAtomic: entry.amountAtomic,
        priority: entry.priority,
        accountIndex: 0,
        doNotRelay: false,
        note: entry.note,
        supportAddress: entry.support.enabled ? entry.support.address ?? undefined : undefined,
        supportAtomic: entry.support.enabled ? entry.support.amountAtomic : undefined,
      }),
    );
    this.prepared.delete(prepareId);
    this.invalidate();
    logger.info('transaction sent', { priority: entry.priority });
    return {
      txHash: result.tx_hash,
      feeAtomic: toAtomicString(result.fee),
      amountAtomic: toAtomicString(result.amount ?? entry.amountAtomic),
      address: entry.address,
      support: entry.support,
      sentAt: Date.now(),
    };
  }

  cancelSend(prepareId: unknown) {
    if (typeof prepareId === 'string') this.prepared.delete(prepareId);
    return { cancelled: true };
  }
}

function publicSession(session: WalletSession | null) {
  if (!session) return null;
  return {
    open: true,
    name: session.name,
    address: session.address,
    network: session.network,
    openedAt: session.openedAt,
  };
}

export function formatVersion(version: number): string {
  const major = Math.floor(version / 65536);
  const minor = Math.floor((version % 65536) / 256);
  const patch = version % 256;
  return `${major}.${minor}.${patch}`;
}

/**
 * Flattens the get_transfers buckets into one list and derives confirmations,
 * lock state and direction for the UI.
 */
export function normalizeTransfers(buckets: Record<string, any[] | undefined>, walletHeight: number | null): TxRecord[] {
  const entries = new Map<string, TxRecord>();
  const nowSeconds = Math.floor(Date.now() / 1000);

  const consume = (kind: 'in' | 'out' | 'pending' | 'failed' | 'pool') => {
    const list = buckets?.[kind];
    if (!Array.isArray(list)) return;
    for (const item of list) {
      const txid = String(item?.txid ?? '');
      if (txid.length === 0) continue;

      const direction: TxRecord['direction'] = kind === 'in' || kind === 'pool' ? 'received' : 'sent';
      const status: TxRecord['status'] =
        kind === 'failed' ? 'failed' : kind === 'pending' || kind === 'pool' ? 'pending' : kind === 'out' ? 'sent' : 'received';

      const confirmations = numeric(item.confirmations);
      const height = numeric(item.height);
      const unlockTime = numeric(item.unlock_time);
      const timestamp = numeric(item.timestamp) ?? 0;

      const record: TxRecord = {
        txid,
        direction,
        status,
        amountAtomic: toAtomicString(item.amount),
        feeAtomic: kind === 'out' || kind === 'pending' || kind === 'failed' ? toAtomicString(item.fee ?? 0) : null,
        timestamp,
        height,
        confirmations,
        address: typeof item.address === 'string' && item.address.length > 0 ? item.address : null,
        paymentId: typeof item.payment_id === 'string' && item.payment_id.length > 0 ? item.payment_id : null,
        note: typeof item.note === 'string' && item.note.length > 0 ? item.note : null,
        unlockTime,
        locked: false,
        subaddressIndex: numeric(item?.subaddr_index?.minor),
        pending: status === 'pending',
        failed: status === 'failed',
      };

      const effectiveConfirmations = confirmations ?? (height && walletHeight ? Math.max(0, walletHeight - height + 1) : null);
      record.confirmations = effectiveConfirmations;
      const lockedUntil = unlockTime && unlockTime > nowSeconds;
      record.locked = Boolean(lockedUntil) || (effectiveConfirmations !== null && effectiveConfirmations < 10);

      const existing = entries.get(txid);
      if (!existing) {
        entries.set(txid, record);
        continue;
      }
      // Keep the most final view of a transaction, but preserve pending/failed flags.
      const better = (effectiveConfirmations ?? -1) > (existing.confirmations ?? -1);
      const merged: TxRecord = {
        ...(better ? record : existing),
        pending: existing.pending || record.pending,
        failed: existing.failed || record.failed,
        status: existing.failed || record.failed ? 'failed' : existing.pending || record.pending ? 'pending' : (better ? record : existing).status,
        feeAtomic: existing.feeAtomic ?? record.feeAtomic,
        note: existing.note ?? record.note,
        address: existing.address ?? record.address,
      };
      entries.set(txid, merged);
    }
  };

  (['in', 'out', 'pending', 'pool', 'failed'] as const).forEach(consume);

  return Array.from(entries.values()).sort((a, b) => {
    if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
    return (b.height ?? 0) - (a.height ?? 0);
  });
}
