import { ArrowLeft, Check, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useState } from 'react';

import { ApiError, api } from '../api/client';
import { MoneroLogo } from '../components/MoneroLogo';
import { Alert, Button, Card, CopyButton, Input } from '../components/ui';
import type { CreatedWallet } from '../api/types';
import { useI18n } from '../i18n/I18nProvider';

export function CreateWalletPage({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [created, setCreated] = useState<CreatedWallet | null>(null);
  const [phraseVisible, setPhraseVisible] = useState(false);

  const nameValid = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name.trim());
  const passwordValid = password.length >= 8;
  const matches = password.length > 0 && password === confirm;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.createWallet(name.trim(), password);
      setCreated(result);
      setPhraseVisible(false);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setBusy(false);
      setPassword('');
      setConfirm('');
    }
  };

  if (created) {
    const words = created.recoveryWords ?? [];
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <Card className="w-full max-w-[640px] animate-fade-in p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ok/30 bg-ok/10">
              <Check className="h-5 w-5 text-ok" />
            </span>
            <div>
              <h1 className="text-[18px] font-semibold tracking-tight text-ink">{t('create.successTitle')}</h1>
              <p className="text-[12.5px] text-ink-muted">{t('create.successSubtitle', { name: created.wallet.name })}</p>
            </div>
          </div>

          <div className="mt-6">
            <p className="label-caps">{t('create.address')}</p>
            <div className="mt-2 flex flex-col gap-3 rounded-xl border border-line bg-surface-sunken p-4">
              <p className="mono-address text-ink">{created.wallet.address}</p>
              <div className="flex flex-wrap gap-2">
                <CopyButton value={created.wallet.address} label={t('create.copyAddress')} variant="secondary" />
                <StatusBadge label={created.network || t('common.mainnet')} />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <p className="label-caps">{t('create.recoveryPhrase')}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPhraseVisible((current) => !current)}
                icon={phraseVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              >
                {phraseVisible ? t('common.hide') : t('common.reveal')}
              </Button>
            </div>
            <div className="relative mt-2 rounded-xl border border-line bg-surface-sunken p-4">
              {phraseVisible ? (
                <ol className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                  {words.map((word, index) => (
                    <li key={`${word}-${index}`} className="num flex items-baseline gap-2 text-[13px] text-ink">
                      <span className="w-5 text-right text-[11px] text-ink-faint">{index + 1}.</span>
                      <span className="font-mono">{word}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="select-none py-6 text-center text-[12.5px] text-ink-dim">
                  {t('create.phraseHidden', { count: words.length || 25 })}
                </p>
              )}
            </div>
          </div>

          <Alert tone="warn" title={t('create.writeDownTitle')} className="mt-4">
            {t('create.writeDownBody')}
          </Alert>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <CopyButton value={created.wallet.address} label={t('create.copyAddress')} variant="secondary" />
            <CopyButton
              value={created.recoveryPhrase}
              label={t('create.copyPhrase')}
              variant="secondary"
              disabled={!phraseVisible}
            />
            <Button variant="primary" className="w-full sm:ml-auto sm:w-auto" onClick={onDone}>
              {t('common.continue')}
            </Button>
          </div>
          {!phraseVisible ? (
            <p className="mt-2 text-right text-[11.5px] text-ink-faint">{t('create.revealToCopy')}</p>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
      <Card className="w-full max-w-[560px] animate-fade-in p-5 sm:p-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-dim transition hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t('common.back')}
        </button>

        <div className="mt-5 flex items-center gap-3">
          <MoneroLogo className="h-8 w-8 text-accent" />
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight text-ink">{t('create.title')}</h1>
            <p className="text-[12.5px] text-ink-muted">{t('create.subtitle')}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          <Input
            label={t('create.walletName')}
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value.replace(/[^A-Za-z0-9._-]/g, ''))}
            placeholder="main"
            hint={t('create.nameHint')}
            error={name.length > 0 && !nameValid ? t('create.nameError') : undefined}
          />
          <Input
            label={t('create.password')}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('create.passwordPlaceholder')}
            hint={t('create.passwordHint')}
            error={password.length > 0 && !passwordValid ? t('create.passwordError') : undefined}
            suffix={
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="rounded-md p-1 text-ink-dim transition hover:text-ink"
                aria-label={showPassword ? t('create.hidePassword') : t('create.showPassword')}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />
          <Input
            label={t('create.confirmPassword')}
            type={showPassword ? 'text' : 'password'}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder={t('create.confirmPlaceholder')}
            error={confirm.length > 0 && !matches ? t('create.passwordMismatch') : undefined}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && nameValid && passwordValid && matches && !busy) void submit();
            }}
          />
        </div>

        {error ? (
          <Alert tone="danger" title={t('create.failedTitle')} className="mt-4">
            {error.message}
            {error.hint ? <p className="mt-1 text-ink-dim">{error.hint}</p> : null}
          </Alert>
        ) : null}

        <Alert tone="info" className="mt-4">
          <span className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 text-ink-dim" />
            <span>{t('create.seedInfo')}</span>
          </span>
        </Alert>

        <Button
          variant="primary"
          size="lg"
          className="mt-5 w-full"
          onClick={() => void submit()}
          loading={busy}
          disabled={!nameValid || !passwordValid || !matches}
        >
          {t('create.submit')}
        </Button>
      </Card>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-white/[0.03] px-2.5 py-1 text-[11.5px] text-ink-muted">
      {label}
    </span>
  );
}
