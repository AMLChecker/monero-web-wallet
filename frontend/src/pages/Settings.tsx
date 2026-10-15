import { Eye, EyeOff, Lock, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { ApiError, api } from '../api/client';
import { useToast } from '../components/Toast';
import { Alert, Button, Card, CardHeader, CopyButton, Input, KeyValue, Modal, Segmented, StatusPill } from '../components/ui';
import { formatNumber, percent } from '../lib/format';
import { useI18n } from '../i18n/I18nProvider';
import type { LocaleCode } from '../i18n/I18nProvider';
import { useWallet } from '../state/wallet';
import type { PriceSourceId } from '../api/types';

export function SettingsPage({ onLock, locking }: { onLock: () => void; locking: boolean }) {
  const { info, reload, refreshWallet, refreshing, daemonPending } = useWallet();
  const { push } = useToast();
  const { t, locale, setLocale, localeOptions } = useI18n();
  const languageOptions = localeOptions.map((option) => ({
    value: option.code,
    label: t(option.labelKey),
  }));

  const [priceBusy, setPriceBusy] = useState(false);
  const [priceError, setPriceError] = useState<ApiError | null>(null);
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
        title: result.online ? t('settings.nodeUpdated') : t('settings.nodeSaved'),
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

  const applyPriceSource = async (source: PriceSourceId) => {
    setPriceBusy(true);
    setPriceError(null);
    try {
      const result = await api.setPriceSource(source);
      push({
        title: source === 'none' ? t('settings.priceDisabledToast') : t('settings.priceSourceToast', { label: result.current.label }),
        description: result.quote.value ? `XMR = ${result.quote.value} ${result.current.pair.split('/')[1]}` : result.quote.error ?? undefined,
        tone: source === 'none' || result.quote.value ? 'success' : 'error',
      });
      await reload();
    } catch (caught) {
      setPriceError(caught as ApiError);
    } finally {
      setPriceBusy(false);
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
      <Card className="lg:col-span-2">
        <CardHeader title={t('settings.languageTitle')} description={t('settings.languageDesc')} />
        <div className="px-4 py-5 sm:px-5">
          <Segmented value={locale} options={languageOptions} onChange={(code) => setLocale(code as LocaleCode)} />
        </div>
      </Card>

      <Card>
        <CardHeader title={t('settings.walletTitle')} description={t('settings.walletDesc')} />
        <div className="divide-y divide-line-soft px-5 py-2">
          <KeyValue label={t('settings.walletName')}>
            <span className="text-[13px] font-medium">{info?.wallet?.name ?? '—'}</span>
          </KeyValue>
          <KeyValue label={t('settings.network')}>
            <span>{info?.wallet?.network ?? '—'}</span>
          </KeyValue>
          <KeyValue label={t('settings.primaryAddress')}>
            <span className="mono-address block max-w-[320px] text-right text-ink-muted">{info?.wallet?.address ?? '—'}</span>
          </KeyValue>
          <KeyValue label={t('settings.passwordStorage')}>
            <span>{t('settings.passwordStorageValue')}</span>
          </KeyValue>
        </div>
        <div className="flex flex-col gap-2 px-4 pb-4 sm:flex-row sm:flex-wrap sm:px-5 sm:pb-5">
          <CopyButton value={info?.wallet?.address ?? ''} label={t('settings.copyAddress')} variant="secondary" />
          <Button
            variant="secondary"
            onClick={() =>
              void refreshWallet().catch(() => push({ title: t('settings.refreshFailed'), tone: 'error' }))
            }
            loading={refreshing}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            {t('settings.rescan')}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t('settings.nodeTitle')}
          description={t('settings.nodeDesc')}
          action={
            <StatusPill tone={daemonOffline ? 'danger' : daemonPending ? 'neutral' : 'ok'}>
              {daemonPending ? t('common.checking') : daemonOffline ? t('common.offline') : t('common.connected')}
            </StatusPill>
          }
        />
        <div className="divide-y divide-line-soft px-4 py-2 sm:px-5">
          <KeyValue label={t('settings.daemonAddress')}>
            <span className="font-mono text-[12px]">{info?.daemon.address ?? '—'}</span>
          </KeyValue>
          <KeyValue label={t('settings.connectionStatus')}>
            <span className={daemonOffline ? 'text-danger' : 'text-ok'}>
              {daemonOffline
                ? info?.daemon.error ?? t('common.unreachable')
                : t('settings.connectionOnline', { status: info?.daemon.status ?? t('common.online'), latency: info?.daemon.latencyMs ?? t('common.emDash') })}
            </span>
          </KeyValue>
          <KeyValue label={t('settings.walletHeight')}>
            <span className="num">{formatNumber(info?.sync.walletHeight ?? null)}</span>
          </KeyValue>
          <KeyValue label={t('settings.daemonHeight')}>
            <span className="num">{formatNumber(info?.sync.daemonHeight ?? null)}</span>
          </KeyValue>
          <KeyValue label={t('settings.syncProgress')}>
            <span className="num">
              {percent(info?.sync.progressPercent ?? null, 2)} {info?.sync.synchronized ? t('settings.syncedParen') : ''}
            </span>
          </KeyValue>
        </div>
        <div className="flex flex-col gap-3 border-t border-line-soft px-4 py-4 sm:px-5">
          <Input
            label={t('settings.changeDaemon')}
            value={daemonInput}
            onChange={(event) => setDaemonInput(event.target.value)}
            placeholder={t('settings.daemonPlaceholder')}
            hint={t('settings.daemonHint')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && daemonInput.trim().length > 0 && !daemonBusy) void applyDaemon();
            }}
          />
          {daemonError ? (
            <Alert tone="danger" title={t('settings.daemonChangeFailed')}>
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
            {t('settings.applyNode')}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title={t('settings.priceTitle')}
          description={t('settings.priceDesc')}
          action={
            <StatusPill tone={info?.price.enabled ? 'ok' : 'neutral'}>{info?.price.enabled ? t('common.enabled') : t('common.off')}</StatusPill>
          }
        />
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-5">
          <div className="flex flex-wrap gap-2">
            {(info?.priceSources ?? []).map((option) => {
              const active = option.id === info?.price.source;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={priceBusy}
                  onClick={() => void applyPriceSource(option.id)}
                  className={`rounded-xl border px-3 py-2 text-left text-[12.5px] transition disabled:opacity-60 ${
                    active
                      ? 'border-accent/50 bg-accent/[0.08] text-ink'
                      : 'border-line bg-surface-sunken text-ink-muted hover:border-line/70 hover:text-ink'
                  }`}
                >
                  <span className="block font-medium">{option.label}</span>
                  {option.pair ? <span className="mt-0.5 block text-[11px] text-ink-dim">{option.pair}</span> : null}
                </button>
              );
            })}
          </div>

          <div className="divide-y divide-line-soft border-t border-line-soft pt-1">
            <KeyValue label={t('settings.xmrPrice')}>
              <span className="num">
                {info?.price.value
                  ? `${info.price.value} ${info.price.pair.split('/')[1] ?? ''}`
                  : info?.price.enabled
                    ? t('common.emDash')
                    : t('settings.priceDisabled')}
              </span>
            </KeyValue>
            <KeyValue label={t('settings.balanceValue')}>
              <span className="num">
                {info?.price.totalUsdt
                  ? `${info.price.totalUsdt} ${info.price.pair.split('/')[1] ?? ''}`
                  : '—'}
              </span>
            </KeyValue>
            <KeyValue label={t('settings.updated')}>
              <span>{info?.price.updatedAt ? new Date(info.price.updatedAt).toLocaleTimeString() : '—'}</span>
            </KeyValue>
          </div>

          {info?.price.source === 'custom' && !info.priceSources.find((entry) => entry.id === 'custom')?.url ? (
            <Alert tone="warn" title={t('settings.customNotConfiguredTitle')}>
              {t('settings.customNotConfiguredBody', { example: '{ "price": 569.94 }' })}
            </Alert>
          ) : null}

          {priceError ? (
            <Alert tone="danger" title={t('settings.priceSourceFailed')}>
              {priceError.message}
            </Alert>
          ) : null}

          {info?.price.error && info.price.enabled ? (
            <Alert tone="warn" title={t('settings.priceApiProblem')}>
              {info.price.error}
            </Alert>
          ) : null}

          <p className="text-[11.5px] leading-relaxed text-ink-faint">
            {t('settings.priceFootnote')}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title={t('settings.securityTitle')} description={t('settings.securityDesc')} />
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <p className="text-[13px] font-medium text-ink">{t('settings.lockTitle')}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
                {t('settings.lockDesc')}
              </p>
            </div>
            <Button
              variant="danger"
              onClick={onLock}
              loading={locking}
              icon={<Lock className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              {t('settings.lockButton')}
            </Button>
          </div>
          <div className="divider" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div>
              <p className="text-[13px] font-medium text-ink">{t('settings.backupTitle')}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
                {t('settings.backupDesc')}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setPhraseOpen(true)}
              icon={<ShieldCheck className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              {t('settings.showPhrase')}
            </Button>
          </div>
          <Alert tone="warn" title={t('settings.keepSeedTitle')}>
            {t('settings.keepSeedBody')}
          </Alert>
        </div>
      </Card>

      <Card>
        <CardHeader title={t('settings.aboutTitle')} />
        <div className="divide-y divide-line-soft px-4 py-2 sm:px-5">
          <KeyValue label={t('settings.appVersion')}>
            <span className="num">{info?.app.version ?? '1.0.0'}</span>
          </KeyValue>
          <KeyValue label={t('settings.rpcVersion')}>
            <span className="num">{info?.rpc.version ?? '—'}</span>
          </KeyValue>
          <KeyValue label={t('settings.rpcEndpoint')}>
            <span className="font-mono text-[12px]">{t('settings.rpcEndpointValue')}</span>
          </KeyValue>
          <KeyValue label={t('settings.sendMode')}>
            <span>
              {info?.app.sendMode === 'prepare' ? t('settings.sendModePrepare') : t('settings.sendModeDirect')}
            </span>
          </KeyValue>
          <KeyValue label={t('settings.walletDir')}>
            <span className="mono-address block max-w-[320px] text-right text-ink-muted">{info?.app.walletDir ?? '—'}</span>
          </KeyValue>
          <KeyValue label={t('settings.priceApi')}>
            {!info?.price.enabled ? (
              <span>{t('settings.priceApiOff')}</span>
            ) : info.price.error ? (
              <span className="text-warn">
                {info.price.label}: {info.price.error}
              </span>
            ) : (
              <span>
                {info.price.label} · {info.price.pair}
                {info.price.value ? ` · ${info.price.value} ${info.price.pair.split('/')[1] ?? ''}` : ''}
              </span>
            )}
          </KeyValue>
        </div>
      </Card>

      <Modal
        open={phraseOpen}
        onClose={closePhraseDialog}
        title={t('settings.phraseModalTitle')}
        description={t('settings.phraseModalDesc')}
        footer={
          phrase ? (
            <>
              <Button
                variant="secondary"
                onClick={() => setPhraseVisible((current) => !current)}
                icon={phraseVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              >
                {phraseVisible ? t('common.hide') : t('common.reveal')}
              </Button>
              <CopyButton value={phrase.join(' ')} label={t('settings.copyPhrase')} variant="primary" size="md" />
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={closePhraseDialog} disabled={phraseBusy}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => void revealPhrase()}
                loading={phraseBusy}
                disabled={password.length === 0}
              >
                {t('settings.revealPhrase')}
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
                <p className="py-6 text-center text-[12.5px] text-ink-dim">{t('settings.phraseHidden')}</p>
              )}
            </div>
            <Alert tone="warn" title={t('settings.writeWordsTitle')}>
              {t('settings.writeWordsBody')}
            </Alert>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Input
              label={t('settings.walletPassword')}
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
              <Alert tone="danger" title={phraseError.code === 'BAD_PASSWORD' ? t('settings.incorrectPassword') : t('settings.seedReadFailed')}>
                {phraseError.message}
                {phraseError.hint ? <p className="mt-1 text-ink-dim">{phraseError.hint}</p> : null}
              </Alert>
            ) : (
              <Alert tone="info">
                <span className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 text-ink-dim" />
                  <span>
                    {t('settings.phraseReloadInfo')}
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
