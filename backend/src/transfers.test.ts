import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { normalizeTransfers } from './walletManager';

const WALLET_HEIGHT = 3_000_000;

describe('normalizeTransfers', () => {
  it('returns an empty list when the RPC sent no buckets', () => {
    assert.deepEqual(normalizeTransfers({}, WALLET_HEIGHT), []);
    assert.deepEqual(normalizeTransfers({ in: [], out: [], pending: [], pool: [], failed: [] }, WALLET_HEIGHT), []);
  });

  it('classifies incoming, outgoing, pending and failed transfers', () => {
    const records = normalizeTransfers(
      {
        in: [{ txid: 'aa', amount: 500_000_000_000, timestamp: 1_700_000_000, height: 2_999_995, confirmations: 6, address: 'ADDR' }],
        out: [{ txid: 'bb', amount: 120_000_000_000, fee: 30_000_000, timestamp: 1_700_000_100, height: 2_999_990, confirmations: 11 }],
        pending: [{ txid: 'cc', amount: 250_000_000_000, fee: 20_000_000, timestamp: 1_700_000_200, height: 0, confirmations: 0 }],
        pool: [{ txid: 'dd', amount: 1_000_000_000, timestamp: 1_700_000_300, confirmations: 0 }],
        failed: [{ txid: 'ee', amount: 42_000_000_000, fee: 15_000_000, timestamp: 1_700_000_400 }],
      },
      WALLET_HEIGHT,
    );

    const byId = new Map(records.map((record) => [record.txid, record]));
    assert.equal(byId.get('aa')!.direction, 'received');
    assert.equal(byId.get('aa')!.status, 'received');
    assert.equal(byId.get('aa')!.amountAtomic, '500000000000');
    assert.equal(byId.get('aa')!.feeAtomic, null);
    assert.equal(byId.get('aa')!.confirmations, 6);

    assert.equal(byId.get('bb')!.direction, 'sent');
    assert.equal(byId.get('bb')!.status, 'sent');
    assert.equal(byId.get('bb')!.feeAtomic, '30000000');
    assert.equal(byId.get('bb')!.locked, false);

    assert.equal(byId.get('cc')!.status, 'pending');
    assert.equal(byId.get('cc')!.pending, true);
    assert.equal(byId.get('cc')!.locked, true);

    assert.equal(byId.get('dd')!.direction, 'received');
    assert.equal(byId.get('dd')!.status, 'pending');

    assert.equal(byId.get('ee')!.failed, true);
    assert.equal(byId.get('ee')!.status, 'failed');
  });

  it('merges the same txid across buckets and keeps pending/failed flags', () => {
    const records = normalizeTransfers(
      {
        out: [{ txid: 'same', amount: 100_000_000_000, fee: 10_000_000, timestamp: 1_700_000_000, height: 2_999_999, confirmations: 2 }],
        pending: [{ txid: 'same', amount: 100_000_000_000, fee: 10_000_000, timestamp: 1_700_000_000, height: 0, confirmations: 0 }],
      },
      WALLET_HEIGHT,
    );

    assert.equal(records.length, 1);
    assert.equal(records[0].txid, 'same');
    assert.equal(records[0].pending, true);
    assert.equal(records[0].confirmations, 2, 'the most final view of the transaction wins');
  });

  it('derives confirmations from the wallet height when the RPC omits them', () => {
    const records = normalizeTransfers(
      { in: [{ txid: 'noconf', amount: 1n.toString(), timestamp: 1_700_000_000, height: WALLET_HEIGHT - 3 }] },
      WALLET_HEIGHT,
    );
    assert.equal(records[0].confirmations, 4);
    assert.equal(records[0].locked, true, 'fewer than ten confirmations means locked');
  });

  it('marks funds locked while unlock_time is in the future', () => {
    const future = Math.floor(Date.now() / 1000) + 600;
    const records = normalizeTransfers(
      { in: [{ txid: 'time', amount: 1n.toString(), timestamp: 1_700_000_000, height: WALLET_HEIGHT - 50, confirmations: 50, unlock_time: future }] },
      WALLET_HEIGHT,
    );
    assert.equal(records[0].locked, true);
    assert.equal(records[0].unlockTime, future);
  });

  it('sorts by timestamp descending and ignores entries without a txid', () => {
    const records = normalizeTransfers(
      {
        in: [
          { txid: 'old', amount: '1', timestamp: 1_000, height: 10, confirmations: 99 },
          { txid: 'new', amount: '1', timestamp: 2_000, height: 20, confirmations: 99 },
          { amount: '5', timestamp: 3_000 },
        ],
      },
      WALLET_HEIGHT,
    );
    assert.deepEqual(
      records.map((record) => record.txid),
      ['new', 'old'],
    );
  });
});
