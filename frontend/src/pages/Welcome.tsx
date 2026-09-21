import { ChevronRight, KeyRound, Plus, WifiOff } from 'lucide-react';
import { useState } from 'react';

import { ApiError, api } from '../api/client';
import { MoneroLogo } from '../components/MoneroLogo';
import { useToast } from '../components/Toast';
import { Alert, Button, Card, Input, Modal, StatusPill } from '../components/ui';
import { useWalletList } from '../hooks/useApi';
import { shortenAddress } from '../lib/format';
import type { Route } from '../lib/hashRouter';
import { useWallet } from '../state/wallet';

export function WelcomePage({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { info, reload } = useWallet();
  const { data: list, reload: reloadList } = useWalletList();
  const { push } = useToast();

  const [openDialog, setOpenDialog] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const wallets = list?.wallets ?? [];
  const rpcOnline = info?.rpc.online ?? false;
  const daemonOnline = info?.daemon.online ?? false;

  const startOpen = (walletName?: string) => {
    setName(walletName ?? wallets[0]?.name ?? '');
    setPassword('');
    setError(null);
    setOpenDialog(true);
  };

  const submitOpen = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.openWallet(name.trim(), password);
      setPassword('');
      setOpenDialog(false);
      push({ title: `Wallet "${name.trim()}" opened`, tone: 'success' });
      onNavigate('dashboard');
      await Promise.all([reload(), reloadList()]);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setBusy(false);
      setPassword('');
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-[460px] animate-fade-in">
        <div className="mb-5 flex items-center justify-center gap-2.5">
          <MoneroLogo className="h-9 w-9 text-accent" />
          <div className="text-center">
            <p className="text-[13px] font-semibold uppercase tracking-[0.28em] text-ink">Monero</p>
            <p className="text-[10.5px] uppercase tracking-[0.28em] text-ink-dim">Wallet</p>
          </div>
        </div>

        <Card className="p-5 sm:p-6">
          <div className="text-center">
            <h1 className="text-[22px] font-semibold tracking-tight text-ink">Your private Monero wallet</h1>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
              Keys stay on this computer. Every action is signed by the official monero-wallet-rpc running on 127.0.0.1.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <StatusPill tone={rpcOnline ? 'ok' : 'danger'}>Wallet RPC {rpcOnline ? 'online' : 'offline'}</StatusPill>
            <StatusPill tone={daemonOnline ? 'ok' : 'warn'}>Node {daemonOnline ? 'reachable' : 'unreachable'}</StatusPill>
          </div>

          {!rpcOnline ? (
            <Alert tone="danger" title="Wallet RPC Offline" className="mt-5">
              <span className="flex items-start gap-2">
                <WifiOff className="mt-0.5 h-3.5 w-3.5" />
                <span>{info?.daemon.error ?? 'monero-wallet-rpc is not answering. Start the wallet with Start.bat and try again.'}</span>
              </span>
            </Alert>
          ) : null}

          {wallets.length > 0 ? (
            <div className="mt-5 rounded-xl border border-line bg-surface-sunken">
              <p className="label-caps px-4 pt-3.5">Existing wallet found</p>
              <div className="mt-1.5 divide-y divide-line-soft">
                {wallets.map((wallet) => (
                  <div
                    key={wallet.name}
                    className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium text-ink">{wallet.name}</p>
                      <p className="mt-0.5 text-[11.5px] text-ink-dim">
                        {wallet.name}.keys · {wallet.modifiedAt ? new Date(wallet.modifiedAt).toLocaleDateString() : 'unknown date'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={wallets.length === 1 ? 'primary' : 'secondary'}
                      onClick={() => startOpen(wallet.name)}
                      disabled={!rpcOnline}
                      icon={<KeyRound className="h-3.5 w-3.5" />}
                      className="w-full sm:w-auto"
                    >
                      Open {wallet.name}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-2">
            <Button variant="primary" size="lg" onClick={() => startOpen()} disabled={!rpcOnline || wallets.length === 0}>
              Open Wallet
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => onNavigate('create')}
              disabled={!rpcOnline}
              icon={<Plus className="h-4 w-4" />}
            >
              Create New Wallet
            </Button>
          </div>

          {list ? (
            <p className="mt-4 truncate text-center text-[11px] text-ink-faint" title={list.walletDir}>
              Wallet directory: {shortenAddress(list.walletDir, 22, 14)}
            </p>
          ) : null}
        </Card>

        <p className="mt-5 text-center text-[11.5px] leading-relaxed text-ink-faint">
          The wallet password is never stored in the browser and never written to logs.
        </p>
      </div>

      <Modal
        open={openDialog}
        onClose={() => {
          setOpenDialog(false);
          setPassword('');
        }}
        title="Open wallet"
        description="Provide the Monero wallet file name and its password."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenDialog(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void submitOpen()}
              loading={busy}
              disabled={name.trim().length === 0 || password.length === 0}
            >
              Open wallet
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {wallets.length > 1 ? (
            <div className="flex flex-col gap-1">
              <span className="text-[12.5px] font-medium text-ink-muted">Wallet file</span>
              {wallets.map((wallet) => (
                <button
                  key={wallet.name}
                  type="button"
                  onClick={() => setName(wallet.name)}
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition ${
                    name === wallet.name ? 'border-accent/50 bg-accent/[0.07]' : 'border-line bg-surface-sunken hover:border-line/70'
                  }`}
                >
                  <span className="text-[13px] text-ink">{wallet.name}</span>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </button>
              ))}
            </div>
          ) : (
            <Input label="Wallet file" value={name} onChange={(event) => setName(event.target.value)} placeholder="main" />
          )}
          <Input
            label="Wallet password"
            type="password"
            value={password}
            autoFocus
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && password.length > 0 && !busy) void submitOpen();
            }}
            placeholder="••••••••"
          />
          {error ? (
            <Alert tone="danger" title={error.code === 'BAD_PASSWORD' ? 'Incorrect password' : 'Could not open the wallet'}>
              {error.message}
              {error.hint ? <p className="mt-1 text-ink-dim">{error.hint}</p> : null}
            </Alert>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
