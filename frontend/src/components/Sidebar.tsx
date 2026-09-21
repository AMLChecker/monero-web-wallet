import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  HeartHandshake,
  LayoutDashboard,
  RefreshCw,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';

import type { WalletInfo } from '../api/types';
import { formatNumber, percent, shortenAddress } from '../lib/format';
import type { Route } from '../lib/hashRouter';
import { MoneroLogo } from './MoneroLogo';
import { Button } from './ui';

const NAV: Array<{ route: Route; label: string; icon: typeof LayoutDashboard }> = [
  { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { route: 'send', label: 'Send', icon: ArrowUpFromLine },
  { route: 'receive', label: 'Receive', icon: ArrowDownToLine },
  { route: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { route: 'support', label: 'Support', icon: HeartHandshake },
  { route: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function Sidebar({
  route,
  navigate,
  info,
  onRefresh,
  refreshing,
  className = '',
  onClose,
}: {
  route: Route;
  navigate: (route: Route) => void;
  info: WalletInfo | null;
  onRefresh: () => void;
  refreshing: boolean;
  className?: string;
  onClose?: () => void;
}) {
  const rpcOnline = info?.rpc.online ?? false;
  const daemonOnline = info?.daemon.online ?? false;
  const sync = info?.sync;

  return (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-y-auto border-r border-line bg-[#0C0C0E] ${className}`}
    >
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <MoneroLogo className="h-7 w-7 shrink-0 text-accent" />
        <div className="min-w-0 leading-tight">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink">Monero</p>
          <p className="text-[11px] uppercase tracking-[0.16em] text-ink-dim">Wallet</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 text-ink-dim transition hover:bg-white/5 hover:text-ink"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav className="flex flex-col gap-0.5 px-2.5">
        {NAV.map((item) => {
          const active = route === item.route;
          const Icon = item.icon;
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => {
                navigate(item.route);
                onClose?.();
              }}
              className={`group relative flex items-center gap-2.5 rounded-xl px-3 py-3 text-left text-[13px] transition lg:py-2.5 ${
                active ? 'bg-white/[0.06] text-ink' : 'text-ink-muted hover:bg-white/[0.03] hover:text-ink'
              }`}
            >
              {active ? <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-accent" /> : null}
              <Icon className={`h-4 w-4 ${active ? 'text-accent' : 'text-ink-dim group-hover:text-ink-muted'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 px-4 pb-5 pt-6">
        <div className="rounded-xl border border-line bg-surface/70 p-3">
          <p className="label-caps">Wallet</p>
          <p className="mt-1.5 truncate text-[13px] font-medium text-ink">{info?.wallet?.name ?? '—'}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-ink-dim">
            {info?.wallet?.address ? shortenAddress(info.wallet.address, 10, 6) : 'not open'}
          </p>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-ink-dim">
            <span>Height</span>
            <span className="num text-ink-muted">{formatNumber(sync?.walletHeight ?? null)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-ink-dim">
            <span>Synced</span>
            <span className="num text-ink-muted">{percent(sync?.progressPercent ?? null)}</span>
          </div>
          <Button
            size="sm"
            variant="subtle"
            className="mt-3 w-full"
            onClick={onRefresh}
            loading={refreshing}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
        </div>

        <div className="space-y-1.5 px-1 text-[11.5px]">
          <StatusRow
            label="Node status"
            tone={daemonOnline ? 'ok' : 'danger'}
            value={daemonOnline ? info?.daemon.status ?? 'online' : 'offline'}
          />
          <StatusRow
            label="Wallet status"
            tone={rpcOnline ? (sync?.synchronized ? 'ok' : 'warn') : 'danger'}
            value={rpcOnline ? (sync?.synchronized ? 'synced' : 'syncing') : 'RPC offline'}
          />
        </div>
      </div>
    </aside>
  );
}

function StatusRow({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'warn' | 'danger' }) {
  const color = tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-danger';
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ink-dim">{label}</span>
      <span className="flex items-center gap-1.5 text-ink-muted">
        <span className={`h-1.5 w-1.5 rounded-full ${color} ${tone === 'warn' ? 'animate-pulse-soft' : ''}`} />
        {value}
      </span>
    </div>
  );
}
