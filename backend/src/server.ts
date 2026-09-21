import fs from 'node:fs';
import path from 'node:path';

import express, { type NextFunction, type Request, type Response } from 'express';

import { APP_NAME, APP_VERSION, FRONTEND_DIST, HOST, PORT, RPC_AUTH_ENABLED, RPC_URL } from './config';
import { AppError, mapRpcError } from './errors';
import { logger, logFilePathUsed } from './logger';
import { MoneroRpcClient } from './moneroRpc';
import { WalletManager } from './walletManager';
import { getDaemonStatus, refreshDaemonStatus } from './daemon';

const rpc = new MoneroRpcClient();
const wallet = new WalletManager(rpc);
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '128kb' }));

const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function hostnameFrom(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value.includes('://') ? value : `http://${value}`).hostname;
  } catch {
    return null;
  }
}

/**
 * The wallet API must only ever be reachable from this machine, and only from a
 * page served by this machine. This blocks remote sites and DNS-rebinding tricks
 * that try to drive the local wallet from a browser tab.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const host = hostnameFrom(req.headers.host);
  if (host === null || !LOCAL_HOSTNAMES.has(host)) {
    logger.warn('rejected request with non-local Host header');
    res.status(403).json({ error: { code: 'FORBIDDEN_HOST', message: 'This API only answers on localhost.' } });
    return;
  }
  const origin = hostnameFrom(req.headers.origin as string | undefined);
  if (req.headers.origin && (origin === null || !LOCAL_HOSTNAMES.has(origin))) {
    logger.warn('rejected request from non-local origin');
    res.status(403).json({ error: { code: 'FORBIDDEN_ORIGIN', message: 'Requests from other websites are not allowed.' } });
    return;
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith('/api')) {
    next();
    return;
  }
  const startedAt = Date.now();
  res.setHeader('Cache-Control', 'no-store');
  res.on('finish', () => {
    logger.info(`${req.method} ${req.path} -> ${res.statusCode}`, { durationMs: Date.now() - startedAt });
  });
  next();
});

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;
const wrap = (handler: Handler) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

function body(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

// --- health & wallets ---------------------------------------------------

app.get(
  '/api/health',
  wrap(async (_req, res) => {
    const rpcStatus = await wallet.rpcStatus();
    res.json({
      ok: true,
      service: APP_NAME,
      version: APP_VERSION,
      uptimeSeconds: Math.round(process.uptime()),
      walletRpc: { online: rpcStatus.online, version: rpcStatus.version, authenticated: RPC_AUTH_ENABLED },
      walletOpen: wallet.current?.name ?? null,
    });
  }),
);

app.get(
  '/api/wallets',
  wrap(async (_req, res) => {
    const rpcStatus = await wallet.rpcStatus();
    res.json({
      walletDir: wallet.walletDir(),
      rpc: { online: rpcStatus.online, version: rpcStatus.version, online_authenticated: RPC_AUTH_ENABLED },
      current: wallet.current?.name ?? null,
      wallets: wallet.listWalletFiles(),
    });
  }),
);

// --- wallet session -----------------------------------------------------

app.post(
  '/api/wallet/create',
  wrap(async (req, res) => {
    const { name, password } = body(req);
    const result = await wallet.createWallet(name, password);
    logger.info('wallet created', { name: result.wallet?.name });
    res.status(201).json(result);
  }),
);

app.post(
  '/api/wallet/open',
  wrap(async (req, res) => {
    const { name, password } = body(req);
    const result = await wallet.openWallet(name, password);
    logger.info('wallet opened', { name: result.wallet?.name });
    res.json(result);
  }),
);

const closeHandler = wrap(async (_req, res) => {
  const result = await wallet.closeWallet();
  logger.info('wallet session closed', { closed: result.closed });
  res.json({ ...result, wallet: null });
});
app.post('/api/wallet/close', closeHandler);
app.post('/api/wallet/lock', closeHandler);

app.get(
  '/api/wallet/info',
  wrap(async (_req, res) => {
    res.json(await wallet.cachedInfo());
  }),
);

app.get(
  '/api/wallet/balance',
  wrap(async (_req, res) => {
    res.json(await wallet.balance());
  }),
);

app.get(
  '/api/wallet/address',
  wrap(async (_req, res) => {
    res.json(await wallet.addresses());
  }),
);

app.get(
  '/api/wallet/transactions',
  wrap(async (req, res) => {
    const limit = Number(req.query.limit ?? 200);
    res.json(await wallet.transactions(Number.isFinite(limit) ? limit : 200));
  }),
);

app.post(
  '/api/wallet/subaddress',
  wrap(async (req, res) => {
    const { label } = body(req);
    const result = await wallet.createSubaddress(label);
    logger.info('subaddress created', { index: result.index });
    res.status(201).json(result);
  }),
);

app.post(
  '/api/wallet/phrase',
  wrap(async (req, res) => {
    const { password } = body(req);
    const result = await wallet.revealRecoveryPhrase(password);
    logger.info('recovery phrase exported (seed values are never logged)');
    res.json(result);
  }),
);

app.post(
  '/api/wallet/address/validate',
  wrap(async (req, res) => {
    const { address } = body(req);
    res.json(await wallet.validateAddress(address));
  }),
);

app.post(
  '/api/wallet/refresh',
  wrap(async (_req, res) => {
    res.json(await wallet.refreshWallet());
  }),
);

// --- sending ------------------------------------------------------------

app.post(
  '/api/wallet/send/prepare',
  wrap(async (req, res) => {
    const { address, amount, priority, note } = body(req);
    res.json(await wallet.prepareSend({ address, amount, priority, note }));
  }),
);

app.post(
  '/api/wallet/send',
  wrap(async (req, res) => {
    const { prepareId } = body(req);
    const result = await wallet.confirmSend(prepareId);
    res.json(result);
  }),
);

app.post(
  '/api/wallet/send/cancel',
  wrap(async (req, res) => {
    const { prepareId } = body(req);
    res.json(wallet.cancelSend(prepareId));
  }),
);

// --- node ---------------------------------------------------------------

app.get(
  '/api/node/status',
  wrap(async (_req, res) => {
    const status = await getDaemonStatus();
    let walletHeight: number | null = null;
    if (wallet.current) {
      const info = await wallet.cachedInfo().catch(() => null);
      walletHeight = info?.sync?.walletHeight ?? null;
    }
    res.json({ ...status, walletHeight, walletOpen: wallet.current?.name ?? null });
  }),
);

app.post(
  '/api/node/daemon',
  wrap(async (req, res) => {
    const { address, trusted } = body(req);
    res.json(await wallet.setDaemon(address, Boolean(trusted)));
  }),
);

// --- errors & static frontend -------------------------------------------

app.use('/api', (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API endpoint.' } });
});

const indexHtml = path.join(FRONTEND_DIST, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(express.static(FRONTEND_DIST, { index: false, etag: true, maxAge: '1h' }));
  app.get(/^(?!\/api).*/i, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(indexHtml);
  });
} else {
  app.get('/', (_req, res) => {
    res
      .status(503)
      .type('text/plain')
      .send('The wallet UI has not been built yet. Run "npm run build" in the frontend folder (Start.bat does this automatically).');
  });
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const mapped = error instanceof AppError ? error : mapRpcError(error);
  if (mapped.code === 'EMPTY') {
    res.status(200).json({});
    return;
  }
  const status = mapped.status >= 400 && mapped.status < 600 ? mapped.status : 500;
  if (status >= 500) logger.error('request failed', { code: mapped.code, detail: mapped.hint });
  res.status(status).json({ error: { code: mapped.code, message: mapped.message, hint: mapped.hint ?? null } });
});

function banner(): void {
  const lines = [
    `${APP_NAME} backend ${APP_VERSION}`,
    `  UI + API      http://${HOST}:${PORT}`,
    `  wallet RPC    ${RPC_URL} (auth ${RPC_AUTH_ENABLED ? 'enabled' : 'disabled'})`,
    `  wallet dir    ${wallet.walletDir()}`,
    `  frontend dist ${fs.existsSync(indexHtml) ? 'served' : 'not built yet'}`,
    `  log file      ${logFilePathUsed()}`,
  ];
  lines.forEach((line) => logger.info(line));
}

/** PID file lets Stop.bat (and the launcher) shut these processes down again. */
function writePidFile(): void {
  try {
    const runDir = path.resolve(__dirname, '..', '..', '.run');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'backend.pid'), `${process.pid}\n`, 'utf8');
  } catch {
    /* best effort */
  }
}

const server = app.listen(PORT, HOST, () => {
  writePidFile();
  banner();
  logger.info('[Backend] Ready');
  // Warm the node cache so the first UI poll answers instantly.
  void refreshDaemonStatus();
});

function shutdown(signal: string): void {
  logger.info('shutting down', { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
