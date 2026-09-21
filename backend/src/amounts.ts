/**
 * Monetary amounts are always handled as atomic units (piconero) inside strings/bigints.
 * 1 XMR = 1_000_000_000_000 atomic units. JavaScript floats are never used for money.
 */

import { AppError } from './errors';

export const ATOMIC_UNITS_PER_XMR = 1_000_000_000_000n;
/** Maximum supply guard: total Monero supply is far below this. */
const MAX_ATOMIC = 10n ** 20n;

/** Converts a user supplied decimal XMR string ("0.25") into atomic units. */
export function parseXmrToAtomic(value: unknown): bigint {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new AppError(400, 'INVALID_AMOUNT', 'Enter a valid amount in XMR.');
    }
    value = value.toString();
  }
  if (typeof value !== 'string') {
    throw new AppError(400, 'INVALID_AMOUNT', 'Enter a valid amount in XMR.');
  }

  const raw = value.trim().replace(/,/g, '').replace(/\s+/g, '');
  if (raw.length === 0) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Enter an amount in XMR.');
  }
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Enter a valid amount in XMR, for example 0.25.');
  }

  const [whole, fraction = ''] = raw.split('.');
  if (fraction.length > 12) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Monero supports at most 12 decimal places.');
  }

  const atomic = BigInt(whole) * ATOMIC_UNITS_PER_XMR + BigInt((fraction + '000000000000').slice(0, 12));
  if (atomic <= 0n) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Amount must be greater than zero.');
  }
  if (atomic > MAX_ATOMIC) {
    throw new AppError(400, 'INVALID_AMOUNT', 'Amount is unreasonably large.');
  }
  return atomic;
}

export function atomicToBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new AppError(500, 'INVALID_RPC_AMOUNT', 'Wallet RPC returned an unusable amount.');
    }
    return BigInt(value);
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    return BigInt(value.trim());
  }
  throw new AppError(500, 'INVALID_RPC_AMOUNT', 'Wallet RPC returned an unusable amount.');
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Formats atomic units as a decimal XMR string.
 * Trailing zeroes are trimmed but at least six decimals are always shown.
 */
export function formatAtomic(value: unknown, options: { grouping?: boolean } = {}): string {
  const atomic = atomicToBigInt(value);
  const negative = atomic < 0n;
  const digits = (negative ? -atomic : atomic).toString().padStart(13, '0');
  const whole = digits.slice(0, -12);
  const fractionRaw = digits.slice(-12);

  let fraction = fractionRaw.replace(/0+$/, '');
  if (fraction.length < 6) {
    fraction = fractionRaw.slice(0, 6);
  }

  const wholeOut = options.grouping ? groupThousands(whole) : whole;
  return `${negative ? '-' : ''}${wholeOut}.${fraction}`;
}

/** Short human readable display for tables: 1.28 XMR */
export function formatAtomicCompact(value: unknown): string {
  const atomic = atomicToBigInt(value);
  const full = formatAtomic(atomic);
  const [whole, fraction = ''] = full.split('.');
  if (whole !== '0') return `${whole}.${fraction.slice(0, 6)}`;
  const significant = fraction.replace(/^0+/, '');
  if (significant.length === 0) return '0.000000';
  return `0.${fraction.slice(0, Math.min(12, Math.max(6, fraction.indexOf(significant) + significant.length)))}`;
}
