import { Menu } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from './api/client';
import { HeaderActions, NodePills, ServiceBanners } from './components/StatusStrip';
import { Sidebar } from './components/Sidebar';
import { ToastProvider, useToast } from './components/Toast';
import { Spinner } from './components/ui';
import { useHashRoute, WALLET_ROUTES, type Route } from './lib/hashRouter';
import { CreateWalletPage } from './pages/CreateWallet';
import { DashboardPage } from './pages/Dashboard';
import { ReceivePage } from './pages/Receive';
import { SendPage } from './pages/Send';
import { SettingsPage } from './pages/Settings';
import { SupportPage } from './pages/Support';
import { TransactionsPage } from './pages/Transactions';
import { WelcomePage } from './pages/Welcome';
import { WalletProvider, useWallet } from './state/wallet';

const PAGE_META: Record<Route, { title: string; subtitle: string }> = {
  welcome: { title: 'Monero Wallet', subtitle: 'Your private Monero wallet' },
  create: { title: 'Create wallet', subtitle: 'Generate a new Monero wallet on this computer' },
  dashboard: { title: 'Dashboard', subtitle: 'Balance, sync progress and recent activity' },
  send: { title: 'Send', subtitle: 'Build, review and broadcast a transaction' },
  receive: { title: 'Receive', subtitle: 'Share your address or create a subaddress' },
  transactions: { title: 'Transactions', subtitle: 'Every transfer known to this wallet' },
  support: { title: 'Support', subtitle: 'Voluntary donation to the developer of this wallet' },
  settings: { title: 'Settings', subtitle: 'Wallet, node and security options' },
};

export default function App() {
  return (
    <ToastProvider>
      <WalletProvider>
        <Shell />
      </WalletProvider>
    </ToastProvider>
  );
}

function Shell() {
  const [route, navigate] = useHashRoute();
  const { info, loading, refreshWallet, refreshing, reload } = useWallet();
  const { push } = useToast();
  const [locking, setLocking] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const walletOpen = Boolean(info?.wallet?.open);

  const closeNav = useCallback(() => setNavOpen(false), []);

  useEffect(() => {
    closeNav();
  }, [route, closeNav]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  useEffect(() => {
    if (!info) return;
    if (walletOpen && (route === 'welcome' || route === 'create')) navigate('dashboard');
    if (!walletOpen && WALLET_ROUTES.includes(route)) navigate('welcome');
  }, [info, walletOpen, route, navigate]);

  const lockWallet = async () => {
    setLocking(true);
    try {
      await api.closeWallet();
      push({ title: 'Wallet locked', description: 'The session was closed on the backend.', tone: 'success' });
      navigate('welcome');
      await reload();
    } catch (error) {
      push({ title: 'Could not lock the wallet', tone: 'error' });
    } finally {
      setLocking(false);
    }
  };

  const page = useMemo(() => {
    switch (route) {
      case 'create':
        return <CreateWalletPage onDone={() => navigate('dashboard')} onBack={() => navigate('welcome')} />;
      case 'send':
        return <SendPage onNavigate={navigate} />;
      case 'receive':
        return <ReceivePage />;
      case 'transactions':
        return <TransactionsPage />;
      case 'support':
        return <SupportPage onNavigate={navigate} />;
      case 'settings':
        return <SettingsPage onLock={lockWallet} locking={locking} />;
      case 'dashboard':
        return <DashboardPage onNavigate={navigate} />;
      default:
        return <WelcomePage onNavigate={navigate} />;
    }
  }, [route, navigate, lockWallet, locking]);

  const isStandalone = route === 'welcome' || route === 'create';

  if (loading && !info) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-ink-muted">
        <Spinner className="h-5 w-5" />
        <span className="text-sm">Connecting to the local wallet backend…</span>
      </div>
    );
  }

  if (isStandalone) {
    return <div className="min-h-dvh">{page}</div>;
  }

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        route={route}
        navigate={navigate}
        info={info}
        onRefresh={() => void refreshWallet().catch(() => undefined)}
        refreshing={refreshing}
        className="hidden w-[230px] lg:flex"
      />

      {navOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={closeNav} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-[min(280px,86vw)] animate-slide-in shadow-raised">
            <Sidebar
              route={route}
              navigate={navigate}
              info={info}
              onRefresh={() => void refreshWallet().catch(() => undefined)}
              refreshing={refreshing}
              className="w-full border-r-0"
              onClose={closeNav}
            />
          </div>
        </div>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-line bg-app/95 px-4 py-3 backdrop-blur lg:px-8 lg:py-5">
          <div className="flex items-center justify-between gap-3 lg:items-end lg:gap-6">
            <div className="flex min-w-0 items-center gap-2.5 lg:gap-0">
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                className="-ml-1 rounded-lg p-2 text-ink-muted transition hover:bg-white/5 hover:text-ink lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-[17px] font-semibold tracking-tight text-ink lg:text-[20px]">
                  {PAGE_META[route].title}
                </h1>
                <p className="mt-0.5 truncate text-[12px] text-ink-muted lg:mt-1 lg:text-[12.5px]">{PAGE_META[route].subtitle}</p>
              </div>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              <NodePills />
              <HeaderActions onLock={() => void lockWallet()} />
            </div>
            <div className="lg:hidden">
              <HeaderActions onLock={() => void lockWallet()} compact />
            </div>
          </div>

          <div className="mt-2.5 lg:hidden">
            <NodePills compact />
          </div>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 lg:px-8 lg:py-7">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 lg:gap-5">
            <ServiceBanners />
            {page}
          </div>
        </div>
      </main>
    </div>
  );
}
