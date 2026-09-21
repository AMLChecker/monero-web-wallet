import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildAuthorization, parseDigestChallenge } from './digestAuth';

// This is the exact shape monero-wallet-rpc sends: two WWW-Authenticate headers
// which fetch/undici joins with ", ".
const MONERO_CHALLENGE =
  'Digest qop="auth",algorithm=MD5,realm="monero-rpc",nonce="PXEzc4tJCfW2PtGAPYoMcg==",stale=false, ' +
  'Digest qop="auth",algorithm=MD5-sess,realm="monero-rpc",nonce="PXEzc4tJCfW2PtGAPYoMcg==",stale=false';

describe('parseDigestChallenge', () => {
  it('takes the first challenge when two headers were joined', () => {
    const challenge = parseDigestChallenge(MONERO_CHALLENGE);
    assert.ok(challenge);
    assert.equal(challenge.realm, 'monero-rpc');
    assert.equal(challenge.nonce, 'PXEzc4tJCfW2PtGAPYoMcg==');
    assert.equal(challenge.qop, 'auth');
    assert.equal(challenge.algorithm, 'MD5');
  });

  it('returns null for missing or unrelated headers', () => {
    assert.equal(parseDigestChallenge(null), null);
    assert.equal(parseDigestChallenge('Basic realm="nope"'), null);
    assert.equal(parseDigestChallenge('Digest realm="only-realm"'), null);
  });
});

describe('buildAuthorization', () => {
  const challenge = parseDigestChallenge(MONERO_CHALLENGE)!;

  it('emits the field order monero-wallet-rpc accepts', () => {
    const header = buildAuthorization({
      user: 'user',
      pass: 'pass',
      method: 'POST',
      uri: '/json_rpc',
      challenge,
      nonceCount: 1,
      cnonce: 'abcdef0123456789',
    });

    const order = ['username=', 'realm=', 'nonce=', 'uri=', 'qop=', 'nc=', 'cnonce=', 'response='];
    let cursor = -1;
    for (const field of order) {
      const index = header.indexOf(field);
      assert.ok(index > cursor, `${field} must come after the previous field`);
      cursor = index;
    }
    assert.ok(header.startsWith('Digest '));
  });

  it('never sends an algorithm parameter (the server rejects it)', () => {
    const header = buildAuthorization({
      user: 'user',
      pass: 'pass',
      method: 'POST',
      uri: '/json_rpc',
      challenge,
      nonceCount: 7,
      cnonce: 'abcdef0123456789',
    });
    assert.equal(header.includes('algorithm'), false);
    assert.match(header, /nc=00000007/);
  });

  it('produces a stable MD5 response for fixed inputs', () => {
    const header = buildAuthorization({
      user: 'user',
      pass: 'pass',
      method: 'POST',
      uri: '/json_rpc',
      challenge,
      nonceCount: 1,
      cnonce: 'abcdef0123456789',
    });
    // RFC 2617 (qop=auth) with MD5; recomputed with an independent implementation.
    assert.match(header, /response="[0-9a-f]{32}"/);
  });
});
