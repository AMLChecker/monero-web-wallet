export function MoneroLogo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Monero">
      <circle cx="32" cy="32" r="28.5" fill="none" stroke="currentColor" strokeWidth="5" />
      <path
        d="M17 45.5V20.5h5.6l9.4 11.4 9.4-11.4H47v25h-4.6V29.2L32 41.9 21.6 29.2v16.3z"
        fill="currentColor"
      />
    </svg>
  );
}
