import { ArrowRight, CheckCircle2, Info, Send as SendIcon, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ApiError, api } from '../api/client';
import { useToast } from '../components/Toast';
import { Alert, Button, Card, CardHeader, CopyButton, Input, Modal, Segmented, Skeleton } from '../components/ui';
import type { AddressValidation, PreparedSend, SentTransaction } from '../api/types';
import { usePolling } from '../hooks/useApi';
import { formatXmr, isValidAmountInput, shortenAddress } from '../lib/format';
import type { Route } from '../lib/hashRouter';
import { useWallet } from '../state/wallet';

/**
 * Network priority is pinned to "Low" (0), the cheapest fee the daemon accepts, and
 * the send form deliberately shows no control for it: four levels whose real cost
 * only appears after the fee is calculated are a decision most people cannot judge.
 * The API still accepts 0-3, so integrations can opt into another level.
 */
const NETWORK_PRIORITY = 0;

/** Optional support for the project: off by default, always shown in the review dialog. */
const SUPPORT_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 0.5, label: '0.5%' },
  { value: 1, label: '1%' },
];

export function SendPage({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { info, rpcOffline, daemonOffline } = useWallet();
  const { push } = useToast();
  const balance = usePolling(api.balance, 10_000, !rpcOffline);

  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [supportPercent, setSupportPercent] = useState(0);
  const [validation, setValidation] = useState<AddressValidation | null>(null);
  const [prepared, setPrepared] = useState<PreparedSend | null>(null);
  const [sent, setSent] = useState<SentTransaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const unlocked = balance.data?.unlockedAtomic ?? info?.balance.unlockedAtomic ?? null;
  const amountValid = isValidAmountInput(amount);
  const addressLooksValid = address.trim().length >= 90;

  useEffect(() => {
    const trimmed = address.trim();
    if (trimmed.length < 90) {
      setValidation(null);
      return;
    }
    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.validateAddress(trimmed);
        if (active) setValidation(result);
      } catch {
        if (active) setValidation(null);
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [address]);

  const addressError =
    addressLooksValid && validation && !validation.valid ? 'This is not a valid Monero address for mainnet.' : undefined;
  const canReview = addressLooksValid && amountValid && !busy && !rpcOffline && !daemonOffline;

  const review = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.prepareSend({
        address: address.trim(),
        amount: amount.trim(),
        priority: NETWORK_PRIORITY,
        supportPercent,
      });
      setPrepared(result);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!prepared) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.send(prepared.prepareId);
      setSent(result);
      setPrepared(null);
      push({ title: 'Transaction broadcast', description: 'It stays pending until the network mines it.', tone: 'success' });
    } catch (caught) {
      const apiError = caught as ApiError;
      setError(apiError);
      if (apiError.code === 'TX_EXPIRED') setPrepared(null);
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    if (prepared) void api.cancelSend(prepared.prepareId).catch(() => undefined);
    setPrepared(null);
  };

  const reset = () => {
    setSent(null);
    setAddress('');
    setAmount('');
    setSupportPercent(0);
    setValidation(null);
    setError(null);
  };

  if (sent) {
    return (
      <Card className="mx-auto w-full max-w-[620px] p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ok/30 bg-ok/10">
            <CheckCircle2 className="h-5 w-5 text-ok" />
          </span>
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight text-ink">Transaction sent</h1>
            <p className="text-[12.5px] text-ink-muted">Your wallet signed and broadcast this transfer to the network.</p>
          </div>
        </div>

        <div className="mt-6 divide-y divide-line-soft rounded-xl border border-line bg-surface-sunken px-4 py-1">
          <Recap label="Amount" value={`${formatXmr(sent.amountAtomic)} XMR`} />
          <Recap label="Network fee" value={sent.feeAtomic ? `${formatXmr(sent.feeAtomic)} XMR` : '—'} />
          {sent.support?.enabled ? (
            <Recap
              label={`Support (optional, ${sent.support.percent}%)`}
              value={`${formatXmr(sent.support.amountAtomic)} XMR → ${shortenAddress(sent.support.address ?? '', 8, 6)}`}
            />
          ) : null}
          <Recap label="Recipient" value={shortenAddress(sent.address, 16, 10)} mono />
          <Recap label="Transaction id" value={sent.txHash} mono />
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <CopyButton value={sent.txHash} label="Copy TXID" variant="secondary" />
          <Button variant="primary" onClick={reset}>
            New transaction
          </Button>
          <Button variant="ghost" onClick={() => onNavigate('transactions')}>
            View transactions
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-5">
        <Card>
          <CardHeader title="Send Monero" description="Transactions are signed locally and broadcast through your node." />
          <div className="flex flex-col gap-4 px-5 py-5">
            <Input
              label="Recipient address"
              value={address}
              mono
              placeholder="4..."
              onChange={(event) => setAddress(event.target.value.trim())}
              error={addressError}
              hint={
                validation && validation.valid ? (
                  <span className="text-ok">
                    Valid {validation.subaddress ? 'subaddress' : validation.integrated ? 'integrated address' : 'address'} (
                    {validation.nettype || 'mainnet'})
                  </span>
                ) : (
                  'Paste the full Monero address of the recipient.'
                )
              }
            />

            <Input
              label="Amount"
              value={amount}
              inputMode="decimal"
              placeholder="0.000000"
              onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ''))}
              suffix={
                <>
                  <span className="pr-1">XMR</span>
                  <button
                    type="button"
                    className="rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-accent-soft transition hover:bg-accent/10"
                    onClick={() => unlocked && setAmount(formatXmr(unlocked))}
                    disabled={!unlocked}
                  >
                    MAX
                  </button>
                </>
              }
              hint="Leave room for the network fee when you spend the full balance."
            />

            <div>
              <p className="mb-1.5 text-[12.5px] font-medium text-ink-muted">Support the project (optional)</p>
              <Segmented
                value={supportPercent}
                options={SUPPORT_OPTIONS}
                onChange={setSupportPercent}
              />
              <p className="mt-1.5 text-[12px] leading-snug text-ink-dim">
                Off by default. If you turn it on, the exact amount and the developer address are shown in the
                confirmation dialog before anything is signed — you can always switch it back to “Off”.
              </p>
            </div>

            {error ? (
              <Alert
                tone="danger"
                title={error.code === 'INSUFFICIENT_FUNDS' ? 'Not enough spendable balance' : 'Transaction not created'}
              >
                {error.message}
                {error.hint ? <p className="mt-1 text-ink-dim">{error.hint}</p> : null}
              </Alert>
            ) : null}

            {daemonOffline ? (
              <Alert tone="warn" title="Daemon unavailable">
                A Monero node is required to build and broadcast transactions. Configure a reachable node in Settings.
              </Alert>
            ) : null}

            <Button
              variant="primary"
              size="lg"
              onClick={() => void review()}
              loading={busy}
              disabled={!canReview}
              icon={<SendIcon className="h-4 w-4" />}
            >
              Review transaction
            </Button>
          </div>
        </Card>

        <div className="flex flex-col gap-4 lg:gap-5">
          <Card>
            <CardHeader title="Available balance" />
            <div className="px-5 py-5">
              {unlocked === null ? (
                <Skeleton className="h-8 w-40" />
              ) : (
                <p className="num text-[26px] font-semibold tracking-tight text-ink">
                  {formatXmr(unlocked, { grouping: true })}{' '}
                  <span className="text-[13px] font-normal text-ink-dim">XMR</span>
                </p>
              )}
              <p className="mt-2 text-[12px] text-ink-dim">
                {balance.data?.blocksToUnlock
                  ? `${balance.data.blocksToUnlock} blocks until recently received funds unlock.`
                  : 'Only unlocked outputs can be spent.'}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Before you send" />
            <div className="flex flex-col gap-3 px-5 py-4 text-[12px] leading-relaxed text-ink-muted">
              <span className="flex items-start gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-dim" />
                Monero transfers cannot be reversed. Check the address twice.
              </span>
              <span className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn/80" />
                {info?.sync.synchronized
                  ? 'Your wallet is synced with the network.'
                  : 'Your wallet is still syncing — the balance shown may be incomplete.'}
              </span>
              <span className="flex items-start gap-2">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-dim" />
                Nothing is broadcast until you confirm the review dialog.
              </span>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(prepared)}
        onClose={cancel}
        title="Confirm transaction"
        description="Review the amount and fee that the wallet will sign."
        footer={
          <>
            <Button variant="ghost" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void confirm()} loading={busy}>
              Confirm &amp; Send
            </Button>
          </>
        }
      >
        {prepared ? (
          <div className="flex flex-col gap-4">
            <div className="divide-y divide-line-soft rounded-xl border border-line bg-surface-sunken px-4 py-1">
              <Recap label="Recipient" value={shortenAddress(prepared.address, 18, 12)} mono />
              <Recap label="Amount" value={`${formatXmr(prepared.amountAtomic)} XMR`} />
              <Recap
                label={prepared.feeEstimated ? 'Estimated fee' : 'Network fee'}
                value={prepared.feeAtomic ? `${formatXmr(prepared.feeAtomic)} XMR` : 'Calculated at send time'}
              />
              {prepared.support.enabled ? (
                <Recap
                  label={`Support (optional, ${prepared.support.percent}%)`}
                  value={`${formatXmr(prepared.support.amountAtomic)} XMR → ${shortenAddress(prepared.support.address ?? '', 8, 6)}`}
                />
              ) : null}
              <Recap label="Total" value={prepared.totalAtomic ? `${formatXmr(prepared.totalAtomic)} XMR` : '—'} emphasis />
            </div>
            {supportPercent > 0 && !prepared.support.enabled ? (
              <Alert tone="info">
                The support amount for this transfer is below one atomic unit, so nothing extra will be sent. Increase
                the amount or switch support to “Off”.
              </Alert>
            ) : null}
            <Alert tone="warn">This transfer is broadcast to the Monero network and cannot be reversed.</Alert>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function Recap({
  label,
  value,
  mono = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <span className="text-[12px] text-ink-dim">{label}</span>
      <span
        className={`break-all text-[13px] sm:text-right ${mono ? 'font-mono text-[12px]' : 'num text-[13px]'} ${
          emphasis ? 'font-semibold text-ink' : 'text-ink-muted'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
