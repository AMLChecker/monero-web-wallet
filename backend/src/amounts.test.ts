import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ATOMIC_UNITS_PER_XMR,
  SUPPORT_PERCENT_MAX,
  atomicToBigInt,
  clampSupportPercent,
  computeSupportAmount,
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

describe('clampSupportPercent', () => {
  it('treats missing, zero and negative values as "off"', () => {
    assert.equal(clampSupportPercent(undefined), 0);
    assert.equal(clampSupportPercent(null), 0);
    assert.equal(clampSupportPercent(0), 0);
    assert.equal(clampSupportPercent(-3), 0);
    assert.equal(clampSupportPercent('abc'), 0);
  });

  it('accepts percentages up to the configured maximum', () => {
    assert.equal(clampSupportPercent(0.5), 0.5);
    assert.equal(clampSupportPercent(1), 1);
    assert.equal(clampSupportPercent('2.5'), 2.5);
    assert.equal(clampSupportPercent(50), SUPPORT_PERCENT_MAX);
  });

  it('keeps at most two decimals', () => {
    assert.equal(clampSupportPercent(0.505), 0.51);
    assert.equal(clampSupportPercent(1.239), 1.24);
  });
});

describe('computeSupportAmount', () => {
  const oneXmr = 1_000_000_000_000n;

  it('returns zero when support is off', () => {
    assert.equal(computeSupportAmount(oneXmr, 0), 0n);
    assert.equal(computeSupportAmount(oneXmr, -1), 0n);
    assert.equal(computeSupportAmount(0n, 1), 0n);
  });

  it('computes the percentage with BigInt', () => {
    assert.equal(computeSupportAmount(oneXmr, 0.5), 5_000_000_000n);
    assert.equal(computeSupportAmount(oneXmr, 1), 10_000_000_000n);
    assert.equal(computeSupportAmount(250_000_000_000n, 1), 2_500_000_000n);
  });

  it('floors instead of rounding up, so the sender never overpays', () => {
    // 0.5% of 50 atomic units is 0.25 → floored to zero, i.e. no support at all
    assert.equal(computeSupportAmount(50n, 0.5), 0n);
    assert.equal(computeSupportAmount(199n, 1), 1n);
  });

  it('clamps the percentage before computing', () => {
    assert.equal(computeSupportAmount(oneXmr, 100), (oneXmr * 5n) / 100n);
  });
});
