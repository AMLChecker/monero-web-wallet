import { CheckCircle2, HeartHandshake, Info, PartyPopper, Send as SendIcon } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { ApiError, api } from '../api/client';
import type { PreparedSend, ProjectSupport, SentTransaction } from '../api/types';
import { useToast } from '../components/Toast';
import { Alert, Button, Card, CardHeader, CopyButton, Input, Modal, Skeleton } from '../components/ui';
import { formatXmr, isValidAmountInput, shortenAddress } from '../lib/format';
import type { Route } from '../lib/hashRouter';
import { useI18n } from '../i18n/I18nProvider';
import { useWallet } from '../state/wallet';

/**
 * Voluntary donation to the developer of this wallet.
 *
 * Two rules make this page different from the Send page:
 *  - no support percentage is added on top of a donation (it would be a fee on a gift),
 *  - nothing is hidden, so the exact network fee and the total are shown before signing.
 */
const PRESETS = ['0.01', '0.05', '0.1', '0.5'];
const NETWORK_PRIORITY = 0;

export function SupportPage({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { info, rpcOffline, daemonOffline } = useWallet();
  const { push } = useToast();
  const { t } = useI18n();

  const [support, setSupport] = useState<ProjectSupport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amount, setAmount] = useState(PRESETS[0]);
  const [prepared, setPrepared] = useState<PreparedSend | null>(null);
  const [sent, setSent] = useState<SentTransaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let active = true;
    api
      .support()
      .then((result) => {
        if (active) setSupport(result);
      })
      .catch((caught) => {
        if (!active) return;
        const apiError = caught as ApiError;
        // A backend started before this page existed has no /api/support route yet.
        setLoadError(
          apiError.status === 404 ? t('support.backendMissing') : apiError.message,
        );
      });
    return () => {
      active = false;
    };
  }, []);

  const address = support?.address ?? '';
  const unlocked = info?.balance.unlockedAtomic ?? null;
  const walletEmpty = unlocked !== null && BigInt(unlocked) === 0n;
  const amountValid = isValidAmountInput(amount);
  const canReview = address.length > 0 && amountValid && !busy && !rpcOffline && !daemonOffline;

  const review = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.prepareSend({
        address,
        amount: amount.trim(),
        priority: NETWORK_PRIORITY,
        supportPercent: 0,
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
      push({ title: t('support.thankYouToast'), description: t('support.thankYouToastDesc'), tone: 'success' });
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

  if (sent) {
    return (
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-5">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-ok/30 bg-ok/10">
              <PartyPopper className="h-5 w-5 text-ok" />
            </span>
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight text-ink">{t('support.sentTitle')}</h1>
              <p className="text-[12.5px] text-ink-muted">
                {t('support.sentSubtitle')}
              </p>
            </div>
          </div>

          <p className="mt-5 text-[13px] leading-relaxed text-ink-muted">
            {t('support.sentBody')}
          </p>

          <div className="mt-6 divide-y divide-line-soft rounded-xl border border-line bg-surface-sunken px-4 py-1">
            <Recap label={t('support.donation')} value={`${formatXmr(sent.amountAtomic)} XMR`} />
            <Recap label={t('support.networkFee')} value={sent.feeAtomic ? `${formatXmr(sent.feeAtomic)} XMR` : t('common.emDash')} />
            <Recap label={t('support.sentTo')} value={shortenAddress(sent.address, 16, 10)} mono />
            <Recap label={t('support.txid')} value={sent.txHash} mono />
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <CopyButton value={sent.txHash} label={t('support.copyTxid')} variant="secondary" />
            <Button variant="primary" onClick={() => setSent(null)}>
              {t('support.donateAgain')}
            </Button>
            <Button variant="ghost" onClick={() => onNavigate('transactions')}>
              {t('support.viewTx')}
            </Button>
          </div>
        </Card>

        <div className="flex flex-col gap-4 lg:gap-5">
          <Card>
            <CardHeader title={t('support.addressTitle')} description={t('support.addressDescAlt')} />
            <div className="px-5 py-5">
              <AddressBlock address={address} />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-5">
        <Card>
          <CardHeader
            title={t('support.formTitle')}
            description={t('support.formDesc')}
          />
          <div className="flex flex-col gap-4 px-5 py-5">
            <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-sunken px-3.5 py-3">
              <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <p className="text-[12.5px] leading-relaxed text-ink-muted">
                {t('support.intro')}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-[12.5px] font-medium text-ink-muted">{t('support.amount')}</p>
              <div className="mb-2 flex flex-wrap gap-2">
                {PRESETS.map((preset) => {
                  const active = amount.trim() === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(preset)}
                      className={`num rounded-xl border px-3 py-1.5 text-[12.5px] font-medium transition ${
                        active
                          ? 'border-accent/35 bg-accent/[0.12] text-ink'
                          : 'border-line bg-surface-sunken text-ink-dim hover:text-ink-muted'
                      }`}
                    >
                      {t('support.preset', { amount: preset })}
                    </button>
                  );
                })}
              </div>
              <Input
                label={t('support.customAmount')}
                value={amount}
                inputMode="decimal"
                placeholder="0.000000"
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ''))}
                suffix={<span className="pr-1">XMR</span>}
                hint={t('support.customHint')}
              />
            </div>

            <Alert tone="info" title={t('support.noCommissionTitle')}>
              {t('support.noCommissionBody')}
            </Alert>

            {walletEmpty ? (
              <Alert tone="warn" title={t('support.emptyTitle')}>
                {t('support.emptyBody')}
              </Alert>
            ) : null}

            {daemonOffline ? (
              <Alert tone="warn" title={t('support.daemonUnavailableTitle')}>
                {t('support.daemonUnavailableBody')}
              </Alert>
            ) : null}

            {loadError ? (
              <Alert tone="danger" title={t('support.addressUnavailable')}>
                {loadError}
              </Alert>
            ) : null}

            {error ? (
              <Alert
                tone="danger"
                title={error.code === 'INSUFFICIENT_FUNDS' ? t('support.insufficientFunds') : t('support.notCreated')}
              >
                {error.message}
                {error.hint ? <p className="mt-1 text-ink-dim">{error.hint}</p> : null}
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
              {t('support.review')}
            </Button>
          </div>
        </Card>

        <div className="flex flex-col gap-4 lg:gap-5">
          <Card>
            <CardHeader title={t('support.addressCardTitle')} description={t('support.addressCardDesc')} />
            <div className="px-5 py-5">
              {support === null && !loadError ? (
                <div className="space-y-3">
                  <Skeleton className="mx-auto h-[200px] w-[200px] rounded-2xl" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : (
                <AddressBlock address={address} />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={t('support.paysForTitle')} />
            <ul className="flex flex-col gap-2.5 px-5 py-4 text-[12px] leading-relaxed text-ink-muted">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok/80" />
                {t('support.pays1')}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok/80" />
                {t('support.pays2')}
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok/80" />
                {t('support.pays3')}
              </li>
              <li className="flex items-start gap-2">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-dim" />
                {t('support.pays4')}
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(prepared)}
        onClose={cancel}
        title={t('support.confirmTitle')}
        description={t('support.confirmDesc')}
        footer={
          <>
            <Button variant="ghost" onClick={cancel} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void confirm()} loading={busy}>
              {t('support.confirmDonate')}
            </Button>
          </>
        }
      >
        {prepared ? (
          <div className="flex flex-col gap-4">
            <div className="divide-y divide-line-soft rounded-xl border border-line bg-surface-sunken px-4 py-1">
              <Recap label={t('support.developerAddress')} value={shortenAddress(prepared.address, 18, 12)} mono />
              <Recap label={t('support.donation')} value={`${formatXmr(prepared.amountAtomic)} XMR`} emphasis />
              <Recap
                label={prepared.feeEstimated ? t('support.estimatedFee') : t('support.networkFee')}
                value={prepared.feeAtomic ? `${formatXmr(prepared.feeAtomic)} XMR` : t('support.feeCalculatedLater')}
              />
              <Recap label={t('support.commissionNone')} value={t('support.none')} />
              <Recap
                label={t('support.totalLeaving')}
                value={prepared.totalAtomic ? `${formatXmr(prepared.totalAtomic)} XMR` : t('common.emDash')}
              />
            </div>
            <Alert tone="info">
              {t('support.confirmInfo')}
            </Alert>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function AddressBlock({ address }: { address: string }) {
  const { t } = useI18n();
  if (address.length === 0) {
    return <p className="text-[12.5px] text-ink-muted">{t('support.addressConfiguredBackend')}</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <div className="w-full max-w-[228px] rounded-2xl border border-line bg-white p-3 shadow-soft">
          <QRCodeSVG
            value={address}
            size={204}
            bgColor="#FFFFFF"
            fgColor="#09090B"
            level="M"
            marginSize={1}
            className="h-auto w-full"
          />
        </div>
      </div>
      <div className="rounded-xl border border-line bg-surface-sunken p-4">
        <p className="mono-address text-ink">{address}</p>
      </div>
      <CopyButton value={address} label={t('support.copyAddress')} variant="secondary" />
      <Alert tone="info">
        {t('support.mainnetOnly')}
      </Alert>
    </div>
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
