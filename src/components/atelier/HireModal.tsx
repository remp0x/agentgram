'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { sendUsdcPayment } from '@/lib/solana-pay';
import type { Service } from '@/lib/db';

type Step = 'brief' | 'review' | 'confirmation';

interface HireModalProps {
  service: Service;
  open: boolean;
  onClose: () => void;
}

const PLATFORM_FEE_RATE = 0.10;

export function HireModal({ service, open, onClose }: HireModalProps) {
  const router = useRouter();
  const wallet = useWallet();
  const { connection } = useConnection();
  const { setVisible: openWalletModal } = useWalletModal();

  const [step, setStep] = useState<Step>('brief');
  const [brief, setBrief] = useState('');
  const [referenceUrls, setReferenceUrls] = useState<string[]>(['']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep('brief');
      setBrief('');
      setReferenceUrls(['']);
      setError(null);
      setLoading(false);
      setOrderId(null);
    }
  }, [open]);

  useEffect(() => {
    if (step === 'confirmation' && orderId) {
      const timer = setTimeout(() => {
        router.push(`/atelier/orders/${orderId}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step, orderId, router]);

  const isWorkspace = (service.quota_limit ?? 0) > 0;
  const price = parseFloat(service.price_usd);
  const fee = price * PLATFORM_FEE_RATE;
  const total = price + fee;

  const validUrls = referenceUrls.filter((u) => u.trim().length > 0);

  const handlePay = useCallback(async () => {
    if (!wallet.publicKey) {
      openWalletModal(true);
      return;
    }

    const treasuryWallet = process.env.NEXT_PUBLIC_ATELIER_TREASURY_WALLET;
    if (!treasuryWallet) {
      setError('Treasury wallet not configured');
      return;
    }

    setLoading(true);
    setLoadingMsg('Sending payment...');
    setError(null);

    try {
      const txSig = await sendUsdcPayment(
        connection,
        wallet,
        new PublicKey(treasuryWallet),
        total,
      );

      setLoadingMsg('Creating order...');
      const createRes = await fetch('/api/atelier/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: service.id,
          brief,
          reference_urls: validUrls.length > 0 ? validUrls : undefined,
          client_wallet: wallet.publicKey.toBase58(),
        }),
      });
      const createJson = await createRes.json();
      if (!createJson.success) throw new Error(createJson.error);

      const newOrderId = createJson.data.id;

      setLoadingMsg(isWorkspace ? 'Activating workspace...' : 'Generating... this may take a few minutes');
      const patchRes = await fetch(`/api/atelier/orders/${newOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          action: 'pay',
          payment_method: 'usdc-sol',
          escrow_tx_hash: txSig,
        }),
      });
      const patchJson = await patchRes.json();
      if (!patchJson.success) throw new Error(patchJson.error);

      setOrderId(newOrderId);
      setStep('confirmation');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  }, [wallet, connection, service, brief, validUrls, total, openWalletModal]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-black-soft border border-gray-200 dark:border-neutral-800 rounded-lg shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 className="text-lg font-bold font-display text-black dark:text-white">
            {step === 'confirmation' ? 'Order Placed' : `Hire — ${service.title}`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-neutral-500 hover:text-black dark:hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Steps indicator */}
        {step !== 'confirmation' && (
          <div className="flex items-center gap-2 px-6 pt-4">
            {(['brief', 'review'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold ${
                  step === s
                    ? 'bg-atelier text-white'
                    : s === 'brief' && step === 'review'
                      ? 'bg-emerald-400/20 text-emerald-400'
                      : 'bg-gray-200 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500'
                }`}>
                  {s === 'brief' && step === 'review' ? '✓' : i + 1}
                </div>
                {i === 0 && (
                  <div className={`w-12 h-px ${step === 'review' ? 'bg-emerald-400/40' : 'bg-gray-200 dark:bg-neutral-800'}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-5">
          {step === 'brief' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-gray-600 dark:text-neutral-400 mb-1">
                  {isWorkspace ? 'Project Brief' : 'Brief'}
                </label>
                {isWorkspace && (
                  <p className="text-2xs text-gray-400 dark:text-neutral-500 mb-2">
                    Describe the style, characters, and mood for your project. Each generation will follow this direction.
                  </p>
                )}
                <textarea
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder={isWorkspace
                    ? 'e.g. "Anime girl with long silver hair, blue eyes, school uniform. Soft pastel colors, slice-of-life vibe. All images should feature the same character."'
                    : 'e.g. "A cyberpunk cityscape at night with neon signs in Japanese, rain reflections on the street, anime style"'}
                  rows={4}
                  maxLength={1000}
                  className="w-full px-3 py-2.5 rounded bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 text-black dark:text-white text-sm font-mono placeholder:text-gray-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-atelier resize-none"
                />
                <span className="text-2xs font-mono text-gray-400 dark:text-neutral-600">
                  {brief.length}/1000
                </span>
              </div>

              <div>
                <label className="block text-sm font-mono text-gray-600 dark:text-neutral-400 mb-1.5">
                  Reference URLs <span className="text-gray-400 dark:text-neutral-600">(optional, max 5)</span>
                </label>
                {referenceUrls.map((url, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      value={url}
                      onChange={(e) => {
                        const next = [...referenceUrls];
                        next[i] = e.target.value;
                        setReferenceUrls(next);
                      }}
                      placeholder="https://..."
                      className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 text-black dark:text-white text-sm font-mono placeholder:text-gray-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-atelier"
                    />
                    {referenceUrls.length > 1 && (
                      <button
                        onClick={() => setReferenceUrls(referenceUrls.filter((_, j) => j !== i))}
                        className="text-gray-400 dark:text-neutral-600 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
                {referenceUrls.length < 5 && (
                  <button
                    onClick={() => setReferenceUrls([...referenceUrls, ''])}
                    className="text-xs font-mono text-atelier hover:text-atelier-bright transition-colors"
                  >
                    + Add URL
                  </button>
                )}
              </div>

              <button
                onClick={() => setStep('review')}
                disabled={brief.length < 10}
                className="w-full py-2.5 rounded bg-atelier text-white text-sm font-semibold font-mono uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed btn-atelier btn-primary transition-opacity"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 space-y-3">
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-gray-500 dark:text-neutral-400">Service</span>
                  <span className="text-black dark:text-white font-medium">{service.title}</span>
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-gray-500 dark:text-neutral-400">Price</span>
                  <span className="text-black dark:text-white">${price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-gray-500 dark:text-neutral-400">Platform fee (10%)</span>
                  <span className="text-black dark:text-white">${fee.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-neutral-800 pt-3 flex justify-between text-sm font-mono font-bold">
                  <span className="text-black dark:text-white">Total</span>
                  <span className="text-atelier">${total.toFixed(2)} USDC</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800">
                <p className="text-xs font-mono text-gray-500 dark:text-neutral-400 mb-1">Your brief:</p>
                <p className="text-sm text-black dark:text-white">{brief}</p>
              </div>

              {error && (
                <p className="text-sm text-red-400 font-mono">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('brief')}
                  className="px-4 py-2.5 rounded border border-gray-200 dark:border-neutral-800 text-gray-500 dark:text-neutral-400 text-sm font-mono btn-atelier btn-secondary hover:text-atelier hover:border-atelier/40 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handlePay}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded bg-atelier text-white text-sm font-semibold font-mono uppercase tracking-wider disabled:opacity-60 btn-atelier btn-primary transition-opacity flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      {loadingMsg}
                    </>
                  ) : !wallet.publicKey ? (
                    'Connect Wallet'
                  ) : (
                    `Pay $${total.toFixed(2)} USDC`
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'confirmation' && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-400/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-lg font-bold font-display text-black dark:text-white mb-2">
                {isWorkspace ? 'Workspace ready!' : 'Order placed!'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-neutral-400 font-mono mb-4">
                {isWorkspace ? 'Your workspace is ready! Start generating. Redirecting...' : 'Your order is being processed. Redirecting...'}
              </p>
              <a
                href={`/atelier/orders/${orderId}`}
                className="text-sm font-mono text-atelier hover:text-atelier-bright transition-colors"
              >
                View Order →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
