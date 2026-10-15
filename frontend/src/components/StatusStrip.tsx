import { AlertTriangle, Lock, RefreshCw, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { useI18n } from '../i18n/I18nProvider';
import { useWallet } from '../state/wallet';
import { formatNumber, percent } from '../lib/format';
import { Button, StatusPill } from './ui';

export function NodePills({ compact = false }: { compact?: boolean }) {
  const { info, rpcOffline, daemonOffline, daemonPending } = useWallet();
  const { t } = useI18n();
  const sync = info?.sync;

  return (
    <div className="flex flex-wrap items-center gap-1.5 lg:justify-end lg:gap-2">
      <StatusPill tone={rpcOffline ? 'danger' : 'ok'} pulse={!rpcOffline && !sync?.synchronized}>
        {compact ? t('status.rpcShort') : t('status.walletRpc')} {rpcOffline ? t('common.offline') : t('common.online')}
      </StatusPill>
      <StatusPill tone={daemonOffline ? 'warn' : daemonPending ? 'neutral' : 'ok'}>
        {t('status.node')}{' '}
        {daemonPending
          ? t('common.checking')
          : daemonOffline
            ? t('common.unreachable')
            : `${formatNumber(info?.daemon.height ?? null, false)}`}
      </StatusPill>
      <StatusPill tone={sync?.synchronized ? 'ok' : 'warn'}>
        {sync?.synchronized
          ? t('common.synced')
          : t('status.syncingPercent', { percent: percent(sync?.progressPercent ?? null, compact ? 0 : 2) })}
      </StatusPill>
    </div>
  );
}

export function HeaderActions({ onLock, compact = false }: { onLock?: () => void; compact?: boolean }) {
  const { refreshWallet, refreshing } = useWallet();
  const { t } = useI18n();

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
          {compact ? <span className="sr-only">{t('status.lockWallet')}</span> : t('status.lock')}
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
        {compact ? <span className="sr-only">{t('status.syncNow')}</span> : t('status.syncNow')}
      </Button>
    </div>
  );
}

export function ServiceBanners() {
  const { info, rpcOffline, daemonOffline, error } = useWallet();
  const { t } = useI18n();

  if (error && rpcOffline) {
    return (
      <Banner
        tone="danger"
        icon={<WifiOff className="h-4 w-4" />}
        title={t('status.rpcOfflineTitle')}
        body={error.hint ?? t('status.rpcOfflineBody')}
      />
    );
  }
  if (daemonOffline) {
    return (
      <Banner
        tone="warn"
        icon={<AlertTriangle className="h-4 w-4" />}
        title={t('status.daemonUnavailableTitle')}
        body={t('status.daemonUnavailableBody', {
          address: info?.daemon.address ?? t('status.daemonFallback'),
        })}
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
