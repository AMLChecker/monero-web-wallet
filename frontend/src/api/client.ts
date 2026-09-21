import type {
  AddressInfo,
  AddressValidation,
  BalanceInfo,
  CreatedWallet,
  PriceBlock,
  PriceSourceId,
  PriceSourceOption,
  PreparedSend,
  ProjectSupport,
  SentTransaction,
  TransactionsResponse,
  WalletInfo,
  WalletList,
} from './types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly hint?: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(init.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch (error) {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the local wallet backend.', 'Start the wallet with Start.bat.');
  }

  const text = await response.text();
  const payload = text.length > 0 ? safeJson(text) : null;

  if (!response.ok) {
    const error = payload?.error ?? {};
    throw new ApiError(
      response.status,
      String(error.code ?? 'HTTP_ERROR'),
      String(error.message ?? `Request failed with HTTP ${response.status}.`),
      error.hint ?? null,
    );
  }
  return payload as T;
}

function safeJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const api = {
  health: () => request<{ ok: boolean; version: string; walletRpc: { online: boolean; version: string | null } }>('/api/health'),
  wallets: () => request<WalletList>('/api/wallets'),
  walletInfo: () => request<WalletInfo>('/api/wallet/info'),
  balance: () => request<BalanceInfo>('/api/wallet/balance'),
  address: () => request<AddressInfo>('/api/wallet/address'),
  transactions: (limit = 200) => request<TransactionsResponse>(`/api/wallet/transactions?limit=${limit}`),
  createWallet: (name: string, password: string) => post<CreatedWallet>('/api/wallet/create', { name, password }),
  openWallet: (name: string, password: string) => post<{ wallet: WalletInfo['wallet'] }>('/api/wallet/open', { name, password }),
  closeWallet: () => post<{ closed: boolean }>('/api/wallet/close', {}),
  revealPhrase: (password: string) => post<{ address: string; words: string[]; wordCount: number }>('/api/wallet/phrase', { password }),
  createSubaddress: (label: string) => post<{ address: string; index: number }>('/api/wallet/subaddress', { label }),
  validateAddress: (address: string) => post<AddressValidation>('/api/wallet/address/validate', { address }),
  refreshWallet: () => post<{ walletHeight: number | null }>('/api/wallet/refresh', {}),
  price: () => request<{ quote: PriceBlock; current: PriceSourceOption; sources: PriceSourceOption[] }>('/api/price'),
  support: () => request<ProjectSupport>('/api/support'),
  setPriceSource: (source: PriceSourceId) =>
    post<{ current: PriceSourceOption; quote: PriceBlock }>('/api/price/source', { source }),
  prepareSend: (input: { address: string; amount: string; priority: number; supportPercent?: number }) =>
    post<PreparedSend>('/api/wallet/send/prepare', input),
  send: (prepareId: string) => post<SentTransaction>('/api/wallet/send', { prepareId }),
  cancelSend: (prepareId: string) => post<{ cancelled: boolean }>('/api/wallet/send/cancel', { prepareId }),
  setDaemon: (address: string) => post<{ daemonAddress: string; online: boolean; height: number | null; error: string | null; note: string }>('/api/node/daemon', { address }),
};
