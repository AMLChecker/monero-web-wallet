import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { ApiError, api } from '../api/client';
import type { WalletInfo } from '../api/types';
import { useWalletInfo } from '../hooks/useApi';

type WalletContextValue = {
  info: WalletInfo | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  refreshing: boolean;
  rpcOffline: boolean;
  daemonOffline: boolean;
  daemonPending: boolean;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { data, error, loading, reload } = useWalletInfo(5_000);
  const [refreshing, setRefreshing] = useState(false);

  const refreshWallet = useCallback(async () => {
    setRefreshing(true);
    try {
      await api.refreshWallet();
    } finally {
      setRefreshing(false);
      await reload();
    }
  }, [reload]);

  const value = useMemo<WalletContextValue>(
    () => ({
      info: data,
      error,
      loading,
      reload,
      refreshWallet,
      refreshing,
      rpcOffline: data !== null && data.rpc.online === false,
      daemonOffline: data !== null && data.daemon.online === false && data.daemon.pending !== true,
      daemonPending: data !== null && data.daemon.pending === true,
    }),
    [data, error, loading, reload, refreshWallet, refreshing],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used inside WalletProvider');
  return context;
}
