/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: '#09090B',
        surface: {
          DEFAULT: '#111113',
          raised: '#16161A',
          sunken: '#0D0D0F',
        },
        line: {
          DEFAULT: '#27272A',
          soft: '#1C1C20',
        },
        accent: {
          DEFAULT: '#FF6600',
          soft: '#FF8A3D',
          deep: '#CC5200',
          wash: 'rgba(255, 102, 0, 0.12)',
        },
        ink: {
          DEFAULT: '#FAFAFA',
          muted: '#A1A1AA',
          dim: '#71717A',
          faint: '#52525B',
        },
        ok: '#34D399',
        warn: '#FBBF24',
        danger: '#F87171',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
        '3xl': '22px',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI Variable Display', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Mono', 'Consolas', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 0 rgba(255,255,255,0.02) inset, 0 12px 32px -20px rgba(0,0,0,0.9)',
        raised: '0 1px 0 rgba(255,255,255,0.03) inset, 0 20px 50px -30px rgba(0,0,0,1)',
        glow: '0 0 0 1px rgba(255,102,0,0.25), 0 12px 40px -24px rgba(255,102,0,0.6)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'sheet-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out both',
        'slide-in': 'slide-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'sheet-up': 'sheet-up 200ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'toast-in': 'toast-in 160ms ease-out both',
        'pulse-soft': 'pulse-soft 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
