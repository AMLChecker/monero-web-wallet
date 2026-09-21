import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ATOMIC_UNITS_PER_XMR,
  atomicToBigInt,
  formatAtomic,
  formatAtomicCompact,
  parseXmrToAtomic,
} from './amounts';

describe('parseXmrToAtomic', () => {
  it('converts whole XMR into atomic units', () => {
    assert.equal(parseXmrToAtomic('1'), ATOMIC_UNITS_PER_XMR);
    assert.equal(parseXmrToAtomic('12'), 12n * ATOMIC_UNITS_PER_XMR);
  });

  it('converts decimals without floating point loss', () => {
    assert.equal(parseXmrToAtomic('0.25'), 250_000_000_000n);
    assert.equal(parseXmrToAtomic('1.284921'), 1_284_921_000_000n);
    assert.equal(parseXmrToAtomic('1.000000000001'), 1_000_000_000_001n);
  });

  it('accepts a comma as the decimal separator when there is no dot', () => {
    assert.equal(parseXmrToAtomic('1,5'), 1_500_000_000_000n);
  });

  it('treats commas as thousands separators when a dot is present', () => {
    assert.equal(parseXmrToAtomic('1,000.5'), 1_000_500_000_000_000n);
  });

  it('rejects empty, negative, zero and malformed amounts', () => {
    for (const value of ['', '   ', 'abc', '-1', '0', '0.0', '1.2.3', '1e5', '1.1234567890123']) {
      assert.throws(() => parseXmrToAtomic(value), /amount|valid|zero|decimal/i, `expected ${JSON.stringify(value)} to be rejected`);
    }
  });
});

describe('atomicToBigInt', () => {
  it('passes through bigints, safe integers and numeric strings', () => {
    assert.equal(atomicToBigInt(5n), 5n);
    assert.equal(atomicToBigInt(42), 42n);
    assert.equal(atomicToBigInt('1234'), 1234n);
  });

  it('refuses values that cannot be represented exactly', () => {
    assert.throws(() => atomicToBigInt(1.5), /amount|atomic/i);
    assert.throws(() => atomicToBigInt('12.5'), /amount|atomic/i);
    assert.throws(() => atomicToBigInt(Number.MAX_SAFE_INTEGER + 1), /amount|atomic/i);
  });
});

describe('formatAtomic', () => {
  it('always shows at least six decimals', () => {
    assert.equal(formatAtomic(0n), '0.000000');
    assert.equal(formatAtomic(250_000_000_000n), '0.250000');
    assert.equal(formatAtomic(1_284_921_000_000n), '1.284921');
  });

  it('never hides a non-zero amount below one micro-XMR', () => {
    assert.equal(formatAtomic(1n), '0.000000000001');
    assert.equal(formatAtomic(1_000n), '0.000000001');
  });

  it('groups thousands when asked', () => {
    assert.equal(formatAtomic(1_234_567_000_000n), '1.234567');
    assert.equal(formatAtomic(1_234_567_000_000_000_000n, { grouping: true }), '1,234,567.000000');
  });

  it('handles negative values (used for fee previews)', () => {
    assert.equal(formatAtomic(-250_000_000_000n), '-0.250000');
  });
});

describe('formatAtomicCompact', () => {
  it('keeps six decimals for ordinary amounts', () => {
    assert.equal(formatAtomicCompact(1_284_921_000_000n), '1.284921');
  });

  it('keeps significant digits for dust', () => {
    assert.equal(formatAtomicCompact(1n), '0.000000000001');
    assert.equal(formatAtomicCompact(0n), '0.000000');
  });
});
