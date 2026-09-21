import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PriceService,
  formatUsdt,
  isPriceSourceId,
  normalisePrice,
  parseCoinGeckoPrice,
  parseCustomPrice,
  parseKrakenTicker,
} from './price';

describe('normalisePrice', () => {
  it('accepts numbers and decimal strings', () => {
    assert.equal(normalisePrice(571.36), '571.36');
    assert.equal(normalisePrice('569.940000'), '569.94');
    assert.equal(normalisePrice('570'), '570');
    assert.equal(normalisePrice('0.5'), '0.5');
    assert.equal(normalisePrice('007.10'), '7.1');
  });

  it('rejects nonsense and non-positive values', () => {
    for (const value of ['', 'abc', '0', '0.00', '-5', '1,5', 'NaN', null, undefined, {}, '1.1234567890123']) {
      assert.equal(normalisePrice(value), null, `expected ${String(value)} to be rejected`);
    }
  });
});

describe('price API parsers', () => {
  it('reads the last trade price from a Kraken ticker', () => {
    const payload = {
      error: [],
      result: {
        XMRUSDT: {
          a: ['570.010000', '1', '1.000'],
          c: ['569.940000', '3.51009591'],
          p: ['588.637063', '582.225644'],
        },
      },
    };
    assert.equal(parseKrakenTicker(payload), '569.94');
  });

  it('rejects a Kraken error response', () => {
    assert.equal(parseKrakenTicker({ error: ['EQuery:Unknown asset pair'], result: {} }), null);
  });

  it('reads the USD price from CoinGecko', () => {
    assert.equal(parseCoinGeckoPrice({ monero: { usd: 571.36 } }), '571.36');
    assert.equal(parseCoinGeckoPrice({}), null);
  });

  it('reads the price from a custom endpoint', () => {
    assert.equal(parseCustomPrice({ price: 569.94 }), '569.94');
    assert.equal(parseCustomPrice({ price: '570' }), '570');
    assert.equal(parseCustomPrice({ result: { price: 1.5 } }), '1.5');
    assert.equal(parseCustomPrice({} as unknown), null);
  });
});

describe('formatUsdt', () => {
  const oneXmr = 1_000_000_000_000n;

  it('converts a balance with BigInt arithmetic', () => {
    assert.equal(formatUsdt(oneXmr, '570.00'), '570.00');
    assert.equal(formatUsdt(2n * oneXmr, '569.94'), '1,139.88');
    assert.equal(formatUsdt(900_000_000n, '570.00'), '0.51');
  });

  it('rounds half up to two decimals', () => {
    assert.equal(formatUsdt(oneXmr, '0.005'), '0.01');
    assert.equal(formatUsdt(oneXmr, '0.004'), '0.00');
  });

  it('handles zero and dust without inventing a value', () => {
    assert.equal(formatUsdt(0n, '570'), '0.00');
    assert.equal(formatUsdt(1n, '570'), '0.00');
  });

  it('returns null when the price is unusable', () => {
    assert.equal(formatUsdt(oneXmr, 'abc'), null);
    assert.equal(formatUsdt(oneXmr, '0'), null);
    assert.equal(formatUsdt('not-a-number', '570'), null);
  });
});

describe('PriceService', () => {
  it('does nothing when the source is off', async () => {
    const service = new PriceService('none');
    const quote = await service.quote();
    assert.equal(quote.enabled, false);
    assert.equal(quote.value, null);
    assert.equal(quote.error, null);
  });

  it('validates source identifiers', () => {
    for (const id of ['none', 'kraken', 'coingecko', 'custom']) {
      assert.equal(isPriceSourceId(id), true);
    }
    for (const id of ['binance', '', 'KRAKEN', null, 5]) {
      assert.equal(isPriceSourceId(id), false);
    }
    assert.throws(() => new PriceService('none').setSource('binance'), /unknown price source/i);
  });

  it('lists the selectable sources with their pairs', () => {
    const ids = new PriceService('none').availableSources().map((entry) => entry.id);
    assert.deepEqual(ids, ['none', 'kraken', 'coingecko', 'custom']);
  });
});
