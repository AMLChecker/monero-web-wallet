import { AlertCircle, Check, Copy, Loader2, X } from 'lucide-react';
import {
  forwardRef,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { copyText } from '../lib/clipboard';
import { useToast } from './Toast';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-[#0B0B0C] font-semibold hover:bg-accent-soft active:bg-accent-deep disabled:bg-accent/40 disabled:text-[#0B0B0C]/60',
  secondary:
    'border border-line bg-surface-raised text-ink hover:border-line/70 hover:bg-[#1B1B20] active:bg-[#15151A] disabled:opacity-50',
  ghost: 'text-ink-muted hover:text-ink hover:bg-white/5 disabled:opacity-50',
  danger: 'border border-danger/35 bg-danger/5 text-danger hover:bg-danger/10 active:bg-danger/15 disabled:opacity-50',
  subtle: 'bg-white/[0.04] text-ink hover:bg-white/[0.07] disabled:opacity-50',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 gap-1.5 px-3 text-[13px] rounded-lg',
  md: 'h-11 gap-2 px-4 text-sm rounded-xl',
  lg: 'h-12 gap-2 px-5 text-[15px] rounded-xl',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, icon, className = '', children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex select-none items-center justify-center whitespace-nowrap transition duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function CardHeader({
  title,
  description,
  action,
  className = '',
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={`flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-[12.5px] text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: ReactNode;
  error?: ReactNode;
  suffix?: ReactNode;
  mono?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, suffix, mono = false, className = '', id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = hint || error ? `${inputId}-help` : undefined;
  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="mb-1.5 block text-[12.5px] font-medium text-ink-muted">
          {label}
        </label>
      ) : null}
      <div
        className={`flex items-center gap-2 rounded-xl border bg-surface-sunken px-3 transition ${
          error ? 'border-danger/50' : 'border-line focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20'
        }`}
      >
        <input
          ref={ref}
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className={`h-11 w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none disabled:opacity-60 ${
            mono ? 'font-mono text-[12.5px]' : ''
          } ${className}`}
          {...rest}
        />
        {suffix ? <div className="flex shrink-0 items-center gap-1 text-[12.5px] text-ink-dim">{suffix}</div> : null}
      </div>
      {error ? (
        <p id={`${inputId}-help`} className="mt-1.5 text-[12px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-help`} className="mt-1.5 text-[12px] leading-snug text-ink-dim">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

type AlertTone = 'info' | 'warn' | 'danger' | 'success';

const ALERT_STYLES: Record<AlertTone, string> = {
  info: 'border-line bg-white/[0.03] text-ink-muted',
  warn: 'border-warn/30 bg-warn/[0.06] text-warn',
  danger: 'border-danger/35 bg-danger/[0.07] text-danger',
  success: 'border-ok/30 bg-ok/[0.07] text-ok',
};

export function Alert({
  tone = 'info',
  title,
  children,
  className = '',
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[12.5px] leading-relaxed ${ALERT_STYLES[tone]} ${className}`}>
      {tone === 'danger' || tone === 'warn' ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> : null}
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div> : null}
      </div>
    </div>
  );
}

type PillTone = 'ok' | 'warn' | 'danger' | 'neutral' | 'accent';

const PILL_STYLES: Record<PillTone, { wrap: string; dot: string }> = {
  ok: { wrap: 'border-ok/30 bg-ok/[0.08] text-ok', dot: 'bg-ok' },
  warn: { wrap: 'border-warn/30 bg-warn/[0.08] text-warn', dot: 'bg-warn' },
  danger: { wrap: 'border-danger/30 bg-danger/[0.08] text-danger', dot: 'bg-danger' },
  neutral: { wrap: 'border-line bg-white/[0.03] text-ink-muted', dot: 'bg-ink-faint' },
  accent: { wrap: 'border-accent/30 bg-accent/10 text-accent-soft', dot: 'bg-accent' },
};

export function StatusPill({
  tone = 'neutral',
  children,
  pulse = false,
  className = '',
}: {
  tone?: PillTone;
  children: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  const styles = PILL_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium ${styles.wrap} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${styles.dot} ${pulse ? 'animate-pulse-soft' : ''}`} />
      {children}
    </span>
  );
}

export function ProgressBar({ value, tone = 'accent' }: { value: number | null; tone?: 'accent' | 'ok' | 'warn' }) {
  const clamped = value === null || !Number.isFinite(value) ? 0 : Math.min(100, Math.max(0, value));
  const gradient =
    tone === 'ok' ? 'from-ok/70 to-ok' : tone === 'warn' ? 'from-warn/70 to-warn' : 'from-accent/70 to-accent';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-[width] duration-500`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`animate-spin text-ink-dim ${className}`} />;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse-soft rounded-md bg-white/[0.05] ${className}`} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center sm:px-6 sm:py-12">
      {icon ? <div className="mb-1 text-ink-faint">{icon}</div> : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-[12.5px] leading-relaxed text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const width = size === 'sm' ? 'max-w-[420px]' : size === 'lg' ? 'max-w-[680px]' : 'max-w-[520px]';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative flex max-h-[calc(100dvh-1.5rem)] w-full ${width} animate-sheet-up flex-col rounded-2xl border border-line bg-surface shadow-raised sm:animate-fade-in`}
      >
        <header className="flex shrink-0 items-start justify-between gap-4 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
            {description ? <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-dim transition hover:bg-white/5 hover:text-ink"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        {children ? <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div> : null}
        {footer ? (
          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-line-soft px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-5 [&>button]:w-full sm:[&>button]:w-auto">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function CopyButton({
  value,
  label,
  size = 'sm',
  variant = 'subtle',
  disabled = false,
  className = '',
}: {
  value: string;
  label?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  disabled?: boolean;
  className?: string;
}) {
  const { push } = useToast();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyText(value);
    if (!ok) {
      push({ title: 'Could not copy to the clipboard', tone: 'error' });
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_600);
    push({ title: 'Copied to clipboard', tone: 'success' });
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={onCopy}
      disabled={disabled || value.length === 0}
      icon={copied ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}
      className={className}
    >
      {label !== undefined && label.length === 0 ? '' : label ?? (copied ? 'Copied' : 'Copy')}
    </Button>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface-sunken p-1 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition ${
              active ? 'bg-white/[0.07] text-ink shadow-soft' : 'text-ink-dim hover:text-ink-muted'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function KeyValue({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:py-2.5">
      <span className="text-[12.5px] text-ink-dim">{label}</span>
      <span className="min-w-0 text-[13px] text-ink sm:text-right">{children}</span>
    </div>
  );
}
