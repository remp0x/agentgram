'use client';

import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { launchPumpFunToken, linkExistingToken } from '@/lib/pumpfun-client';
import type { MarketData } from '@/app/api/atelier/market/route';

interface TokenInfo {
  mint: string | null;
  name: string | null;
  symbol: string | null;
  image_url: string | null;
  mode: 'pumpfun' | 'byot' | null;
  creator_wallet: string | null;
  tx_hash: string | null;
}

type LaunchStep = 'idle' | 'uploading' | 'signing' | 'confirming' | 'saving' | 'done' | 'error';

const TOKEN_NAME_SUFFIX = ' by Atelier';

function formatMcap(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function TokenLaunchSection({
  agentId,
  agentName,
  agentDescription,
  agentAvatarUrl,
  token,
  ownerWallet,
  onTokenSet,
}: {
  agentId: string;
  agentName: string;
  agentDescription?: string;
  agentAvatarUrl: string | null;
  token: TokenInfo | null;
  ownerWallet: string | null;
  onTokenSet: () => void;
}) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [mode, setMode] = useState<'none' | 'pumpfun' | 'byot'>('none');
  const [step, setStep] = useState<LaunchStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [marketData, setMarketData] = useState<MarketData | null>(null);

  // PumpFun form
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [devBuy, setDevBuy] = useState('1');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [useAgentAvatar, setUseAgentAvatar] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  // BYOT form
  const [byotMint, setByotMint] = useState('');
  const [byotName, setByotName] = useState('');
  const [byotSymbol, setByotSymbol] = useState('');

  useEffect(() => {
    if (!token?.mint) return;
    fetch('/api/atelier/market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mints: [token.mint] }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data[token.mint!]) {
          setMarketData(json.data[token.mint!]);
        }
      })
      .catch(() => {});
  }, [token?.mint]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (token?.mint) {
    return (
      <div className="p-4 rounded-lg bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{token.name}</span>
              <span className="text-xs font-mono text-atelier">${token.symbol}</span>
              <span className={`px-1.5 py-0.5 rounded text-2xs font-mono ${
                token.mode === 'pumpfun' ? 'bg-green-500/10 text-green-400' : 'bg-atelier/10 text-atelier'
              }`}>
                {token.mode === 'pumpfun' ? 'PumpFun' : 'BYOT'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <button
                onClick={() => handleCopy(token.mint!)}
                className="text-xs text-gray-500 dark:text-neutral-400 hover:text-atelier font-mono transition-colors flex items-center gap-1"
              >
                {token.mint!.slice(0, 6)}...{token.mint!.slice(-4)}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  {copied ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                  )}
                </svg>
              </button>
              {marketData && (
                <span className="text-xs font-mono text-neutral-400">
                  mcap {formatMcap(marketData.market_cap_usd)}
                </span>
              )}
            </div>
          </div>
          <a
            href={`https://pump.fun/coin/${token.mint}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 rounded text-2xs font-mono text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors"
          >
            pump.fun
          </a>
        </div>
      </div>
    );
  }

  if (!connected || !publicKey) {
    return (
      <div className="p-4 rounded-lg bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-neutral-800">
        <p className="text-sm text-gray-500 dark:text-neutral-500 font-mono text-center">
          Connect wallet to launch or link a token
        </p>
      </div>
    );
  }

  if (ownerWallet && publicKey.toBase58() !== ownerWallet) {
    return (
      <div className="p-4 rounded-lg bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-neutral-800">
        <p className="text-sm text-gray-500 dark:text-neutral-500 font-mono text-center">
          Only the agent owner can launch a token
        </p>
      </div>
    );
  }

  const busy = step !== 'idle' && step !== 'done' && step !== 'error';

  async function getImageFile(): Promise<File> {
    if (imageFile) return imageFile;
    if (useAgentAvatar && agentAvatarUrl) {
      const res = await fetch(agentAvatarUrl);
      const blob = await res.blob();
      return new File([blob], 'avatar.png', { type: blob.type || 'image/png' });
    }
    throw new Error('No image selected');
  }

  async function handlePumpFunLaunch() {
    if (!publicKey || !signTransaction) return;
    setError(null);

    try {
      setStep('uploading');
      const file = await getImageFile();
      const fullName = name + TOKEN_NAME_SUFFIX;

      setStep('signing');
      await launchPumpFunToken({
        agentId,
        metadata: { name: fullName, symbol, description, file },
        devBuySol: parseFloat(devBuy) || 0,
        connection,
        walletPublicKey: publicKey,
        signTransaction,
      });
      setStep('done');
      onTokenSet();
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : 'Launch failed');
    }
  }

  async function handleByotLink() {
    if (!publicKey) return;
    setError(null);

    try {
      setStep('saving');
      const fullName = byotName.endsWith(TOKEN_NAME_SUFFIX) ? byotName : byotName + TOKEN_NAME_SUFFIX;
      await linkExistingToken({
        agentId,
        mintAddress: byotMint,
        name: fullName,
        symbol: byotSymbol,
        walletPublicKey: publicKey.toBase58(),
      });
      setStep('done');
      onTokenSet();
    } catch (err) {
      setStep('error');
      setError(err instanceof Error ? err.message : 'Link failed');
    }
  }

  const hasImage = imageFile || (useAgentAvatar && agentAvatarUrl);

  const stepLabels: Record<string, string> = {
    uploading: 'Uploading metadata...',
    signing: 'Waiting for signature...',
    confirming: 'Confirming transaction...',
    saving: 'Saving token info...',
  };

  return (
    <div className="p-4 rounded-lg bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-neutral-800">
      <h3 className="text-sm font-bold font-display mb-3">Agent Token</h3>

      {mode === 'none' && (
        <div className="flex gap-3">
          <button
            onClick={() => { setMode('pumpfun'); setName(agentName); setDescription(agentDescription || ''); }}
            disabled={busy}
            className="flex-1 px-3 py-2 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-mono btn-atelier btn-green hover:bg-green-500/20 disabled:opacity-50"
          >
            Launch on PumpFun
          </button>
          <button
            onClick={() => setMode('byot')}
            disabled={busy}
            className="flex-1 px-3 py-2 rounded bg-atelier/10 border border-atelier/20 text-atelier text-xs font-mono btn-atelier btn-secondary hover:bg-atelier/20 disabled:opacity-50"
          >
            Link Existing Token
          </button>
        </div>
      )}

      {mode === 'pumpfun' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Token Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                className="w-full px-3 py-2 pr-24 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50 disabled:opacity-50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs font-mono text-atelier pointer-events-none">
                by Atelier
              </span>
            </div>
            <input
              type="text"
              placeholder="SYMBOL"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              maxLength={10}
              disabled={busy}
              className="px-3 py-2 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50 disabled:opacity-50"
            />
          </div>
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            disabled={busy}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50 resize-none disabled:opacity-50"
          />
          <div className="flex gap-3 items-center">
            {agentAvatarUrl && (
              <label className="flex items-center gap-2 text-xs font-mono text-gray-600 dark:text-neutral-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAgentAvatar && !imageFile}
                  onChange={(e) => { setUseAgentAvatar(e.target.checked); if (e.target.checked) setImageFile(null); }}
                  className="accent-atelier"
                />
                Use agent avatar
              </label>
            )}
            <button
              onClick={() => { setUseAgentAvatar(false); fileRef.current?.click(); }}
              disabled={busy}
              className="px-3 py-2 rounded bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-xs font-mono text-gray-600 dark:text-neutral-300 btn-atelier btn-secondary hover:border-atelier/50 disabled:opacity-50"
            >
              {imageFile ? imageFile.name.slice(0, 20) : 'Custom Image'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { setImageFile(e.target.files?.[0] || null); setUseAgentAvatar(false); }}
            />
            <div className="flex flex-col gap-1">
              <label className="text-2xs font-mono text-neutral-500">Initial Buy (SOL)</label>
              <div className="relative">
                <input
                  type="number"
                  value={devBuy}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || parseFloat(val) >= 0) setDevBuy(val);
                  }}
                  min="0"
                  step="0.1"
                  disabled={busy}
                  className="w-32 px-3 py-2 pr-10 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50 disabled:opacity-50"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs font-mono text-neutral-400 pointer-events-none">SOL</span>
              </div>
            </div>
          </div>

          {busy && (
            <div className="flex items-center gap-2 py-2">
              <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-green-400 font-mono">{stepLabels[step] || 'Processing...'}</span>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 font-mono">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handlePumpFunLaunch}
              disabled={busy || !name || !symbol || !hasImage}
              className="flex-1 px-3 py-2 rounded bg-green-500 text-black text-xs font-bold font-mono uppercase tracking-wide btn-atelier btn-green hover:bg-green-400 disabled:opacity-50 disabled:hover:bg-green-500"
            >
              Launch Token
            </button>
            <button
              onClick={() => { setMode('none'); setError(null); setStep('idle'); }}
              disabled={busy}
              className="px-3 py-2 rounded border border-gray-200 dark:border-neutral-800 text-xs font-mono text-gray-600 dark:text-neutral-300 btn-atelier btn-secondary hover:border-neutral-500 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          <p className="text-2xs text-neutral-500 font-mono">
            Creator trading fees managed by Atelier. You earn 90% of your token&apos;s creator fees.
          </p>
        </div>
      )}

      {mode === 'byot' && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Token Mint Address"
            value={byotMint}
            onChange={(e) => setByotMint(e.target.value)}
            disabled={busy}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50 disabled:opacity-50"
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Token Name"
                value={byotName}
                onChange={(e) => setByotName(e.target.value)}
                disabled={busy}
                className="w-full px-3 py-2 pr-24 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50 disabled:opacity-50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs font-mono text-atelier pointer-events-none">
                by Atelier
              </span>
            </div>
            <input
              type="text"
              placeholder="SYMBOL"
              value={byotSymbol}
              onChange={(e) => setByotSymbol(e.target.value.toUpperCase())}
              maxLength={10}
              disabled={busy}
              className="px-3 py-2 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50 disabled:opacity-50"
            />
          </div>

          {busy && (
            <div className="flex items-center gap-2 py-2">
              <div className="w-4 h-4 border-2 border-atelier border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-atelier font-mono">{stepLabels[step] || 'Processing...'}</span>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 font-mono">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleByotLink}
              disabled={busy || !byotMint || !byotName || !byotSymbol}
              className="flex-1 px-3 py-2 rounded bg-atelier text-white text-xs font-bold font-mono uppercase tracking-wide btn-atelier btn-primary hover:bg-atelier-bright disabled:opacity-50 disabled:hover:bg-atelier"
            >
              Link Token
            </button>
            <button
              onClick={() => { setMode('none'); setError(null); setStep('idle'); }}
              disabled={busy}
              className="px-3 py-2 rounded border border-gray-200 dark:border-neutral-800 text-xs font-mono text-gray-600 dark:text-neutral-300 btn-atelier btn-secondary hover:border-neutral-500 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
