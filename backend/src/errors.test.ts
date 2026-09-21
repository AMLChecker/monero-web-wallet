import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AppError, RpcError, mapRpcError, sanitizeRpcMessage } from './errors';

describe('mapRpcError', () => {
  const cases: Array<[string, string, number]> = [
    ['Failed to open wallet : Invalid password.', 'BAD_PASSWORD', 401],
    ['Failed to open wallet : file not found "C:\\wallets\\main.keys"', 'WALLET_NOT_FOUND', 404],
    ['Cannot create wallet. Already exists.', 'WALLET_EXISTS', 409],
    ['Failed to open wallet : internal error: "C:\\wallets\\main.keys" is opened by another wallet program', 'WALLET_IN_USE', 409],
    ['No wallet file', 'WALLET_NOT_OPEN', 409],
    ['not enough money to transfer, available only 0.000000000000', 'INSUFFICIENT_FUNDS', 400],
    ['no connection to daemon', 'DAEMON_UNAVAILABLE', 503],
    ['Failed to parse tx metadata.', 'TX_EXPIRED', 409],
    ['Method not found', 'RPC_METHOD_UNAVAILABLE', 501],
  ];

  for (const [message, code, status] of cases) {
    it(`maps "${message.slice(0, 40)}…" to ${code}`, () => {
      const mapped = mapRpcError(new RpcError(-1, message));
      assert.equal(mapped.code, code);
      assert.equal(mapped.status, status);
      assert.ok(mapped.message.length > 0);
    });
  }

  it('treats an empty RPC error object as an empty result', () => {
    assert.equal(mapRpcError(new RpcError(0, '')).code, 'EMPTY');
  });

  it('maps socket failures to RPC_UNAVAILABLE', () => {
    const mapped = mapRpcError(new Error('connect ECONNREFUSED 127.0.0.1:18083'));
    assert.equal(mapped.code, 'RPC_UNAVAILABLE');
    assert.equal(mapped.status, 503);
  });

  it('maps timeouts to RPC_TIMEOUT', () => {
    const mapped = mapRpcError(new Error('Wallet RPC request timed out after 25000 ms'));
    assert.equal(mapped.code, 'RPC_TIMEOUT');
    assert.equal(mapped.status, 504);
  });

  it('keeps AppError instances untouched', () => {
    const original = new AppError(400, 'INVALID_AMOUNT', 'Amount must be greater than zero.');
    assert.equal(mapRpcError(original), original);
  });

  it('never leaks absolute paths or internal markers into messages', () => {
    const mapped = mapRpcError(new RpcError(-1, 'internal error: cannot open C:\\Users\\me\\wallets\\main.keys'));
    assert.equal(mapped.message.includes('C:\\Users'), false);
    assert.equal(/internal error/i.test(mapped.message), false);
  });
});

describe('sanitizeRpcMessage', () => {
  it('strips Windows and POSIX paths', () => {
    assert.equal(sanitizeRpcMessage('failed to open C:\\wallets\\main.keys'), 'failed to open <path>');
    assert.equal(sanitizeRpcMessage('failed to open /home/user/wallets/main.keys'), 'failed to open <path>');
  });

  it('collapses whitespace and drops the internal-error prefix', () => {
    assert.equal(sanitizeRpcMessage('internal error:   something   broke'), 'something broke');
  });
});
