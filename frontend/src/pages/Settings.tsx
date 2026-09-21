import { Eye, EyeOff, Lock, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { ApiError, api } from '../api/client';
import { useToast } from '../components/Toast';
import { Alert, Button, Card, CardHeader, CopyButton, Input, KeyValue, Modal, StatusPill } from '../components/ui';
import { formatNumber, percent } from '../lib/format';
import { useWallet } from '../state/wallet';

export function SettingsPage({ onLock, locking }: { onLock: () => void; locking: boolean }) {
  const { info, reload, refreshWallet, refreshing, daemonPending } = useWallet();
  const { push } = useToast();

  const [daemonInput, setDaemonInput] = useState('');
  const [daemonBusy, setDaemonBusy] = useState(false);
  const [daemonError, setDaemonError] = useState<ApiError | null>(null);

  const [phraseOpen, setPhraseOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [phraseBusy, setPhraseBusy] = useState(false);
  const [phraseError, setPhraseError] = useState<ApiError | null>(null);
  const [phrase, setPhrase] = useState<string[] | null>(null);
  const [phraseVisible, setPhraseVisible] = useState(false);

  const applyDaemon = async () => {
    setDaemonBusy(true);
    setDaemonError(null);
    try {
      const result = await api.setDaemon(daemonInput.trim());
      setDaemonInput('');
      push({
        title: result.online ? 'Node updated' : 'Node address saved',
        description: result.note,
        tone: result.online ? 'success' : 'error',
      });
      await reload();
    } catch (caught) {
      setDaemonError(caught as ApiError);
    } finally {
      setDaemonBusy(false);
    }
  };

  const revealPhrase = async () => {
    setPhraseBusy(true);
    setPhraseError(null);
    try {
      const result = await api.revealPhrase(password);
      setPhrase(result.words);
      setPhraseVisible(true);
      setPassword('');
    } catch (caught) {
      setPhraseError(caught as ApiError);
      setPassword('');
      await reload();
    } finally {
      setPhraseBusy(false);
    }
  };

  const closePhraseDialog = () => {
    setPhraseOpen(false);
    setPhrase(null);
    setPassword('');
    setPhraseError(null);
    setPhraseVisible(false);
  };

  const daemonOffline = info?.daemon.online === false;

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-5">
      <Card>
        <CardHeader title="Wallet" description="Details of the currently open wallet" />
        <div className="divide-y divide-line-soft px-5 py-2">
          <KeyValue label="Wallet name">
            <span className="text-[13px] font-medium">{info?.wallet?.name ?? '—'}</span>
          </KeyValue>
          <KeyValue label="Network">
            <span>{info?.wallet?.network ?? '—'}</span>
          </KeyValue>
          <KeyValue label="Primary address">
            <span className="mono-address block max-w-[320px] text-right text-ink-muted">{info?.wallet?.address ?? '—'}</span>
          </KeyValue>
          <KeyValue label="Password storage">
            <span>memory only — never in localStorage</span>
          </KeyValue>
        </div>
        <div className="flex flex-col gap-2 px-4 pb-4 sm:flex-row sm:flex-wrap sm:px-5 sm:pb-5">
          <CopyButton value={info?.wallet?.address ?? ''} label="Copy Address" variant="secondary" />
          <Button
            variant="secondary"
            onClick={() =>
              void refreshWallet().catch(() => push({ title: 'Could not refresh the wallet', tone: 'error' }))
            }
            loading={refreshing}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Rescan / refresh
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Node"
          description="The Monero daemon this wallet synchronises with"
          action={
            <StatusPill tone={daemonOffline ? 'danger' : daemonPending ? 'neutral' : 'ok'}>
              {daemonPending ? 'checking…' : daemonOffline ? 'offline' : 'connected'}
            </StatusPill>
          }
        />
        <div className="divide-y divide-line-soft px-4 py-2 sm:px-5">
          <KeyValue label="Daemon address">
            <span className="font-mono text-[12px]">{info?.daemon.address ?? '—'}</span>
          </KeyValue>
          <KeyValue label="Connection status">
            <span className={daemonOffline ? 'text-danger' : 'text-ok'}>
              {daemonOffline
                ? info?.daemon.error ?? 'unreachable'
                : `${info?.daemon.status ?? 'online'} · ${info?.daemon.latencyMs ?? '—'} ms`}
            </span>
          </KeyValue>
          <KeyValue label="Wallet height">
            <span className="num">{formatNumber(info?.sync.walletHeight ?? null)}</span>
          </KeyValue>
          <KeyValue label="Daemon height">
            <span className="num">{formatNumber(info?.sync.daemonHeight ?? null)}</span>
          </KeyValue>
          <KeyValue label="Sync progress">
            <span className="num">
              {percent(info?.sync.progressPercent ?? null, 2)} {info?.sync.synchronized ? '(synced)' : ''}
            </span>
          </KeyValue>
        </div>
        <div className="flex flex-col gap-3 border-t border-line-soft px-4 py-4 sm:px-5">
          <Input
            label="Change daemon"
            value={daemonInput}
            onChange={(event) => setDaemonInput(event.target.value)}
            placeholder="host:port, e.g. 127.0.0.1:18081"
            hint="Applied through monero-wallet-rpc and saved to node-address.txt for the next launch."
            onKeyDown={(event) => {
              if (event.key === 'Enter' && daemonInput.trim().length > 0 && !daemonBusy) void applyDaemon();
            }}
          />
          {daemonError ? (
            <Alert tone="danger" title="Could not change the node">
              {daemonError.message}
              {daemonError.hint ? <p className="mt-1 text-ink-dim">{daemonError.hint}</p> : null}
            </Alert>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => void applyDaemon()}
            loading={daemonBusy}
            disabled={daemonInput.trim().length === 0}
          >
            Apply node address
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Security" description="Lock the session or back up the recovery phrase" />
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <p className="text-[13px] font-medium text-ink">Lock wallet</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
                Closes the wallet session on the backend and returns to the wallet selection screen.
              </p>
            </div>
            <Button
              variant="danger"
              onClick={onLock}
              loading={locking}
              icon={<Lock className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              Lock Wallet
            </Button>
          </div>
          <div className="divider" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <p className="text-[13px] font-medium text-ink">Backup recovery phrase</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
                Re-enter the wallet password to display the 25 word seed. It is never logged and never cached.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setPhraseOpen(true)}
              icon={<ShieldCheck className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              Show phrase
            </Button>
          </div>
          <Alert tone="warn" title="Keep the seed offline">
            Anyone who reads these 25 words can spend your funds. Never type them into a website and never keep them in a screenshot folder.
          </Alert>
        </div>
      </Card>

      <Card>
        <CardHeader title="About" />
        <div className="divide-y divide-line-soft px-4 py-2 sm:px-5">
          <KeyValue label="App version">
            <span className="num">{info?.app.version ?? '1.0.0'}</span>
          </KeyValue>
          <KeyValue label="Wallet RPC version">
            <span className="num">{info?.rpc.version ?? '—'}</span>
          </KeyValue>
          <KeyValue label="RPC endpoint">
            <span className="font-mono text-[12px]">127.0.0.1 (loopback only)</span>
          </KeyValue>
          <KeyValue label="Send mode">
            <span>
              {info?.app.sendMode === 'prepare' ? 'two-phase (prepare → confirm → relay)' : 'direct (confirm → send)'}
            </span>
          </KeyValue>
          <KeyValue label="Wallet directory">
            <span className="mono-address block max-w-[320px] text-right text-ink-muted">{info?.app.walletDir ?? '—'}</span>
          </KeyValue>
          <KeyValue label="Price API">
            <span>not configured — USD values hidden</span>
          </KeyValue>
        </div>
      </Card>

      <Modal
        open={phraseOpen}
        onClose={closePhraseDialog}
        title="Backup recovery phrase"
        description="Confirm the wallet password to display the seed words."
        footer={
          phrase ? (
            <>
              <Button
                variant="secondary"
                onClick={() => setPhraseVisible((current) => !current)}
                icon={phraseVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              >
                {phraseVisible ? 'Hide' : 'Reveal'}
              </Button>
              <CopyButton value={phrase.join(' ')} label="Copy phrase" variant="primary" size="md" />
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={closePhraseDialog} disabled={phraseBusy}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void revealPhrase()}
                loading={phraseBusy}
                disabled={password.length === 0}
              >
                Reveal phrase
              </Button>
            </>
          )
        }
      >
        {phrase ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-line bg-surface-sunken p-4">
              {phraseVisible ? (
                <ol className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                  {phrase.map((word, index) => (
                    <li key={`${word}-${index}`} className="flex items-baseline gap-2 text-[13px] text-ink">
                      <span className="num w-5 text-right text-[11px] text-ink-faint">{index + 1}.</span>
                      <span className="font-mono">{word}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-6 text-center text-[12.5px] text-ink-dim">The phrase is hidden.</p>
              )}
            </div>
            <Alert tone="warn" title="Write these words down now">
              Anyone with this phrase can access your funds.
            </Alert>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Input
              label="Wallet password"
              type="password"
              value={password}
              autoFocus
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && password.length > 0 && !phraseBusy) void revealPhrase();
              }}
              placeholder="••••••••"
            />
            {phraseError ? (
              <Alert tone="danger" title={phraseError.code === 'BAD_PASSWORD' ? 'Incorrect password' : 'Could not read the seed'}>
                {phraseError.message}
                {phraseError.hint ? <p className="mt-1 text-ink-dim">{phraseError.hint}</p> : null}
              </Alert>
            ) : (
              <Alert tone="info">
                <span className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 text-ink-dim" />
                  <span>
                    The wallet is reloaded from disk to verify the password. A wrong password locks the session and returns you to the
                    wallet selection screen.
                  </span>
                </span>
              </Alert>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
