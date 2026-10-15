import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { api } from '../api/client';
import { TxDetailsModal, TxList } from '../components/Transactions';
import { Button, Card, CardHeader, Input, Segmented, Skeleton } from '../components/ui';
import type { TxRecord } from '../api/types';
import { usePolling } from '../hooks/useApi';
import { useI18n } from '../i18n/I18nProvider';
import { useWallet } from '../state/wallet';

type Filter = 'all' | 'received' | 'sent' | 'pending';

export function TransactionsPage() {
  const { rpcOffline } = useWallet();
  const { t } = useI18n();
  const history = usePolling(() => api.transactions(300), 15_000, !rpcOffline);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<TxRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const filters: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: t('txPage.filterAll') },
    { value: 'received', label: t('txPage.filterReceived') },
    { value: 'sent', label: t('txPage.filterSent') },
    { value: 'pending', label: t('txPage.filterPending') },
  ];

  const transactions = history.data?.transactions ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (filter === 'received' && tx.direction !== 'received') return false;
      if (filter === 'sent' && tx.direction !== 'sent') return false;
      if (filter === 'pending' && !tx.pending) return false;
      if (needle.length === 0) return true;
      return (
        tx.txid.toLowerCase().includes(needle) ||
        (tx.address ?? '').toLowerCase().includes(needle) ||
        (tx.note ?? '').toLowerCase().includes(needle)
      );
    });
  }, [transactions, filter, query]);

  const refresh = async () => {
    setBusy(true);
    try {
      await history.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title={t('txPage.title')}
          description={t('txPage.description', { filtered: filtered.length, total: transactions.length })}
          action={
            <Button size="sm" variant="secondary" onClick={() => void refresh()} loading={busy}>
              {t('common.refresh')}
            </Button>
          }
        />
        <div className="flex flex-col gap-3 border-b border-line-soft px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
          <Segmented value={filter} options={filters} onChange={setFilter} />
          <div className="w-full max-w-[320px]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('txPage.searchPlaceholder')}
              suffix={<Search className="h-4 w-4" />}
            />
          </div>
        </div>
        {history.loading && transactions.length === 0 ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <TxList transactions={filtered} onSelect={setSelected} />
        )}
      </Card>

      <TxDetailsModal tx={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
