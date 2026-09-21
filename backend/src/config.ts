import fs from 'node:fs';
import path from 'node:path';

/** backend/dist/config.js -> project root */
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export const APP_VERSION = '1.0.5';
export const APP_NAME = 'Monero Web Wallet';

export const HOST = process.env.HOST || '127.0.0.1';
export const PORT = Number(process.env.PORT || 18082);

function envString(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function listWalletNames(directory: string): string[] {
  try {
    return fs
      .readdirSync(directory)
      .filter((file) => file.endsWith('.keys'))
      .map((file) => file.slice(0, -'.keys'.length))
      .filter((name) => /^[A-Za-z0-9._-]+$/.test(name))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/**
 * Wallet directory used by monero-wallet-rpc (--wallet-dir).
 * Priority: MONERO_WALLET_DIR env -> ./wallets (when it already contains wallets) -> project root.
 * Existing wallet files are never moved or copied.
 */
export const WALLET_DIR = (() => {
  const fromEnv = envString('MONERO_WALLET_DIR');
  if (fromEnv) return path.resolve(PROJECT_ROOT, fromEnv);
  const subdir = path.join(PROJECT_ROOT, 'wallets');
  if (fs.existsSync(subdir) && listWalletNames(subdir).length > 0) return subdir;
  return PROJECT_ROOT;
})();

function readRpcLogin(): { user: string; pass: string } | null {
  const fromEnv = envString('MONERO_RPC_LOGIN');
  const source = fromEnv ?? (() => {
    try {
      return fs.readFileSync(path.join(PROJECT_ROOT, '.rpc-credentials'), 'utf8').trim();
    } catch {
      return undefined;
    }
  })();

  if (!source) return null;
  const separator = source.indexOf(':');
  if (separator <= 0) return null;
  return { user: source.slice(0, separator), pass: source.slice(separator + 1) };
}

function normalizeRpcUrl(value: string | undefined): string {
  if (!value) return 'http://127.0.0.1:18083/json_rpc';
  const withScheme = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  return /\/json_rpc$/i.test(withScheme) ? withScheme : `${withScheme.replace(/\/$/, '')}/json_rpc`;
}

export const RPC_URL = normalizeRpcUrl(envString('MONERO_RPC_URL'));
export const RPC_LOGIN = readRpcLogin();
export const RPC_AUTH_ENABLED = RPC_LOGIN !== null;

const NODE_ADDRESS_FILE = path.join(PROJECT_ROOT, 'node-address.txt');

function readNodeAddressFile(): string | undefined {
  try {
    const raw = fs.readFileSync(NODE_ADDRESS_FILE, 'utf8').split('\n')[0]?.trim();
    return raw && raw.length > 0 ? raw : undefined;
  } catch {
    return undefined;
  }
}

const initialDaemonAddress = envString('MONERO_DAEMON_ADDRESS') ?? readNodeAddressFile() ?? '127.0.0.1:18081';

let daemonAddress = initialDaemonAddress;

export function getDaemonAddress(): string {
  return daemonAddress;
}

/** Daemon endpoint as an http(s) base url. */
export function getDaemonUrl(): string {
  return /^https?:\/\//i.test(daemonAddress) ? daemonAddress.replace(/\/$/, '') : `http://${daemonAddress.replace(/\/$/, '')}`;
}

export function setDaemonAddress(address: string): void {
  daemonAddress = address;
  try {
    fs.writeFileSync(NODE_ADDRESS_FILE, `${address}\n`, 'utf8');
  } catch (error) {
    // Persisting is best effort: the runtime value stays in effect for this session.
    console.warn('Could not persist node-address.txt');
  }
}

export const DAEMON_DEFAULTS = {
  local: '127.0.0.1:18081',
  initial: initialDaemonAddress,
};

/** Two-phase sending: prepare (build, do not relay) then relay after explicit user confirmation. */
export const SEND_MODE: 'prepare' | 'direct' = envString('MONERO_SEND_MODE') === 'direct' ? 'direct' : 'prepare';

export const FRONTEND_DIST = path.join(PROJECT_ROOT, 'frontend', 'dist');
export const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');

// --- optional price source (USDT / USD) -------------------------------------
export const PRICE_SOURCE_FILE = path.join(PROJECT_ROOT, 'price-source.txt');

function readPriceSourceFile(): string | undefined {
  try {
    const raw = fs.readFileSync(PRICE_SOURCE_FILE, 'utf8').split('\n')[0]?.trim().toLowerCase();
    return raw && raw.length > 0 ? raw : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Price display is off unless the user asks for it: enabling it means one
 * outbound request to a public exchange API, which the project does not do by
 * default. Priority: PRICE_SOURCE env -> price-source.txt -> "none".
 */
export const PRICE_SOURCE = envString('PRICE_SOURCE')?.toLowerCase() ?? readPriceSourceFile() ?? 'none';

/** Endpoint used by the "custom" price source. Must return JSON with a numeric `price`. */
export const PRICE_API_URL = envString('PRICE_API_URL') ?? '';

export function persistPriceSource(source: string): void {
  try {
    fs.writeFileSync(PRICE_SOURCE_FILE, `${source}\n`, 'utf8');
  } catch {
    console.warn('Could not persist price-source.txt');
  }
}

// --- optional developer support (opt-in per transfer) ------------------------
export const SUPPORT_ADDRESS_FILE = path.join(PROJECT_ROOT, 'support-address.txt');

/**
 * Address that receives the optional support amount. It is shown in the send
 * confirmation dialog before anything is signed, and the feature is off unless the
 * sender turns it on for that transfer.
 */
const DEFAULT_SUPPORT_ADDRESS = '4ApMgwswd6rUeSu3K9bVoyV5hmjcVLuDUePgk4r8bqh85oQYjF3LVTnAiMfp4ukrAL4umhrV6DfaRP5nXbdLZ3CbMTzmico';

export function getSupportAddress(): string {
  const fromEnv = envString('SUPPORT_ADDRESS');
  if (fromEnv) return fromEnv;
  try {
    const raw = fs.readFileSync(SUPPORT_ADDRESS_FILE, 'utf8').split('\n')[0]?.trim();
    if (raw && raw.length > 0) return raw;
  } catch {
    /* no override file */
  }
  return DEFAULT_SUPPORT_ADDRESS;
}
