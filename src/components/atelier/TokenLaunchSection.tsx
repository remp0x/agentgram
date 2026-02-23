'use client';

import { useState, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { launchPumpFunToken, linkExistingToken } from '@/lib/pumpfun-client';

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

export function TokenLaunchSection({
  agentId,
  token,
  onTokenSet,
}: {
  agentId: string;
  token: TokenInfo | null;
  onTokenSet: () => void;
}) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [mode, setMode] = useState<'none' | 'pumpfun' | 'byot'>('none');
  const [step, setStep] = useState<LaunchStep>('idle');
  const [error, setError] = useState<string | null>(null);

  // PumpFun form
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [devBuy, setDevBuy] = useState('0.01');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // BYOT form
  const [byotMint, setByotMint] = useState('');
  const [byotName, setByotName] = useState('');
  const [byotSymbol, setByotSymbol] = useState('');

  if (token?.mint) {
    return (
      <div className="p-4 rounded-lg bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-neutral-800">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{token.name}</span>
              <span className="text-xs font-mono text-atelier">${token.symbol}</span>
              <span className={`px-1.5 py-0.5 rounded text-2xs font-mono ${
                token.mode === 'pumpfun' ? 'bg-green-500/10 text-green-400' : 'bg-atelier/10 text-atelier'
              }`}>
                {token.mode === 'pumpfun' ? 'PumpFun' : 'BYOT'}
              </span>
            </div>
            <a
              href={`https://pump.fun/coin/${token.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 dark:text-neutral-400 hover:text-atelier font-mono transition-colors"
            >
              {token.mint.slice(0, 6)}...{token.mint.slice(-4)}
            </a>
          </div>
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

  const busy = step !== 'idle' && step !== 'done' && step !== 'error';

  async function handlePumpFunLaunch() {
    if (!publicKey || !signTransaction || !imageFile) return;
    setError(null);

    try {
      setStep('uploading');
      setStep('signing');
      await launchPumpFunToken({
        agentId,
        metadata: { name, symbol, description, file: imageFile },
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
      await linkExistingToken({
        agentId,
        mintAddress: byotMint,
        name: byotName,
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
            onClick={() => setMode('pumpfun')}
            disabled={busy}
            className="flex-1 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-mono hover:bg-green-500/20 transition-colors disabled:opacity-50"
          >
            Launch on PumpFun
          </button>
          <button
            onClick={() => setMode('byot')}
            disabled={busy}
            className="flex-1 px-3 py-2 rounded-lg bg-atelier/10 border border-atelier/20 text-atelier text-xs font-mono hover:bg-atelier/20 transition-colors disabled:opacity-50"
          >
            Link Existing Token
          </button>
        </div>
      )}

      {mode === 'pumpfun' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Token Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
              className="px-3 py-2 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50 disabled:opacity-50"
            />
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
          <div className="flex gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="px-3 py-2 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-xs font-mono text-gray-600 dark:text-neutral-300 hover:border-atelier/50 transition-colors disabled:opacity-50"
            >
              {imageFile ? imageFile.name.slice(0, 20) : 'Upload Image'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
            <input
              type="number"
              placeholder="Dev buy (SOL)"
              value={devBuy}
              onChange={(e) => setDevBuy(e.target.value)}
              min="0"
              step="0.01"
              disabled={busy}
              className="w-32 px-3 py-2 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50 disabled:opacity-50"
            />
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
              disabled={busy || !name || !symbol || !imageFile}
              className="flex-1 px-3 py-2 rounded-lg bg-green-500 text-black text-xs font-bold font-mono hover:bg-green-400 transition-colors disabled:opacity-50 disabled:hover:bg-green-500"
            >
              Launch Token
            </button>
            <button
              onClick={() => { setMode('none'); setError(null); setStep('idle'); }}
              disabled={busy}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 text-xs font-mono text-gray-600 dark:text-neutral-300 hover:border-neutral-500 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
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
            <input
              type="text"
              placeholder="Token Name"
              value={byotName}
              onChange={(e) => setByotName(e.target.value)}
              disabled={busy}
              className="px-3 py-2 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50 disabled:opacity-50"
            />
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
              className="flex-1 px-3 py-2 rounded-lg bg-atelier text-white text-xs font-bold font-mono hover:bg-atelier-bright transition-colors disabled:opacity-50 disabled:hover:bg-atelier"
            >
              Link Token
            </button>
            <button
              onClick={() => { setMode('none'); setError(null); setStep('idle'); }}
              disabled={busy}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-800 text-xs font-mono text-gray-600 dark:text-neutral-300 hover:border-neutral-500 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
