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
import type { TranslateFn } from '../i18n/types';
import { useI18n } from '../i18n/I18nProvider';
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

/** Monero makes a transaction spendable ten blocks after the one that mined it. */
const SPENDABLE_AFTER = 10;
/** Rough block time, used only for the "≈ n min" hint. */
const MINUTES_PER_BLOCK = 2;

export function txTitle(tx: TxRecord, t: TranslateFn): string {
  if (tx.failed) return t('tx.failed');
  if (tx.pending) return t('tx.pending');
  return tx.direction === 'received' ? t('tx.received') : t('tx.sent');
}

/**
 * A transfer to your own address looks like nothing happened: every output belongs to
 * this wallet, so monero-wallet-rpc reports an amount of 0 for it and the only money
 * that actually left is the fee. Say that instead of printing "-0.000000 XMR".
 */
export function isSelfTransfer(tx: TxRecord): boolean {
  if (tx.direction !== 'sent') return false;
  const amount = tx.amountAtomic.trim();
  return amount === '' || amount === '0' || /^0+$/.test(amount);
}

export function confirmationsOf(tx: TxRecord): number {
  return Math.max(0, Math.min(SPENDABLE_AFTER, tx.confirmations ?? 0));
}

/** The ten blocks a transaction needs before its outputs can be spent again. */
export function ConfirmationsMeter({
  count,
  locked,
  compact = false,
  className = '',
}: {
  count: number;
  locked: boolean;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const filled = Math.max(0, Math.min(SPENDABLE_AFTER, count));
  const tone = filled >= SPENDABLE_AFTER ? 'bg-ok' : locked ? 'bg-warn' : 'bg-accent';
  return (
    <span
      className={`inline-flex items-center ${compact ? 'gap-[3px]' : 'gap-1'} ${className}`}
      role="img"
      aria-label={t('tx.confirmationsAria', { filled, total: SPENDABLE_AFTER })}
    >
      {Array.from({ length: SPENDABLE_AFTER }, (_, index) => (
        <span
          key={index}
          className={`rounded-full ${compact ? 'h-1.5 w-1.5' : 'h-1.5 w-3'} ${
            index < filled ? tone : 'bg-white/[0.12]'
          }`}
        />
      ))}
    </span>
  );
}

function TxBadge({ tx }: { tx: TxRecord }) {
  const { t } = useI18n();
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
      {txTitle(tx, t)}
    </span>
  );
}

export function TxAmount({ tx }: { tx: TxRecord }) {
  const { t } = useI18n();
  if (isSelfTransfer(tx)) {
    return <span className="text-[12.5px] font-medium text-ink-muted">{t('tx.selfTransfer')}</span>;
  }
  const sign = tx.direction === 'received' ? '+' : '-';
  const color = tx.failed ? 'text-ink-faint line-through' : tx.direction === 'received' ? 'text-ok' : 'text-ink';
  return (
    <span className={`num text-[14px] font-medium ${color}`}>
      {sign} {formatXmrCompact(tx.amountAtomic)} <span className="text-[11.5px] text-ink-dim">{t('common.xmr')}</span>
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
            <span className="num">{confirmationsOf(tx)}/{SPENDABLE_AFTER}</span>
            <ConfirmationsMeter count={confirmationsOf(tx)} locked={tx.locked} compact />
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
          <span className="flex flex-col items-end gap-1">
            <span className="num">
              {confirmationsOf(tx)}/{SPENDABLE_AFTER}
            </span>
            <ConfirmationsMeter count={confirmationsOf(tx)} locked={tx.locked} compact />
          </span>
        </div>
        <div className="flex items-center justify-end">
          <span className="font-mono text-[11.5px] text-ink-muted">{shortenTxid(tx.txid)}</span>
        </div>
      </div>
    </button>
  );
}

export function TxList({ transactions, onSelect }: { transactions: TxRecord[]; onSelect: (tx: TxRecord) => void }) {
  const { t } = useI18n();
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<Clock className="h-6 w-6" />}
        title={t('tx.emptyTitle')}
        description={t('tx.emptyDesc')}
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
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  if (!tx) return null;

  const copyTxid = async () => {
    const ok = await copyText(tx.txid);
    setCopied(ok);
    push({ title: ok ? t('tx.copied') : t('tx.copyFailed'), tone: ok ? 'success' : 'error' });
  };

  const selfTransfer = isSelfTransfer(tx);
  const confirmations = confirmationsOf(tx);
  const blocksLeft = Math.max(0, SPENDABLE_AFTER - confirmations);

  return (
    <Modal
      open={Boolean(tx)}
      onClose={onClose}
      title={txTitle(tx, t)}
      description={formatDateTime(tx.timestamp)}
      size="lg"
      footer={<CopyButton value={tx.txid} label={t('tx.copyTxid')} />}
    >
      <div className="mb-4 rounded-xl border border-line bg-surface-sunken px-4 py-3 text-center">
        <p className="label-caps">{selfTransfer ? t('tx.selfTransfer') : t('tx.amount')}</p>
        {selfTransfer ? (
          <>
            <p className="mt-1 text-[15px] font-semibold text-ink sm:text-[16px]">
              {t('tx.selfTransferExplain')}
            </p>
            <p className="num mt-1 text-[11.5px] text-ink-dim">
              {tx.feeAtomic
                ? t('tx.selfFeeOnly', { fee: formatXmr(tx.feeAtomic) })
                : t('tx.selfFeeOnlyGeneric')}
            </p>
          </>
        ) : (
          <>
            <p
              className={`num mt-1 break-all text-[20px] font-semibold sm:text-[24px] ${
                tx.direction === 'received' ? 'text-ok' : 'text-ink'
              }`}
            >
              {tx.direction === 'received' ? '+' : '-'}
              {formatXmr(tx.amountAtomic)}{' '}
              <span className="text-[13px] font-normal text-ink-dim">{t('common.xmr')}</span>
            </p>
            {tx.feeAtomic && tx.direction === 'sent' ? (
              <p className="num mt-1 text-[11.5px] text-ink-dim">{t('tx.networkFeeAmount', { fee: formatXmr(tx.feeAtomic) })}</p>
            ) : null}
          </>
        )}
      </div>

      <div className="divide-y divide-line-soft">
        <KeyValue label={t('tx.status')}>
          <span className="inline-flex items-center gap-2">
            {tx.failed
              ? t('tx.statusFailed')
              : tx.pending
                ? t('tx.statusPending')
                : tx.confirmations && tx.confirmations >= 10
                  ? t('tx.statusConfirmed')
                  : t('tx.statusConfirmedLocked')}
          </span>
        </KeyValue>
        <KeyValue label={t('tx.confirmations')}>
          <span className="flex w-full flex-col items-start gap-2 sm:items-end">
            <span className="num">
              {confirmations} / {SPENDABLE_AFTER}
              {confirmations >= SPENDABLE_AFTER ? '' : tx.locked ? t('tx.lockedSuffix') : ''}
            </span>
            <ConfirmationsMeter count={confirmations} locked={tx.locked} />
          </span>
        </KeyValue>
        <KeyValue label={t('tx.blockHeight')}>
          <span className="num">{tx.height ?? t('tx.inPool')}</span>
        </KeyValue>
        <KeyValue label={tx.direction === 'sent' ? t('tx.recipient') : t('tx.receivedAt')}>
          {tx.address ? (
            <span className="mono-address block max-w-full text-left text-ink-muted sm:max-w-[380px] sm:text-right">{tx.address}</span>
          ) : (
            <span className="text-ink-dim">{t('common.emDash')}</span>
          )}
        </KeyValue>
        {tx.subaddressIndex !== null && tx.subaddressIndex > 0 ? (
          <KeyValue label={t('tx.subaddressIndex')}>
            <span className="num">#{tx.subaddressIndex}</span>
          </KeyValue>
        ) : null}
        {tx.paymentId ? (
          <KeyValue label={t('tx.paymentId')}>
            <span className="font-mono text-[11.5px]">{tx.paymentId}</span>
          </KeyValue>
        ) : null}
        {tx.note ? (
          <KeyValue label={t('tx.note')}>
            <span>{tx.note}</span>
          </KeyValue>
        ) : null}
        <KeyValue label={t('tx.unlock')}>
          {tx.locked ? (
            <span className="text-warn">
              {t('tx.unlockLocked', { count: SPENDABLE_AFTER })}
              {blocksLeft > 0
                ? t('tx.unlockBlocks', {
                    blocks: blocksLeft,
                    plural: blocksLeft === 1 ? '' : 's',
                    minutes: blocksLeft * MINUTES_PER_BLOCK,
                  })
                : ''}
            </span>
          ) : (
            <span className="text-ok">{t('tx.spendable')}</span>
          )}
        </KeyValue>
        <KeyValue label={t('tx.txid')}>
          <button
            type="button"
            onClick={copyTxid}
            className="group inline-flex max-w-full items-start gap-2 text-left font-mono text-[11.5px] text-ink-muted transition hover:text-ink sm:max-w-[420px] sm:text-right"
            title={t('tx.copyTxid')}
          >
            <span className="break-all">{tx.txid}</span>
            <Copy className={`h-3.5 w-3.5 shrink-0 ${copied ? 'text-ok' : 'text-ink-faint group-hover:text-ink-muted'}`} />
          </button>
        </KeyValue>
      </div>
    </Modal>
  );
}
