'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AtelierAppLayout } from '@/components/atelier/AtelierAppLayout';

const ATELIER_WALLET = 'EZkoXXZ5HEWdKwfv7wua7k6Dqv8aQxxHWNakq2gG2Qpb';

interface BalanceData {
  vault_balance_lamports: number;
  vault_balance_sol: number;
  total_swept_lamports: number;
  total_paid_out_lamports: number;
}

interface Sweep {
  id: string;
  amount_lamports: number;
  tx_hash: string;
  swept_at: string;
}

interface Payout {
  id: string;
  recipient_wallet: string;
  agent_id: string;
  token_mint: string;
  amount_lamports: number;
  tx_hash: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface ManagedToken {
  id: string;
  name: string;
  token_mint: string;
  token_creator_wallet: string | null;
}

function lamportsToSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(6);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function FeesAdminPage() {
  return (
    <AtelierAppLayout>
      <FeesContent />
    </AtelierAppLayout>
  );
}

function FeesContent() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [walletSol, setWalletSol] = useState<number | null>(null);
  const [sweeps, setSweeps] = useState<Sweep[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [tokens, setTokens] = useState<ManagedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [payingOut, setPayingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payoutWallet, setPayoutWallet] = useState('');
  const [payoutAgentId, setPayoutAgentId] = useState('');
  const [payoutMint, setPayoutMint] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');

  const isAdmin = publicKey?.toBase58() === ATELIER_WALLET;

  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [balRes, sweepRes, payoutRes, tokensRes, solBalance] = await Promise.all([
        fetch('/api/atelier/fees/balance').then(r => r.json()),
        fetch('/api/atelier/fees/sweeps').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/atelier/fees/payouts').then(r => r.json()).catch(() => ({ success: false })),
        fetch('/api/atelier/agents?source=all&limit=200').then(r => r.json()),
        connection.getBalance(publicKey!),
      ]);

      if (balRes.success) setBalance(balRes.data);
      if (sweepRes.success) setSweeps(sweepRes.data || []);
      if (payoutRes.success) setPayouts(payoutRes.data || []);

      setWalletSol(solBalance / LAMPORTS_PER_SOL);

      if (tokensRes.success) {
        const managed = (tokensRes.data?.agents || [])
          .filter((a: Record<string, unknown>) => a.token_mint && a.token_mode === 'pumpfun')
          .map((a: Record<string, unknown>) => ({
            id: a.id as string,
            name: a.name as string,
            token_mint: a.token_mint as string,
            token_creator_wallet: (a.token_creator_wallet as string) || null,
          }));
        setTokens(managed);
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, publicKey, connection]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCollect() {
    const adminKey = prompt('Enter admin key:');
    if (!adminKey) return;

    setCollecting(true);
    setError(null);
    try {
      const res = await fetch('/api/atelier/fees/collect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Collect failed');
    } finally {
      setCollecting(false);
    }
  }

  async function handlePayout() {
    const adminKey = prompt('Enter admin key:');
    if (!adminKey) return;

    setPayingOut(true);
    setError(null);
    try {
      const res = await fetch('/api/atelier/fees/payout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient_wallet: payoutWallet,
          agent_id: payoutAgentId,
          token_mint: payoutMint,
          amount_lamports: Math.floor(parseFloat(payoutAmount) * LAMPORTS_PER_SOL),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setPayoutWallet('');
      setPayoutAgentId('');
      setPayoutMint('');
      setPayoutAmount('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payout failed');
    } finally {
      setPayingOut(false);
    }
  }

  if (!publicKey) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-neutral-500 font-mono text-sm">Connect wallet to access fee dashboard</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-neutral-500 font-mono text-sm">Admin only</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-atelier border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      <h1 className="text-2xl font-bold font-display">Creator Fee Dashboard</h1>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono">
          {error}
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 font-mono mb-1">Vault Balance</p>
          <p className="text-xl font-bold font-mono">{balance ? lamportsToSol(balance.vault_balance_lamports) : '—'} SOL</p>
          <button
            onClick={handleCollect}
            disabled={collecting || !balance || balance.vault_balance_lamports === 0}
            className="mt-2 px-3 py-1.5 rounded text-xs font-mono bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors disabled:opacity-50"
          >
            {collecting ? 'Collecting...' : 'Collect Fees'}
          </button>
        </div>

        <div className="p-4 rounded-lg bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 font-mono mb-1">Wallet SOL Balance</p>
          <p className="text-xl font-bold font-mono">{walletSol !== null ? walletSol.toFixed(4) : '—'} SOL</p>
          <p className="text-2xs text-neutral-500 font-mono mt-1">For payouts</p>
        </div>

        <div className="p-4 rounded-lg bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-500 font-mono mb-1">Total Swept / Paid Out</p>
          <p className="text-xl font-bold font-mono">
            {balance ? lamportsToSol(balance.total_swept_lamports) : '—'} / {balance ? lamportsToSol(balance.total_paid_out_lamports) : '—'}
          </p>
          <p className="text-2xs text-neutral-500 font-mono mt-1">SOL</p>
        </div>
      </div>

      {/* Tokens Managed */}
      <div>
        <h2 className="text-lg font-bold font-display mb-3">Tokens Managed ({tokens.length})</h2>
        {tokens.length === 0 ? (
          <p className="text-sm text-neutral-500 font-mono">No PumpFun tokens launched yet</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-800">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="bg-gray-50 dark:bg-black-soft text-neutral-500">
                  <th className="px-3 py-2 text-left">Agent</th>
                  <th className="px-3 py-2 text-left">Mint</th>
                  <th className="px-3 py-2 text-left">Creator Wallet</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id} className="border-t border-gray-200 dark:border-neutral-800">
                    <td className="px-3 py-2">{t.name}</td>
                    <td className="px-3 py-2 text-atelier">{truncAddr(t.token_mint)}</td>
                    <td className="px-3 py-2 text-neutral-400">{t.token_creator_wallet ? truncAddr(t.token_creator_wallet) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout Form */}
      <div>
        <h2 className="text-lg font-bold font-display mb-3">Send Payout</h2>
        <div className="p-4 rounded-lg bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-neutral-800 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Recipient Wallet"
              value={payoutWallet}
              onChange={(e) => setPayoutWallet(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50"
            />
            <input
              type="text"
              placeholder="Agent ID"
              value={payoutAgentId}
              onChange={(e) => setPayoutAgentId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Token Mint"
              value={payoutMint}
              onChange={(e) => setPayoutMint(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50"
            />
            <input
              type="text"
              placeholder="Amount (SOL)"
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white dark:bg-black-light border border-gray-200 dark:border-neutral-800 text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier/50"
            />
          </div>
          <button
            onClick={handlePayout}
            disabled={payingOut || !payoutWallet || !payoutAgentId || !payoutMint || !payoutAmount}
            className="px-4 py-2 rounded-lg bg-atelier text-white text-xs font-bold font-mono hover:bg-atelier-bright transition-colors disabled:opacity-50"
          >
            {payingOut ? 'Sending...' : 'Send Payout'}
          </button>
        </div>
      </div>

      {/* Sweep History */}
      <div>
        <h2 className="text-lg font-bold font-display mb-3">Sweep History</h2>
        {sweeps.length === 0 ? (
          <p className="text-sm text-neutral-500 font-mono">No sweeps recorded</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-800">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="bg-gray-50 dark:bg-black-soft text-neutral-500">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Amount (SOL)</th>
                  <th className="px-3 py-2 text-left">Tx</th>
                </tr>
              </thead>
              <tbody>
                {sweeps.map((s) => (
                  <tr key={s.id} className="border-t border-gray-200 dark:border-neutral-800">
                    <td className="px-3 py-2">{formatDate(s.swept_at)}</td>
                    <td className="px-3 py-2 text-right text-green-400">{lamportsToSol(s.amount_lamports)}</td>
                    <td className="px-3 py-2">
                      <a
                        href={`https://solscan.io/tx/${s.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-atelier hover:underline"
                      >
                        {truncAddr(s.tx_hash)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout History */}
      <div>
        <h2 className="text-lg font-bold font-display mb-3">Payout History</h2>
        {payouts.length === 0 ? (
          <p className="text-sm text-neutral-500 font-mono">No payouts recorded</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-neutral-800">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="bg-gray-50 dark:bg-black-soft text-neutral-500">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Recipient</th>
                  <th className="px-3 py-2 text-right">Amount (SOL)</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Tx</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-t border-gray-200 dark:border-neutral-800">
                    <td className="px-3 py-2">{formatDate(p.created_at)}</td>
                    <td className="px-3 py-2 text-neutral-400">{truncAddr(p.recipient_wallet)}</td>
                    <td className="px-3 py-2 text-right">{lamportsToSol(p.amount_lamports)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-2xs ${
                        p.status === 'paid' ? 'bg-green-500/10 text-green-400' : 'bg-amber-400/10 text-amber-400'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {p.tx_hash ? (
                        <a
                          href={`https://solscan.io/tx/${p.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-atelier hover:underline"
                        >
                          {truncAddr(p.tx_hash)}
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
