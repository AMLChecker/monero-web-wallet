import { Plus } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useState } from 'react';

import { ApiError, api } from '../api/client';
import { useToast } from '../components/Toast';
import { Alert, Button, Card, CardHeader, CopyButton, Input, Skeleton } from '../components/ui';
import { usePolling } from '../hooks/useApi';
import { shortenAddress } from '../lib/format';
import { useWallet } from '../state/wallet';

export function ReceivePage() {
  const { info, rpcOffline } = useWallet();
  const { push } = useToast();
  const addresses = usePolling(api.address, 20_000, !rpcOffline);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const subaddresses = addresses.data?.subaddresses ?? [];
  const selected = useMemo(
    () => subaddresses.find((entry) => entry.index === selectedIndex) ?? subaddresses[0] ?? null,
    [subaddresses, selectedIndex],
  );

  useEffect(() => {
    if (selectedIndex !== 0 && subaddresses.length > 0 && !subaddresses.some((entry) => entry.index === selectedIndex)) {
      setSelectedIndex(0);
    }
  }, [subaddresses, selectedIndex]);

  const createSubaddress = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.createSubaddress(label);
      setLabel('');
      setSelectedIndex(result.index);
      push({ title: `Subaddress #${result.index} created`, tone: 'success' });
      await addresses.reload();
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setBusy(false);
    }
  };

  const address = selected?.address ?? info?.wallet?.address ?? '';

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-5">
      <Card className="p-4 sm:p-6">
        <p className="label-caps">Your Monero address</p>
        <p className="mt-1 text-[12.5px] text-ink-muted">
          {selected && selected.index > 0 ? `Subaddress #${selected.index}` : 'Primary address'} · {info?.wallet?.network ?? 'mainnet'}
        </p>

        <div className="mt-5 flex justify-center">
          {address.length === 0 ? (
            <Skeleton className="h-[200px] w-[200px] max-w-full rounded-2xl sm:h-[228px] sm:w-[228px]" />
          ) : (
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
          )}
        </div>

        <div className="mt-5 rounded-xl border border-line bg-surface-sunken p-4">
          <p className="mono-address text-ink">{address || '—'}</p>
        </div>

        <div className="mt-4">
          <CopyButton value={address} label="Copy Address" variant="primary" size="md" />
        </div>

        <Alert tone="info" className="mt-4">
          Only Monero (XMR) on this network can be received at this address. Funds sent on another chain cannot be recovered.
        </Alert>
      </Card>

      <Card>
        <CardHeader
          title="Addresses &amp; subaddresses"
          description="Create a subaddress to separate payments and keep the primary address private"
          action={<span className="num text-[12px] text-ink-dim">{subaddresses.length}</span>}
        />

        <div className="flex flex-col gap-3 border-b border-line-soft px-5 py-4 sm:flex-row sm:items-end">
          <Input
            label="Label (optional)"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Exchange deposit"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !busy) void createSubaddress();
            }}
          />
          <Button variant="secondary" onClick={() => void createSubaddress()} loading={busy} icon={<Plus className="h-4 w-4" />}>
            Create new subaddress
          </Button>
        </div>

        {error ? (
          <div className="px-5 pt-4">
            <Alert tone="danger" title="Could not create the subaddress">
              {error.message}
            </Alert>
          </div>
        ) : null}

        <div className="max-h-[60vh] overflow-y-auto px-2 py-2 lg:max-h-[520px]">
          {subaddresses.length === 0 ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            subaddresses.map((entry) => {
              const active = entry.index === selectedIndex;
              return (
                <div
                  key={entry.index}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 ${
                    active ? 'bg-accent/[0.08] ring-1 ring-inset ring-accent/25' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <button type="button" onClick={() => setSelectedIndex(entry.index)} className="min-w-0 flex-1 text-left">
                    <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      {entry.index === 0 ? 'Primary address' : `Subaddress #${entry.index}`}
                      {entry.label && entry.index !== 0 ? (
                        <span className="text-[11.5px] font-normal text-ink-dim">· {entry.label}</span>
                      ) : null}
                      {entry.used ? (
                        <span className="rounded-full border border-ok/25 bg-ok/[0.08] px-2 py-0.5 text-[10.5px] font-medium text-ok">
                          used
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11.5px] text-ink-dim">{shortenAddress(entry.address, 18, 10)}</p>
                  </button>
                  <CopyButton value={entry.address} size="sm" variant="ghost" label="" />
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
