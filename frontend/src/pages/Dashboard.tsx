import { ArrowDownToLine, ArrowUpFromLine, Lock, Wallet } from 'lucide-react';
import { useState } from 'react';

import { api } from '../api/client';
import { TxDetailsModal, TxList } from '../components/Transactions';
import { Button, Card, CardHeader, ProgressBar, Skeleton, StatusPill } from '../components/ui';
import type { TxRecord } from '../api/types';
import { usePolling } from '../hooks/useApi';
import { formatNumber, formatRelativeTime, formatXmr, percent } from '../lib/format';
import type { Route } from '../lib/hashRouter';
import { useWallet } from '../state/wallet';

export function DashboardPage({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { info, rpcOffline, daemonOffline, daemonPending } = useWallet();
  const balance = usePolling(api.balance, 8_000, !rpcOffline);
  const history = usePolling(() => api.transactions(6), 15_000, !rpcOffline);
  const [selected, setSelected] = useState<TxRecord | null>(null);

  const sync = info?.sync;
  const balanceAtomic = balance.data?.balanceAtomic ?? info?.balance.balanceAtomic ?? null;
  const unlockedAtomic = balance.data?.unlockedAtomic ?? info?.balance.unlockedAtomic ?? null;
  const lockedAtomic = balance.data?.lockedAtomic ?? null;
  const transactions = history.data?.transactions ?? [];

  const syncTone = daemonOffline ? 'danger' : sync?.synchronized ? 'ok' : 'warn';

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-5">
      <div className="flex flex-col gap-4 lg:gap-5">
        <Card className="p-4 sm:p-6">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <p className="label-caps">Total balance</p>
              <div className="mt-2.5 flex flex-wrap items-baseline gap-2">
                {balanceAtomic === null ? (
                  <Skeleton className="h-10 w-56" />
                ) : (
                  <>
                    <span className="num break-all text-[30px] font-semibold leading-none tracking-tight text-ink sm:text-[40px]">
                      {formatXmr(balanceAtomic, { grouping: true })}
                    </span>
                    <span className="text-[14px] font-medium text-ink-dim">XMR</span>
                  </>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12.5px]">
                <span className="text-ink-muted">
                  Unlocked:{' '}
                  <span className="num text-ink">{unlockedAtomic === null ? '—' : `${formatXmr(unlockedAtomic)} XMR`}</span>
                </span>
                {lockedAtomic && lockedAtomic !== '0' ? (
                  <span className="inline-flex items-center gap-1.5 text-warn">
                    <Lock className="h-3.5 w-3.5" />
                    <span className="num">{formatXmr(lockedAtomic)} XMR</span> locked
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-[11.5px] text-ink-faint">USD value is hidden — no price API is configured.</p>
            </div>
            <StatusPill tone={syncTone} pulse={syncTone === 'warn'}>
              {daemonOffline ? 'Node offline' : sync?.synchronized ? 'Synced' : 'Syncing'}
            </StatusPill>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button variant="primary" onClick={() => onNavigate('send')} icon={<ArrowUpFromLine className="h-4 w-4" />}>
              Send
            </Button>
            <Button variant="secondary" onClick={() => onNavigate('receive')} icon={<ArrowDownToLine className="h-4 w-4" />}>
              Receive
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Recent Activity"
            description="Latest transfers known to this wallet"
            action={
              <Button size="sm" variant="ghost" onClick={() => onNavigate('transactions')}>
                View all
              </Button>
            }
          />
          {history.loading && transactions.length === 0 ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <TxList transactions={transactions} onSelect={setSelected} />
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:gap-5">
        <Card>
          <CardHeader title="Sync status" description="Wallet versus network height" />
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <p className="num text-[19px] font-semibold tracking-tight text-ink sm:text-[22px]">
              {formatNumber(sync?.walletHeight ?? null)}
              <span className="text-[13px] font-normal text-ink-dim sm:text-[15px]">
                {' '}
                / {formatNumber(sync?.daemonHeight ?? null)}
              </span>
            </p>
            <div className="mt-4">
              <ProgressBar value={sync?.progressPercent ?? null} tone={syncTone === 'ok' ? 'ok' : syncTone === 'warn' ? 'warn' : 'accent'} />
            </div>
            <div className="mt-3 flex items-center justify-between text-[12px]">
              <span className="text-ink-dim">Progress</span>
              <span className="num text-ink-muted">{percent(sync?.progressPercent ?? null)}</span>
            </div>
            <div className="mt-4 divide-y divide-line-soft border-t border-line-soft pt-1">
              <Row label="WALLET HEIGHT" value={formatNumber(sync?.walletHeight ?? null)} />
              <Row label="DAEMON HEIGHT" value={formatNumber(sync?.daemonHeight ?? null)} />
              <Row label="RPC VERSION" value={info?.rpc.version ?? '—'} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Node"
            description={info?.daemon.address ?? 'not configured'}
            action={
              <StatusPill tone={daemonOffline ? 'danger' : daemonPending ? 'neutral' : 'ok'}>
                {daemonPending ? 'checking…' : daemonOffline ? 'offline' : info?.daemon.status ?? 'online'}
              </StatusPill>
            }
          />
          <div className="divide-y divide-line-soft px-4 py-2 sm:px-5">
            <Row label="DAEMON" value={info?.daemon.address ?? '—'} />
            <Row label="LATENCY" value={info?.daemon.latencyMs !== null && info?.daemon.latencyMs !== undefined ? `${info.daemon.latencyMs} ms` : '—'} />
            <Row label="NETWORK HEIGHT" value={formatNumber(info?.daemon.height ?? null)} />
            <Row
              label="LAST CHECKED"
              value={info ? formatRelativeTime(Math.floor(info.fetchedAt / 1000)) || 'just now' : '—'}
            />
          </div>
          {daemonOffline ? (
            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              <p className="text-[12px] leading-relaxed text-ink-muted">
                {info?.daemon.error ?? 'The daemon did not answer.'} Configure a reachable node under Settings → Node.
              </p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => onNavigate('settings')}>
                Open Settings
              </Button>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Wallet" action={<Wallet className="h-4 w-4 text-ink-dim" />} />
          <div className="divide-y divide-line-soft px-4 py-2 sm:px-5">
            <Row label="NAME" value={info?.wallet?.name ?? '—'} />
            <Row label="NETWORK" value={info?.wallet?.network ?? '—'} />
            <Row label="PASSWORD" value="not stored in the browser" />
          </div>
        </Card>
      </div>

      <TxDetailsModal tx={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-[11px] uppercase tracking-[0.14em] text-ink-dim">{label}</span>
      <span className="num break-all text-[12.5px] text-ink-muted sm:truncate sm:text-right" title={value}>
        {value}
      </span>
    </div>
  );
}
