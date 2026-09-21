import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  Clock,
  Copy,
  Lock,
  Unlock,
} from 'lucide-react';
import { useState } from 'react';

import type { TxRecord } from '../api/types';
import { copyText } from '../lib/clipboard';
import {
  formatDateTime,
  formatXmr,
  formatXmrCompact,
  shortenAddress,
  shortenTxid,
} from '../lib/format';
import { useToast } from './Toast';
import { CopyButton, EmptyState, KeyValue, Modal } from './ui';

export function txTitle(tx: TxRecord): string {
  if (tx.failed) return 'Failed';
  if (tx.pending) return 'Pending';
  return tx.direction === 'received' ? 'Received' : 'Sent';
}

function TxBadge({ tx }: { tx: TxRecord }) {
  const styles = tx.failed
    ? 'border-danger/30 bg-danger/[0.08] text-danger'
    : tx.pending
      ? 'border-warn/30 bg-warn/[0.08] text-warn'
      : tx.direction === 'received'
        ? 'border-ok/25 bg-ok/[0.07] text-ok'
        : 'border-line bg-white/[0.04] text-ink-muted';
  const Icon = tx.failed ? Ban : tx.pending ? Clock : tx.direction === 'received' ? ArrowDownLeft : ArrowUpRight;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium ${styles}`}>
      <Icon className="h-3.5 w-3.5" />
      {txTitle(tx)}
    </span>
  );
}

export function TxAmount({ tx }: { tx: TxRecord }) {
  const sign = tx.direction === 'received' ? '+' : '-';
  const color = tx.failed ? 'text-ink-faint line-through' : tx.direction === 'received' ? 'text-ok' : 'text-ink';
  return (
    <span className={`num text-[14px] font-medium ${color}`}>
      {sign} {formatXmrCompact(tx.amountAtomic)} <span className="text-[11.5px] text-ink-dim">XMR</span>
    </span>
  );
}

export function TxRow({ tx, onSelect }: { tx: TxRecord; onSelect: (tx: TxRecord) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tx)}
      className="block w-full border-b border-line-soft px-4 py-3.5 text-left transition last:border-b-0 hover:bg-white/[0.02] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 lg:grid lg:grid-cols-[110px_1fr_140px_120px_120px] lg:items-center lg:gap-4 lg:px-5"
    >
      {/* Phones: compact two-column card */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <TxBadge tx={tx} />
          <TxAmount tx={tx} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[11.5px] text-ink-dim">
          <span className="num">{formatDateTime(tx.timestamp)}</span>
          <span className="inline-flex items-center gap-1.5">
            {tx.locked ? <Lock className="h-3.5 w-3.5 text-warn/80" /> : <Unlock className="h-3.5 w-3.5 text-ink-faint" />}
            <span className="num">{tx.confirmations ?? 0} conf.</span>
          </span>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-3">
          <span className="truncate text-[11.5px] text-ink-dim">
            {tx.address ? shortenAddress(tx.address, 14, 6) : tx.note ?? '—'}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-ink-muted">{shortenTxid(tx.txid)}</span>
        </div>
      </div>

      {/* Desktop: table row */}
      <div className="hidden lg:contents">
        <TxBadge tx={tx} />
        <div className="min-w-0">
          <p className="num text-[13px] text-ink">{formatDateTime(tx.timestamp)}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-ink-dim">
            {tx.address ? shortenAddress(tx.address, 12, 6) : tx.note ?? '—'}
          </p>
        </div>
        <div className="text-right">
          <TxAmount tx={tx} />
        </div>
        <div className="flex items-center justify-end gap-1.5 text-[11.5px] text-ink-dim">
          {tx.locked ? <Lock className="h-3.5 w-3.5 text-warn/80" /> : <Unlock className="h-3.5 w-3.5 text-ink-faint" />}
          <span className="num">{tx.confirmations ?? 0} conf.</span>
        </div>
        <div className="flex items-center justify-end">
          <span className="font-mono text-[11.5px] text-ink-muted">{shortenTxid(tx.txid)}</span>
        </div>
      </div>
    </button>
  );
}

export function TxList({ transactions, onSelect }: { transactions: TxRecord[]; onSelect: (tx: TxRecord) => void }) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="h-6 w-6" />}
        title="No transactions yet"
        description="Incoming and outgoing transfers appear here as soon as the wallet has synchronised with the network."
      />
    );
  }
  return (
    <div className="overflow-hidden">
      {transactions.map((tx) => (
        <TxRow key={`${tx.txid}-${tx.status}`} tx={tx} onSelect={onSelect} />
      ))}
    </div>
  );
}

export function TxDetailsModal({ tx, onClose }: { tx: TxRecord | null; onClose: () => void }) {
  const { push } = useToast();
  const [copied, setCopied] = useState(false);

  if (!tx) return null;

  const copyTxid = async () => {
    const ok = await copyText(tx.txid);
    setCopied(ok);
    push({ title: ok ? 'Transaction id copied' : 'Could not copy', tone: ok ? 'success' : 'error' });
  };

  return (
    <Modal
      open={Boolean(tx)}
      onClose={onClose}
      title={txTitle(tx)}
      description={formatDateTime(tx.timestamp)}
      size="lg"
      footer={<CopyButton value={tx.txid} label="Copy transaction id" />}
    >
      <div className="mb-4 rounded-xl border border-line bg-surface-sunken px-4 py-3 text-center">
        <p className="label-caps">Amount</p>
        <p
          className={`num mt-1 break-all text-[20px] font-semibold sm:text-[24px] ${
            tx.direction === 'received' ? 'text-ok' : 'text-ink'
          }`}
        >
          {tx.direction === 'received' ? '+' : '-'}
          {formatXmr(tx.amountAtomic)}{' '}
          <span className="text-[13px] font-normal text-ink-dim">XMR</span>
        </p>
        {tx.feeAtomic && tx.direction === 'sent' ? (
          <p className="num mt-1 text-[11.5px] text-ink-dim">Network fee {formatXmr(tx.feeAtomic)} XMR</p>
        ) : null}
      </div>

      <div className="divide-y divide-line-soft">
        <KeyValue label="Status">
          <span className="inline-flex items-center gap-2">
            {tx.failed ? 'Failed' : tx.pending ? 'Pending confirmation' : tx.confirmations && tx.confirmations >= 10 ? 'Confirmed' : 'Confirmed (locked)'}
          </span>
        </KeyValue>
        <KeyValue label="Confirmations">
          <span className="num">{tx.confirmations ?? 0}</span>
        </KeyValue>
        <KeyValue label="Block height">
          <span className="num">{tx.height ?? 'in pool'}</span>
        </KeyValue>
        <KeyValue label={tx.direction === 'sent' ? 'Recipient' : 'Received at'}>
          {tx.address ? (
            <span className="mono-address block max-w-full text-left text-ink-muted sm:max-w-[380px] sm:text-right">{tx.address}</span>
          ) : (
            <span className="text-ink-dim">—</span>
          )}
        </KeyValue>
        {tx.subaddressIndex !== null && tx.subaddressIndex > 0 ? (
          <KeyValue label="Subaddress index">
            <span className="num">#{tx.subaddressIndex}</span>
          </KeyValue>
        ) : null}
        {tx.paymentId ? (
          <KeyValue label="Payment id">
            <span className="font-mono text-[11.5px]">{tx.paymentId}</span>
          </KeyValue>
        ) : null}
        {tx.note ? (
          <KeyValue label="Note">
            <span>{tx.note}</span>
          </KeyValue>
        ) : null}
        <KeyValue label="Unlock">
          {tx.locked ? (
            <span className="text-warn">Locked — spendable after about 10 confirmations</span>
          ) : (
            <span className="text-ok">Spendable</span>
          )}
        </KeyValue>
        <KeyValue label="Transaction id">
          <button
            type="button"
            onClick={copyTxid}
            className="group inline-flex max-w-full items-start gap-2 text-left font-mono text-[11.5px] text-ink-muted transition hover:text-ink sm:max-w-[420px] sm:text-right"
            title="Copy transaction id"
          >
            <span className="break-all">{tx.txid}</span>
            <Copy className={`h-3.5 w-3.5 shrink-0 ${copied ? 'text-ok' : 'text-ink-faint group-hover:text-ink-muted'}`} />
          </button>
        </KeyValue>
      </div>
    </Modal>
  );
}
