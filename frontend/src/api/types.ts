export type WalletSession = {
  open: true;
  name: string;
  address: string;
  network: string;
  openedAt: number;
};

export type DaemonInfo = {
  address: string;
  online: boolean;
  pending?: boolean;
  height: number | null;
  targetHeight: number | null;
  synchronized: boolean;
  status: string | null;
  version: string | null;
  latencyMs: number | null;
  error: string | null;
};

export type WalletInfo = {
  app: { name: string; version: string; walletDir: string; sendMode: 'prepare' | 'direct' };
  rpc: { online: boolean; version: string | null };
  wallet: WalletSession | null;
  daemon: DaemonInfo;
  sync: {
    walletHeight: number | null;
    daemonHeight: number | null;
    progressPercent: number | null;
    synchronized: boolean;
  };
  balance: { balanceAtomic: string | null; unlockedAtomic: string | null; fetched: boolean };
  fetchedAt: number;
};

export type WalletFile = { name: string; sizeBytes: number | null; modifiedAt: number | null };

export type WalletList = {
  walletDir: string;
  rpc: { online: boolean; version: string | null };
  current: string | null;
  wallets: WalletFile[];
};

export type BalanceInfo = {
  balanceAtomic: string;
  unlockedAtomic: string;
  lockedAtomic: string;
  blocksToUnlock: number | null;
  timeToUnlock: number | null;
  updatedAt: number;
};

export type Subaddress = { index: number; address: string; label: string; used: boolean };
export type Account = {
  accountIndex: number;
  label: string;
  address: string;
  balanceAtomic: string;
  unlockedAtomic: string;
};

export type AddressInfo = {
  address: string;
  subaddresses: Subaddress[];
  accounts: Account[];
  totalBalanceAtomic: string;
  totalUnlockedAtomic: string;
};

export type TxRecord = {
  txid: string;
  direction: 'received' | 'sent';
  status: 'received' | 'sent' | 'pending' | 'failed';
  amountAtomic: string;
  feeAtomic: string | null;
  timestamp: number;
  height: number | null;
  confirmations: number | null;
  address: string | null;
  paymentId: string | null;
  note: string | null;
  unlockTime: number | null;
  locked: boolean;
  subaddressIndex: number | null;
  pending: boolean;
  failed: boolean;
};

export type TransactionsResponse = {
  transactions: TxRecord[];
  total: number;
  walletHeight: number | null;
  fetchedAt: number;
};

export type PreparedSend = {
  prepareId: string;
  mode: 'prepare' | 'direct';
  address: string;
  amountAtomic: string;
  feeAtomic: string | null;
  feeEstimated: boolean;
  totalAtomic: string | null;
  priority: number;
  expiresAt: number;
};

export type SentTransaction = {
  txHash: string;
  feeAtomic: string | null;
  amountAtomic: string;
  address: string;
  sentAt: number;
};

export type CreatedWallet = {
  wallet: WalletSession;
  network: string;
  recoveryWords: string[];
  recoveryPhrase: string;
};

export type AddressValidation = {
  valid: boolean;
  integrated: boolean;
  subaddress: boolean;
  nettype: string;
  openaliasAddress: string;
};
