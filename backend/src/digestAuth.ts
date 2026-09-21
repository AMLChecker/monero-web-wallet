import crypto from 'node:crypto';

/**
 * monero-wallet-rpc protects its JSON-RPC endpoint with HTTP Digest authentication
 * (realm "monero-rpc", qop "auth", algorithm MD5). Node's fetch does not implement
 * Digest auth, so the handshake is handled here. This is ordinary HTTP plumbing —
 * no Monero cryptography is reimplemented anywhere in this project.
 */

export type DigestChallenge = {
  realm: string;
  nonce: string;
  qop: string | null;
  algorithm: string;
  opaque: string | null;
};

export function parseDigestChallenge(header: string | null): DigestChallenge | null {
  if (!header) return null;
  // monero-wallet-rpc answers with two WWW-Authenticate headers (MD5 and MD5-sess).
  // fetch joins them with ", ", so only the first challenge may be used.
  const firstChallenge = header.trim().split(/,\s*digest\s+/i)[0];
  const match = /^digest\s+(.*)$/i.exec(firstChallenge.trim());
  if (!match) return null;

  const params: Record<string, string> = {};
  const pattern = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g;
  let item: RegExpExecArray | null;
  while ((item = pattern.exec(match[1])) !== null) {
    params[item[1].toLowerCase()] = item[2] !== undefined ? item[2] : item[3];
  }

  if (!params.realm || !params.nonce) return null;
  return {
    realm: params.realm,
    nonce: params.nonce,
    qop: params.qop ? params.qop.split(',')[0].trim().toLowerCase() : null,
    algorithm: (params.algorithm || 'MD5').toUpperCase(),
    opaque: params.opaque ?? null,
  };
}

function md5(value: string): string {
  return crypto.createHash('md5').update(value, 'utf8').digest('hex');
}

export function buildAuthorization(options: {
  user: string;
  pass: string;
  method: string;
  uri: string;
  challenge: DigestChallenge;
  nonceCount: number;
  cnonce: string;
}): string {
  const { user, pass, method, uri, challenge, nonceCount, cnonce } = options;
  const nc = nonceCount.toString(16).padStart(8, '0');

  const ha1Base = md5(`${user}:${challenge.realm}:${pass}`);
  const ha1 = challenge.algorithm === 'MD5-SESS' ? md5(`${ha1Base}:${challenge.nonce}:${cnonce}`) : ha1Base;
  const ha2 = md5(`${method}:${uri}`);

  const response = challenge.qop
    ? md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`)
    : md5(`${ha1}:${challenge.nonce}:${ha2}`);

  // monero-wallet-rpc (epee) parses these fields in a fixed order and rejects an
  // explicit algorithm parameter, so the header is built exactly like this:
  // username, realm, nonce, uri, qop, nc, cnonce, response.
  const parts = [
    `username="${user}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
  ];
  if (challenge.qop) {
    parts.push(`qop=${challenge.qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  }
  parts.push(`response="${response}"`);

  return `Digest ${parts.join(', ')}`;
}

export function randomCnonce(): string {
  return crypto.randomBytes(8).toString('hex');
}
