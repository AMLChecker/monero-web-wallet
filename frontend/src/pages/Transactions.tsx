import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { api } from '../api/client';
import { TxDetailsModal, TxList } from '../components/Transactions';
import { Button, Card, CardHeader, Input, Segmented, Skeleton } from '../components/ui';
import type { TxRecord } from '../api/types';
import { usePolling } from '../hooks/useApi';
import { useWallet } from '../state/wallet';

type Filter = 'all' | 'received' | 'sent' | 'pending';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'received', label: 'Received' },
  { value: 'sent', label: 'Sent' },
  { value: 'pending', label: 'Pending' },
];

export function TransactionsPage() {
  const { rpcOffline } = useWallet();
  const history = usePolling(() => api.transactions(300), 15_000, !rpcOffline);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<TxRecord | null>(null);
  const [busy, setBusy] = useState(false);

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
          title="Transaction history"
          description={`${filtered.length} of ${transactions.length} transfers known to this wallet`}
          action={
            <Button size="sm" variant="secondary" onClick={() => void refresh()} loading={busy}>
              Refresh
            </Button>
          }
        />
        <div className="flex flex-col gap-3 border-b border-line-soft px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
          <Segmented value={filter} options={FILTERS} onChange={setFilter} />
          <div className="w-full max-w-[320px]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by txid, address or note"
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
