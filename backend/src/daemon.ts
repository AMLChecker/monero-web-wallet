import { getDaemonAddress, getDaemonUrl } from './config';
import { logger } from './logger';

export type DaemonStatus = {
  address: string;
  url: string;
  online: boolean;
  /** true while the very first probe is still running and no answer is cached yet */
  pending?: boolean;
  height: number | null;
  targetHeight: number | null;
  synchronized: boolean;
  status: string | null;
  version: string | null;
  latencyMs: number | null;
  error: string | null;
  checkedAt: number;
};

const CACHE_MS = 3_000;
let cache: { at: number; value: DaemonStatus } | null = null;
let inFlight: Promise<DaemonStatus> | null = null;

async function postJson(url: string, body: unknown, timeoutMs: number): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function tryGetInfo(url: string, timeoutMs: number): Promise<any> {
  const info = await postJson(url, { jsonrpc: '2.0', id: '0', method: 'get_info' }, timeoutMs);
  return info?.result ?? info;
}

async function tryGetHeight(url: string, timeoutMs: number): Promise<any> {
  const response = await fetch(`${url}/get_height`, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * The wallet RPC exposes the wallet's own chain height, so the daemon is asked
 * directly for the network height that the sync progress is measured against.
 * Both probes run in parallel: a slow public node must not double the wait.
 */
async function probeDaemon(): Promise<DaemonStatus> {
  const address = getDaemonAddress();
  const url = getDaemonUrl();
  const base: DaemonStatus = {
    address,
    url,
    online: false,
    height: null,
    targetHeight: null,
    synchronized: false,
    status: null,
    version: null,
    latencyMs: null,
    error: null,
    checkedAt: Date.now(),
  };

  const startedAt = Date.now();
  // The UI never blocks on this probe (it shows "checking…" meanwhile), so a
  // generous timeout is fine even for slow public nodes.
  const [infoResult, heightResult] = await Promise.allSettled([tryGetInfo(url, 8_000), tryGetHeight(url, 8_000)]);

  if (infoResult.status === 'fulfilled') {
    const result = infoResult.value;
    const height = Number(result?.height ?? NaN);
    const targetHeight = Number(result?.target_height ?? NaN);
    if (Number.isFinite(height)) {
      const value: DaemonStatus = {
        ...base,
        online: true,
        height,
        targetHeight: Number.isFinite(targetHeight) ? targetHeight : null,
        synchronized: Boolean(result?.synchronized ?? false),
        status: typeof result?.status === 'string' ? result.status : null,
        version: typeof result?.version === 'string' ? result.version : null,
        latencyMs: Date.now() - startedAt,
      };
      cache = { at: Date.now(), value };
      return value;
    }
  } else {
    logger.debug('daemon get_info probe failed', {
      error: infoResult.reason instanceof Error ? infoResult.reason.message : String(infoResult.reason),
    });
  }

  if (heightResult.status === 'fulfilled') {
    const payload = heightResult.value;
    const height = Number(payload?.height ?? NaN);
    if (Number.isFinite(height)) {
      const value: DaemonStatus = {
        ...base,
        online: true,
        height,
        targetHeight: height,
        synchronized: typeof payload?.status === 'string' ? payload.status === 'OK' : false,
        status: typeof payload?.status === 'string' ? payload.status : null,
        latencyMs: Date.now() - startedAt,
      };
      cache = { at: Date.now(), value };
      return value;
    }
  }

  const reason =
    infoResult.status === 'rejected'
      ? infoResult.reason
      : heightResult.status === 'rejected'
        ? heightResult.reason
        : new Error('unexpected response');
  const message = reason instanceof Error ? reason.message : String(reason);
  const value: DaemonStatus = {
    ...base,
    error: /TimeoutError|timed out|aborted/i.test(message)
      ? 'No answer from the daemon (timeout).'
      : `Cannot reach the daemon (${message}).`,
    latencyMs: Date.now() - startedAt,
  };
  cache = { at: Date.now(), value };
  return value;
}

/**
 * Stale-while-revalidate: a public node can take seconds to answer, and the UI
 * must not wait for it, so a cached answer is returned immediately while the
 * next probe runs in the background.
 */
export function refreshDaemonStatus(): Promise<DaemonStatus> {
  if (inFlight) return inFlight;
  inFlight = probeDaemon().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export async function getDaemonStatus(options: { waitMs?: number } = {}): Promise<DaemonStatus> {
  if (cache) {
    if (Date.now() - cache.at >= CACHE_MS) void refreshDaemonStatus();
    return cache.value;
  }

  const waitMs = options.waitMs ?? 2_500;
  const probe = refreshDaemonStatus();
  const answered = await Promise.race([
    probe,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
  ]);
  if (answered) return answered;

  // Still probing: answer immediately and let the pollers pick up the result.
  return {
    address: getDaemonAddress(),
    url: getDaemonUrl(),
    online: false,
    pending: true,
    height: null,
    targetHeight: null,
    synchronized: false,
    status: null,
    version: null,
    latencyMs: null,
    error: 'Checking the node…',
    checkedAt: Date.now(),
  };
}

export function invalidateDaemonStatus(): void {
  cache = null;
}
