import { AlertTriangle, Lock, RefreshCw, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { useWallet } from '../state/wallet';
import { formatNumber, percent } from '../lib/format';
import { Button, StatusPill } from './ui';

export function NodePills({ compact = false }: { compact?: boolean }) {
  const { info, rpcOffline, daemonOffline, daemonPending } = useWallet();
  const sync = info?.sync;

  return (
    <div className="flex flex-wrap items-center gap-1.5 lg:justify-end lg:gap-2">
      <StatusPill tone={rpcOffline ? 'danger' : 'ok'} pulse={!rpcOffline && !sync?.synchronized}>
        {compact ? 'RPC' : 'Wallet RPC'} {rpcOffline ? 'offline' : 'online'}
      </StatusPill>
      <StatusPill tone={daemonOffline ? 'warn' : daemonPending ? 'neutral' : 'ok'}>
        Node{' '}
        {daemonPending ? 'checking…' : daemonOffline ? 'unreachable' : `${formatNumber(info?.daemon.height ?? null, false)}`}
      </StatusPill>
      <StatusPill tone={sync?.synchronized ? 'ok' : 'warn'}>
        {sync?.synchronized ? 'Synced' : `Syncing ${percent(sync?.progressPercent ?? null, compact ? 0 : 2)}`}
      </StatusPill>
    </div>
  );
}

export function HeaderActions({ onLock, compact = false }: { onLock?: () => void; compact?: boolean }) {
  const { refreshWallet, refreshing } = useWallet();

  return (
    <div className="flex shrink-0 items-center gap-1.5 lg:gap-2">
      {onLock ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={onLock}
          className={compact ? 'px-2.5' : undefined}
          icon={<Lock className="h-3.5 w-3.5" />}
        >
          {compact ? <span className="sr-only">Lock wallet</span> : 'Lock'}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => void refreshWallet().catch(() => undefined)}
        loading={refreshing}
        className={compact ? 'px-2.5' : undefined}
        icon={<RefreshCw className="h-3.5 w-3.5" />}
      >
        {compact ? <span className="sr-only">Sync now</span> : 'Sync now'}
      </Button>
    </div>
  );
}

export function ServiceBanners() {
  const { info, rpcOffline, daemonOffline, error } = useWallet();

  if (error && rpcOffline) {
    return (
      <Banner
        tone="danger"
        icon={<WifiOff className="h-4 w-4" />}
        title="Wallet RPC Offline"
        body={error.hint ?? 'monero-wallet-rpc is not answering on 127.0.0.1. Start the wallet with Start.bat.'}
      />
    );
  }
  if (daemonOffline) {
    return (
      <Banner
        tone="warn"
        icon={<AlertTriangle className="h-4 w-4" />}
        title="Daemon unavailable"
        body={`${info?.daemon.address ?? 'The node'} did not answer. The wallet cannot synchronise or broadcast until a reachable node is configured in Settings.`}
      />
    );
  }
  return null;
}

function Banner({
  tone,
  icon,
  title,
  body,
}: {
  tone: 'danger' | 'warn';
  icon: ReactNode;
  title: string;
  body: string;
}) {
  const styles =
    tone === 'danger' ? 'border-danger/30 bg-danger/[0.07] text-danger' : 'border-warn/25 bg-warn/[0.06] text-warn';
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${styles}`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-[13px] font-medium">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{body}</p>
      </div>
    </div>
  );
}
