import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError, api } from '../api/client';
import type { WalletInfo, WalletList } from '../api/types';

export type AsyncState<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (value: T | null) => void;
};

export function usePolling<T>(loader: () => Promise<T>, intervalMs: number, enabled = true): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(enabled);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const firstLoad = useRef(true);

  const run = useCallback(async () => {
    try {
      const value = await loaderRef.current();
      setData(value);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'UNKNOWN', 'Unexpected error.'));
    } finally {
      if (firstLoad.current) {
        firstLoad.current = false;
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    const tick = async () => {
      if (!active) return;
      await run();
    };
    void tick();
    const timer = window.setInterval(() => void tick(), intervalMs);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs, run]);

  return { data, error, loading, reload: run, setData };
}

export function useWalletInfo(intervalMs = 4_000): AsyncState<WalletInfo> {
  return usePolling(api.walletInfo, intervalMs);
}

export function useWalletList(intervalMs = 6_000, enabled = true): AsyncState<WalletList> {
  return usePolling(api.wallets, intervalMs, enabled);
}

export function useNow(intervalMs = 1_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
