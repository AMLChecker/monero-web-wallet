import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildTransferBody } from './moneroRpc';

const ADDRESS = '4ApMgwswd6rUeSu3K9bVoyV5hmjcVLuDUePgk4r8bqh85oQYjF3LVTnAiMfp4ukrAL4umhrV6DfaRP5nXbdLZ3CbMTzmico';

const base = {
  address: ADDRESS,
  amountAtomic: '100000000',
  priority: 0,
  accountIndex: 0,
  doNotRelay: true,
};

describe('buildTransferBody', () => {
  it('asks for the tx metadata when the transaction is not relayed', () => {
    const body = buildTransferBody(base);
    const parsed = JSON.parse(body);

    assert.equal(parsed.method, 'transfer');
    assert.equal(parsed.params.do_not_relay, true);
    // monero-wallet-rpc only fills tx_metadata when this flag is set, and a two-phase
    // send cannot be completed without it.
    assert.equal(parsed.params.get_tx_metadata, true);
    assert.equal(parsed.params.get_tx_key, true);
  });

  it('does not ask for metadata when the transaction is relayed immediately', () => {
    const parsed = JSON.parse(buildTransferBody({ ...base, doNotRelay: false }));

    assert.equal(parsed.params.do_not_relay, false);
    assert.equal(parsed.params.get_tx_metadata, false);
  });

  it('sends the amount as an integer in atomic units', () => {
    const parsed = JSON.parse(buildTransferBody(base));

    assert.deepEqual(parsed.params.destinations, [{ amount: 100000000, address: ADDRESS }]);
    assert.equal(parsed.params.account_index, 0);
    assert.equal(parsed.params.priority, 0);
  });

  it('appends the optional support as a second destination of the same transaction', () => {
    const parsed = JSON.parse(
      buildTransferBody({ ...base, supportAddress: ADDRESS, supportAtomic: '500000' }),
    );

    assert.equal(parsed.params.destinations.length, 2);
    assert.deepEqual(parsed.params.destinations[1], { amount: 500000, address: ADDRESS });
  });

  it('drops an empty support destination', () => {
    const parsed = JSON.parse(buildTransferBody({ ...base, supportAddress: ADDRESS, supportAtomic: '0' }));
    assert.equal(parsed.params.destinations.length, 1);
  });

  it('keeps the note when there is one', () => {
    const parsed = JSON.parse(buildTransferBody({ ...base, note: 'rent "march"' }));
    assert.equal(parsed.params.note, 'rent "march"');
  });

  it('refuses amounts and support amounts that are not integers', () => {
    assert.throws(() => buildTransferBody({ ...base, amountAtomic: '1.5' }), /atomic units/);
    assert.throws(
      () => buildTransferBody({ ...base, supportAddress: ADDRESS, supportAtomic: '0.5' }),
      /atomic units/,
    );
  });
});
