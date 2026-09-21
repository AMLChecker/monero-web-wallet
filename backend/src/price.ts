import { PRICE_API_URL, PRICE_SOURCE, persistPriceSource } from './config';
import { logger } from './logger';

export type PriceSourceId = 'none' | 'kraken' | 'coingecko' | 'custom';

export type PriceSourceInfo = {
  id: PriceSourceId;
  label: string;
  pair: string;
  url: string | null;
};

export type PriceQuote = {
  enabled: boolean;
  source: PriceSourceId;
  label: string;
  pair: string;
  /** Decimal string, never a float. Example: "569.94" */
  value: string | null;
  updatedAt: number | null;
  error: string | null;
};

const KRAKEN_URL = 'https://api.kraken.com/0/public/Ticker?pair=XMRUSDT';
const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=monero&vs_currencies=usd';

const CACHE_MS = 60_000;
const REQUEST_TIMEOUT_MS = 8_000;

const DECIMAL = /^\d+(\.\d+)?$/;

export function priceSources(): PriceSourceInfo[] {
  return [
    { id: 'none', label: 'Off — no price requests', pair: '', url: null },
    { id: 'kraken', label: 'Kraken', pair: 'XMR/USDT', url: KRAKEN_URL },
    { id: 'coingecko', label: 'CoinGecko', pair: 'XMR/USD', url: COINGECKO_URL },
    {
      id: 'custom',
      label: 'Custom endpoint',
      pair: 'XMR/USDT',
      url: PRICE_API_URL || null,
    },
  ];
}

export function isPriceSourceId(value: unknown): value is PriceSourceId {
  return typeof value === 'string' && ['none', 'kraken', 'coingecko', 'custom'].includes(value);
}

/** Kraken /0/public/Ticker returns result.XMRUSDT.c = [last trade price, volume]. */
export function parseKrakenTicker(payload: unknown): string | null {
  const result = (payload as any)?.result;
  if (!result || typeof result !== 'object') return null;
  const pair = result['XMRUSDT'] ?? Object.values(result)[0];
  const last = (pair as any)?.c?.[0];
  return normalisePrice(last);
}

/** CoinGecko /simple/price returns { monero: { usd: 571.36 } }. */
export function parseCoinGeckoPrice(payload: unknown): string | null {
  const value = (payload as any)?.monero?.usd ?? (payload as any)?.monero?.usdt;
  return normalisePrice(value);
}

/** Custom endpoint must answer with { "price": 569.94 } (a number or a string). */
export function parseCustomPrice(payload: unknown): string | null {
  const candidate = (payload as any)?.price ?? (payload as any)?.result?.price ?? (payload as any)?.data?.price;
  return normalisePrice(candidate);
}

/** Accepts a number or a decimal string and returns a canonical decimal string. */
export function normalisePrice(value: unknown): string | null {
  let text: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    text = value.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  } else if (typeof value === 'string') {
    text = value.trim();
  } else {
    return null;
  }
  if (!DECIMAL.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > 12) return null;
  const parsed = BigInt(`${whole}${fraction.padEnd(12, '0')}`);
  if (parsed <= 0n) return null;
  const trimmed = fraction.replace(/0+$/, '');
  const canonicalWhole = whole.replace(/^0+(?=\d)/, '');
  return trimmed.length === 0 ? canonicalWhole : `${canonicalWhole}.${trimmed}`;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Converts an atomic-unit XMR balance into a USDT/USD string with two decimals.
 * Uses BigInt throughout: the project never multiplies money as a float.
 */
export function formatUsdt(atomic: bigint | string, price: string): string | null {
  const priceText = normalisePrice(price);
  if (priceText === null) return null;

  let atomicValue: bigint;
  try {
    atomicValue = typeof atomic === 'bigint' ? atomic : BigInt(atomic);
  } catch {
    return null;
  }
  if (atomicValue < 0n) return null;

  const [whole, fraction = ''] = priceText.split('.');
  const decimals = fraction.length;
  const scale = 10n ** BigInt(decimals);
  const priceScaled = BigInt(`${whole}${fraction}`);

  const numerator = atomicValue * priceScaled * 100n;
  const denominator = 1_000_000_000_000n * scale;
  const cents = (numerator + denominator / 2n) / denominator;

  return `${groupThousands((cents / 100n).toString())}.${(cents % 100n).toString().padStart(2, '0')}`;
}

export class PriceService {
  private source: PriceSourceId;
  private cache: PriceQuote | null = null;
  private inFlight: Promise<PriceQuote> | null = null;

  constructor(private readonly initial: string = PRICE_SOURCE) {
    this.source = isPriceSourceId(initial) ? initial : 'none';
  }

  get current(): PriceSourceInfo {
    return priceSources().find((entry) => entry.id === this.source) ?? priceSources()[0];
  }

  get id(): PriceSourceId {
    return this.source;
  }

  availableSources(): PriceSourceInfo[] {
    return priceSources();
  }

  setSource(id: unknown): PriceSourceInfo {
    if (!isPriceSourceId(id)) {
      throw new Error('Unknown price source');
    }
    this.source = id;
    this.cache = null;
    persistPriceSource(id);
    logger.info('price source changed', { source: id });
    return this.current;
  }

  private async fetchQuote(): Promise<PriceQuote> {
    const info = this.current;
    const base: PriceQuote = {
      enabled: info.id !== 'none',
      source: info.id,
      label: info.label,
      pair: info.pair,
      value: null,
      updatedAt: null,
      error: null,
    };
    if (info.id === 'none') return { ...base, enabled: false };
    if (!info.url) {
      return { ...base, error: 'No endpoint configured for this price source.' };
    }

    try {
      const response = await fetch(info.url, {
        headers: { 'user-agent': 'monero-web-wallet/1.0 (+https://github.com/AMLChecker/monero-web-wallet)', accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        return { ...base, error: `Price API answered HTTP ${response.status}.` };
      }
      const payload = await response.json();
      const value =
        info.id === 'kraken'
          ? parseKrakenTicker(payload)
          : info.id === 'coingecko'
            ? parseCoinGeckoPrice(payload)
            : parseCustomPrice(payload);
      if (value === null) {
        return { ...base, error: 'Price API returned an unexpected response.' };
      }
      return { ...base, value, updatedAt: Date.now() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.debug('price request failed', { source: info.id, error: message });
      return {
        ...base,
        error: /timeout|aborted/i.test(message) ? 'Price API did not answer in time.' : 'Cannot reach the price API.',
      };
    }
  }

  /** Cached quote: at most one outbound request per minute, never throws. */
  async quote(force = false): Promise<PriceQuote> {
    if (this.source === 'none') return this.fetchQuote();
    if (!force && this.cache && Date.now() - (this.cache.updatedAt ?? 0) < CACHE_MS) return this.cache;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetchQuote()
      .then((quote) => {
        this.cache = quote;
        return quote;
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  /** The quote currently in memory, without triggering a request. */
  cached(): PriceQuote | null {
    return this.cache;
  }

  /** A placeholder used while the first quote is still being fetched. */
  pending(): PriceQuote {
    const info = this.current;
    return {
      enabled: info.id !== 'none',
      source: info.id,
      label: info.label,
      pair: info.pair,
      value: null,
      updatedAt: null,
      error: null,
    };
  }

  /**
   * Never blocks the caller: returns whatever is cached and refreshes in the
   * background when the cache is missing or older than the TTL. This keeps the
   * wallet UI responsive even when the price API is slow or unreachable.
   */
  snapshot(): PriceQuote {
    if (this.source === 'none') return this.pending();
    const cached = this.cache;
    const stale = !cached || !cached.updatedAt || Date.now() - cached.updatedAt >= CACHE_MS;
    if (stale) void this.quote().catch(() => undefined);
    return cached ?? this.pending();
  }
}

export const priceService = new PriceService();
