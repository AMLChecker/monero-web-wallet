import fs from 'node:fs';
import path from 'node:path';

import { LOGS_DIR } from './config';

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LEVELS)[number];

const activeLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

/**
 * The launcher starts the backend without shell redirection (PowerShell's
 * -RedirectStandardOutput would block the caller), so the backend keeps its own
 * log file next to the wallet RPC log.
 */
const logFilePath = process.env.WALLET_LOG_FILE || path.join(LOGS_DIR, 'backend.log');
let logStream: fs.WriteStream | null = null;

function fileSink(): fs.WriteStream | null {
  if (logStream) return logStream;
  try {
    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    logStream.on('error', () => {
      logStream = null;
    });
    return logStream;
  } catch {
    return null;
  }
}

/**
 * Logging policy for this project:
 *  - wallet passwords, seeds, private keys and prepared transaction blobs are never logged
 *  - wallet RPC calls are logged by method name only, never with their parameters
 */
const SENSITIVE_KEYS = /pass|seed|mnemonic|key|secret|metadata|login|credential|token/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 3 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => redact(entry, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.test(key) ? '[redacted]' : redact(entry, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 300) return `${value.slice(0, 300)}…`;
  return value;
}

function emit(level: LogLevel, message: string, meta?: unknown) {
  if (LEVELS.indexOf(level) < LEVELS.indexOf(activeLevel)) return;
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const tag = level.toUpperCase().padEnd(5, ' ');
  const suffix = meta === undefined ? '' : ` ${JSON.stringify(redact(meta))}`;
  const line = `${stamp} [${tag}] ${message}${suffix}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  try {
    fileSink()?.write(`${line}\n`);
  } catch {
    /* logging must never break the wallet */
  }
}

export function logFilePathUsed(): string {
  return logFilePath;
}

export const logger = {
  debug: (message: string, meta?: unknown) => emit('debug', message, meta),
  info: (message: string, meta?: unknown) => emit('info', message, meta),
  warn: (message: string, meta?: unknown) => emit('warn', message, meta),
  error: (message: string, meta?: unknown) => emit('error', message, meta),
};
