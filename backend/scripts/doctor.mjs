/**
 * Local diagnostic helper: node backend/scripts/doctor.mjs
 * Checks the digest handshake and a few wallet RPC calls without printing secrets.
 */
import { RPC_LOGIN, RPC_URL } from '../dist/config.js';
import { MoneroRpcClient } from '../dist/moneroRpc.js';

const login = RPC_LOGIN;
console.log('endpoint      :', RPC_URL);
console.log('auth configured:', login ? `yes (user ${login.user})` : 'no');

const client = new MoneroRpcClient();
for (const method of ['get_version', 'get_height']) {
  try {
    const result = await client.call(method);
    console.log(`client.${method}: ok`, JSON.stringify(result));
  } catch (error) {
    console.log(`client.${method}: failed`, error.name, error.rpcCode ?? '', error.message);
  }
}
