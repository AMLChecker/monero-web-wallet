/** XMR amounts are handled as atomic-unit bigints in the browser too: never as floats. */

const ATOMIC_PER_XMR = 1_000_000_000_000n;

export function atomicToBigInt(value: string | number | bigint | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  const trimmed = value.trim();
  return /^-?\d+$/.test(trimmed) ? BigInt(trimmed) : 0n;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatXmr(value: string | number | bigint | null | undefined, options: { grouping?: boolean } = {}): string {
  const atomic = atomicToBigInt(value);
  const negative = atomic < 0n;
  const digits = (negative ? -atomic : atomic).toString().padStart(13, '0');
  const whole = digits.slice(0, -12);
  const fractionRaw = digits.slice(-12);
  let fraction = fractionRaw.replace(/0+$/, '');
  if (fraction.length < 6) {
    // Keep at least six decimals, but never show a non-zero balance as 0.000000.
    const firstSignificant = fractionRaw.search(/[1-9]/);
    fraction = firstSignificant === -1 ? fractionRaw.slice(0, 6) : fractionRaw.slice(0, Math.max(6, firstSignificant + 1));
  }
  const wholeOut = options.grouping ? groupThousands(whole) : whole;
  return `${negative ? '-' : ''}${wholeOut}.${fraction}`;
}

/** Compact form for dense lists: keeps six decimals unless the value is smaller. */
export function formatXmrCompact(value: string | number | bigint | null | undefined): string {
  const full = formatXmr(value);
  const [whole, fraction = ''] = full.split('.');
  if (whole !== '0') return `${whole}.${fraction.slice(0, 6)}`;
  const significantIndex = fraction.search(/[1-9]/);
  if (significantIndex === -1) return '0.000000';
  return `0.${fraction.slice(0, Math.min(12, significantIndex + 3))}`;
}

export function isValidAmountInput(value: string): boolean {
  const trimmed = value.trim().replace(',', '.');
  if (trimmed.length === 0) return false;
  if (!/^\d*(\.\d{0,12})?$/.test(trimmed)) return false;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0;
}

export function xmrToAtomicString(value: string): string {
  const trimmed = value.trim().replace(',', '.');
  const [whole = '0', fraction = ''] = trimmed.split('.');
  const atomic = BigInt(whole || '0') * ATOMIC_PER_XMR + BigInt((fraction + '000000000000').slice(0, 12));
  return atomic.toString();
}

export function formatNumber(value: number | null | undefined, grouping = true): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return grouping ? value.toLocaleString('en-US') : String(value);
}

export function shortenTxid(txid: string, head = 6, tail = 5): string {
  if (txid.length <= head + tail + 3) return txid;
  return `${txid.slice(0, head)}...${txid.slice(-tail)}`;
}

export function shortenAddress(address: string, head = 8, tail = 6): string {
  if (address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}

export function formatDateTime(timestampSeconds: number | null | undefined): string {
  if (!timestampSeconds || !Number.isFinite(timestampSeconds)) return '—';
  return new Date(timestampSeconds * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(timestampSeconds: number | null | undefined): string {
  if (!timestampSeconds) return '';
  const diffSeconds = Math.round(Date.now() / 1000 - timestampSeconds);
  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min ago`;
  if (diffSeconds < 86_400) return `${Math.floor(diffSeconds / 3600)} h ago`;
  return `${Math.floor(diffSeconds / 86_400)} d ago`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return '';
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

export function percent(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function shortUrlLabel(url: string): string {
  return url.replace(/^https?:\/\//, '');
}
