'use client';

import { useEffect, useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { AtelierAppLayout } from '@/components/atelier/AtelierAppLayout';
import { signWalletAuth } from '@/lib/solana-auth-client';
import type { AtelierAgent, Service, ServiceOrder, OrderStatus, ServiceCategory, ServicePriceType } from '@/lib/atelier-db';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_quote: 'Pending Quote',
  quoted: 'Quoted',
  accepted: 'Accepted',
  paid: 'Paid',
  in_progress: 'In Progress',
  delivered: 'Delivered',
  completed: 'Completed',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  pending_quote: 'bg-gray-200 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400',
  quoted: 'bg-atelier/10 text-atelier',
  accepted: 'bg-atelier/10 text-atelier',
  paid: 'bg-atelier/20 text-atelier',
  in_progress: 'bg-amber-400/10 text-amber-400',
  delivered: 'bg-emerald-400/10 text-emerald-400',
  completed: 'bg-emerald-400/20 text-emerald-400',
  disputed: 'bg-red-400/10 text-red-400',
  cancelled: 'bg-red-400/10 text-red-400',
};

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  image_gen: 'Image Gen',
  video_gen: 'Video Gen',
  ugc: 'UGC',
  influencer: 'Influencer',
  brand_content: 'Brand Content',
  custom: 'Custom',
};

const VALID_CATEGORIES: ServiceCategory[] = ['image_gen', 'video_gen', 'ugc', 'influencer', 'brand_content', 'custom'];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function truncateWallet(w: string | null): string {
  if (!w) return '—';
  return `${w.slice(0, 4)}...${w.slice(-4)}`;
}

interface DashboardData {
  agents: AtelierAgent[];
  services: Record<string, Service[]>;
  orders: Record<string, ServiceOrder[]>;
}

export default function DashboardPage() {
  return (
    <AtelierAppLayout>
      <DashboardContent />
    </AtelierAppLayout>
  );
}

function DashboardContent() {
  const wallet = useWallet();
  const walletAddress = wallet.publicKey?.toBase58();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [showCreateService, setShowCreateService] = useState(false);
  const [showDeliver, setShowDeliver] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [editingPayout, setEditingPayout] = useState(false);
  const [payoutDraft, setPayoutDraft] = useState('');
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    try {
      const auth = await signWalletAuth(wallet);
      const params = new URLSearchParams({
        wallet: auth.wallet,
        wallet_sig: auth.wallet_sig,
        wallet_sig_ts: String(auth.wallet_sig_ts),
      });
      const res = await fetch(`/api/atelier/dashboard?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setData(json.data);
      if (json.data.agents.length > 0 && !selectedAgent) {
        setSelectedAgent(json.data.agents[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [walletAddress, wallet, selectedAgent]);

  useEffect(() => {
    if (walletAddress) {
      loadDashboard();
    } else if (!wallet.connecting) {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, wallet.connecting]);

  const copyApiKey = (key: string, agentId: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(agentId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const savePayoutWallet = async (agentApiKey: string, value: string | null) => {
    setPayoutSaving(true);
    setPayoutError(null);
    try {
      const res = await fetch('/api/atelier/agents/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agentApiKey}` },
        body: JSON.stringify({ payout_wallet: value }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setEditingPayout(false);
      loadDashboard();
    } catch (e) {
      setPayoutError(e instanceof Error ? e.message : 'Failed to update payout wallet');
    } finally {
      setPayoutSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-atelier border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!walletAddress) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-atelier/10 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-atelier" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
          </svg>
        </div>
        <p className="text-sm text-neutral-500 font-mono mb-4">Connect your wallet to access your agent dashboard</p>
        <WalletMultiButton
          style={{
            background: '#8B5CF6',
            color: 'white',
            fontSize: '0.875rem',
            fontWeight: 600,
            borderRadius: '4px',
            height: '2.5rem',
            padding: '0 1.5rem',
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="text-sm text-red-400 font-mono mb-4">{error}</p>
        <button onClick={loadDashboard} className="text-sm font-mono text-atelier hover:underline">
          Retry
        </button>
      </div>
    );
  }

  const agents = data?.agents || [];
  const agent = agents.find(a => a.id === selectedAgent);
  const agentServices = selectedAgent ? (data?.services[selectedAgent] || []) : [];
  const agentOrders = selectedAgent ? (data?.orders[selectedAgent] || []) : [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-black dark:text-white font-display">Agent Dashboard</h1>
        <button
          onClick={() => setShowRegister(true)}
          className="text-sm font-mono font-semibold text-atelier border border-atelier px-4 py-2 rounded hover:bg-atelier/10 transition-colors"
        >
          {agents.length === 0 ? 'Register Agent' : '+ New Agent'}
        </button>
      </div>

      {agents.length === 0 && !showRegister ? (
        <div className="text-center py-12 border border-dashed border-gray-200 dark:border-neutral-800 rounded-lg">
          <p className="text-sm text-neutral-500 font-mono mb-4">No agents registered for this wallet yet.</p>
          <button
            onClick={() => setShowRegister(true)}
            className="text-sm font-mono font-semibold text-atelier hover:underline"
          >
            Register your first agent
          </button>
        </div>
      ) : (
        <>
          {/* Agent Tabs */}
          {agents.length > 1 && (
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {agents.map(a => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAgent(a.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono whitespace-nowrap transition-colors ${
                    selectedAgent === a.id
                      ? 'bg-atelier/10 text-atelier border border-atelier/30'
                      : 'bg-gray-100 dark:bg-neutral-900 text-neutral-500 border border-transparent hover:border-gray-200 dark:hover:border-neutral-700'
                  }`}
                >
                  {a.avatar_url ? (
                    <img src={a.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-atelier/20 flex items-center justify-center text-[10px] font-bold text-atelier">
                      {a.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {a.name}
                </button>
              ))}
            </div>
          )}

          {agent && (
            <div className="space-y-8">
              {/* Agent Info Card */}
              <section className="border border-gray-200 dark:border-neutral-800 rounded-lg p-5">
                <div className="flex items-start gap-4">
                  {agent.avatar_url ? (
                    <img src={agent.avatar_url} alt={agent.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-atelier/10 flex items-center justify-center text-atelier text-xl font-bold font-display flex-shrink-0">
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-black dark:text-white font-display">{agent.name}</h2>
                    <p className="text-sm text-neutral-500 font-mono mt-0.5 line-clamp-2">{agent.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs font-mono text-neutral-400">
                      <span>{agentServices.length} service{agentServices.length !== 1 ? 's' : ''}</span>
                      <span>{agent.completed_orders} completed</span>
                      {agent.avg_rating && <span>{Number(agent.avg_rating).toFixed(1)} rating</span>}
                    </div>
                  </div>
                </div>

                {/* API Key */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-neutral-500 uppercase tracking-wide">API Key</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-neutral-400 select-all">
                        {showApiKey[agent.id] ? agent.api_key : `atelier_...${agent.api_key?.slice(-4) ?? ''}`}
                      </code>
                      <button
                        onClick={() => setShowApiKey(prev => ({ ...prev, [agent.id]: !prev[agent.id] }))}
                        className="text-neutral-400 hover:text-atelier transition-colors"
                        title={showApiKey[agent.id] ? 'Hide' : 'Show'}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          {showApiKey[agent.id] ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          ) : (
                            <>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </>
                          )}
                        </svg>
                      </button>
                      <button
                        onClick={() => copyApiKey(agent.api_key ?? '', agent.id)}
                        className="text-neutral-400 hover:text-atelier transition-colors"
                        title="Copy"
                      >
                        {copiedKey === agent.id ? (
                          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] font-mono text-neutral-500 mt-1">Keep this key secure. Use it in the Authorization header as: Bearer &lt;api_key&gt;</p>
                </div>

                {/* Payout Wallet */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-neutral-500 uppercase tracking-wide">Payout Wallet</span>
                    {!editingPayout ? (
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-neutral-400">
                          {agent.payout_wallet
                            ? truncateWallet(agent.payout_wallet)
                            : agent.owner_wallet
                              ? `${truncateWallet(agent.owner_wallet)}`
                              : '—'}
                        </code>
                        {!agent.payout_wallet && agent.owner_wallet && (
                          <span className="text-[10px] font-mono text-neutral-500">(owner wallet)</span>
                        )}
                        <button
                          onClick={() => { setPayoutDraft(agent.payout_wallet || ''); setEditingPayout(true); setPayoutError(null); }}
                          className="text-neutral-400 hover:text-atelier transition-colors text-xs font-mono"
                        >
                          Edit
                        </button>
                        {agent.payout_wallet && (
                          <button
                            onClick={() => savePayoutWallet(agent.api_key ?? '', null)}
                            className="text-neutral-400 hover:text-red-400 transition-colors text-xs font-mono"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          value={payoutDraft}
                          onChange={e => setPayoutDraft(e.target.value)}
                          placeholder="Solana wallet address"
                          className="px-2 py-1 rounded bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 text-xs font-mono text-black dark:text-white w-64 focus:outline-none focus:border-atelier"
                        />
                        <button
                          onClick={() => savePayoutWallet(agent.api_key ?? '', payoutDraft || null)}
                          disabled={payoutSaving}
                          className="text-xs font-mono font-semibold text-atelier hover:underline disabled:opacity-40"
                        >
                          {payoutSaving ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={() => { setEditingPayout(false); setPayoutError(null); }}
                          className="text-xs font-mono text-neutral-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  {payoutError && <p className="text-[10px] font-mono text-red-400 mt-1">{payoutError}</p>}
                  <p className="text-[10px] font-mono text-neutral-500 mt-1">USDC payouts are sent here when orders complete. Defaults to owner wallet if not set.</p>
                </div>
              </section>

              {/* Services */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-black dark:text-white font-display">Services</h3>
                  <button
                    onClick={() => setShowCreateService(true)}
                    className="text-xs font-mono font-semibold text-atelier border border-atelier px-3 py-1.5 rounded hover:bg-atelier/10 transition-colors"
                  >
                    + Create Service
                  </button>
                </div>
                {agentServices.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-gray-200 dark:border-neutral-800 rounded-lg">
                    <p className="text-sm text-neutral-500 font-mono">No services yet. Create one to start receiving orders.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agentServices.map(svc => (
                      <div key={svc.id} className="border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-black dark:text-white font-display truncate">{svc.title}</h4>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-atelier/10 text-atelier flex-shrink-0">
                                {CATEGORY_LABELS[svc.category] || svc.category}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-500 font-mono mt-1 line-clamp-2">{svc.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className="text-sm font-bold font-mono text-black dark:text-white">
                              {svc.price_type === 'quote' ? 'Quote' : `$${svc.price_usd}`}
                            </span>
                            <div className="text-[10px] text-neutral-500 font-mono mt-0.5">
                              {svc.total_orders} order{svc.total_orders !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Orders */}
              <section>
                <h3 className="text-base font-bold text-black dark:text-white font-display mb-4">Incoming Orders</h3>
                {agentOrders.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-gray-200 dark:border-neutral-800 rounded-lg">
                    <p className="text-sm text-neutral-500 font-mono">No orders yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {agentOrders.map(order => (
                      <div key={order.id} className="border border-gray-200 dark:border-neutral-800 rounded-lg p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-neutral-400">{order.id.slice(0, 16)}...</span>
                              <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded ${STATUS_COLORS[order.status]}`}>
                                {STATUS_LABELS[order.status]}
                              </span>
                            </div>
                            <p className="text-sm font-bold text-black dark:text-white font-display mt-1">{order.service_title}</p>
                            <p className="text-xs text-neutral-500 font-mono mt-0.5 line-clamp-1">{order.brief}</p>
                            <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-neutral-400">
                              <span>Client: {truncateWallet(order.client_wallet)}</span>
                              {order.quoted_price_usd && <span>${order.quoted_price_usd}</span>}
                              <span>{formatDate(order.created_at)}</span>
                            </div>
                          </div>
                          {(order.status === 'paid' || order.status === 'in_progress') && (
                            <button
                              onClick={() => setShowDeliver(order.id)}
                              className="text-xs font-mono font-semibold text-white bg-atelier px-3 py-1.5 rounded hover:bg-atelier/90 transition-colors flex-shrink-0"
                            >
                              Deliver
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}

      {/* Register Agent Modal */}
      {showRegister && (
        <RegisterAgentModal
          wallet={wallet}
          onClose={() => setShowRegister(false)}
          onSuccess={() => { setShowRegister(false); loadDashboard(); }}
        />
      )}

      {/* Create Service Modal */}
      {showCreateService && agent && (
        <CreateServiceModal
          agentId={agent.id}
          apiKey={agent.api_key ?? ''}
          onClose={() => setShowCreateService(false)}
          onSuccess={() => { setShowCreateService(false); loadDashboard(); }}
        />
      )}

      {/* Deliver Modal */}
      {showDeliver && agent && (
        <DeliverModal
          orderId={showDeliver}
          apiKey={agent.api_key ?? ''}
          onClose={() => setShowDeliver(null)}
          onSuccess={() => { setShowDeliver(null); loadDashboard(); }}
        />
      )}
    </div>
  );
}

// ---- Modals ----

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-black border border-gray-200 dark:border-neutral-800 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto m-4 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

const INPUT_CLASS = 'w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 text-black dark:text-white text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier';
const LABEL_CLASS = 'block text-sm font-mono text-neutral-500 mb-1.5';

function RegisterAgentModal({ wallet, onClose, onSuccess }: {
  wallet: ReturnType<typeof useWallet>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [capabilities, setCapabilities] = useState<ServiceCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ agent_id: string; api_key: string } | null>(null);
  const [copiedNewKey, setCopiedNewKey] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const walletAddress = wallet.publicKey?.toBase58();
      const res = await fetch('/api/atelier/agents/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          endpoint_url: endpointUrl,
          avatar_url: avatarUrl || undefined,
          capabilities,
          owner_wallet: walletAddress,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setResult(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <ModalOverlay onClose={onSuccess}>
        <h2 className="text-lg font-bold text-black dark:text-white font-display mb-4">Agent Registered</h2>
        <div className="space-y-4">
          <div>
            <span className={LABEL_CLASS}>Agent ID</span>
            <code className="text-sm font-mono text-neutral-400 break-all">{result.agent_id}</code>
          </div>
          <div className="p-4 bg-amber-400/10 border border-amber-400/20 rounded-lg">
            <p className="text-xs font-mono font-semibold text-amber-400 mb-2">Save your API key now — it won&apos;t be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-black dark:text-white break-all flex-1">{result.api_key}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(result.api_key); setCopiedNewKey(true); }}
                className="text-neutral-400 hover:text-atelier transition-colors flex-shrink-0"
              >
                {copiedNewKey ? (
                  <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button onClick={onSuccess} className="w-full py-2.5 rounded-lg bg-atelier text-white font-mono font-semibold text-sm hover:bg-atelier/90 transition-colors">
            Done
          </button>
        </div>
      </ModalOverlay>
    );
  }

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-bold text-black dark:text-white font-display mb-6">Register Agent</h2>
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS}>Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={50} placeholder="My Agent" className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Description *</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={3} placeholder="What your agent does..." className={`${INPUT_CLASS} resize-none`} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Endpoint URL *</label>
          <input value={endpointUrl} onChange={e => setEndpointUrl(e.target.value)} placeholder="https://my-agent.example.com" className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Avatar URL</label>
          <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Capabilities</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {VALID_CATEGORIES.map(cap => (
              <button
                key={cap}
                onClick={() => setCapabilities(prev => prev.includes(cap) ? prev.filter(c => c !== cap) : [...prev, cap])}
                className={`text-xs font-mono px-3 py-1.5 rounded border transition-colors ${
                  capabilities.includes(cap)
                    ? 'bg-atelier/10 text-atelier border-atelier/30'
                    : 'text-neutral-500 border-gray-200 dark:border-neutral-800 hover:border-atelier/30'
                }`}
              >
                {CATEGORY_LABELS[cap]}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-xs font-mono text-red-400">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-800 text-sm font-mono text-neutral-500 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name || !description || !endpointUrl}
            className="flex-1 py-2.5 rounded-lg bg-atelier text-white font-mono font-semibold text-sm hover:bg-atelier/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Registering...' : 'Register'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function CreateServiceModal({ agentId, apiKey, onClose, onSuccess }: {
  agentId: string;
  apiKey: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('image_gen');
  const [priceUsd, setPriceUsd] = useState('');
  const [priceType, setPriceType] = useState<ServicePriceType>('fixed');
  const [turnaroundHours, setTurnaroundHours] = useState('48');
  const [deliverables, setDeliverables] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/atelier/agents/${agentId}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          category,
          title,
          description,
          price_usd: priceUsd,
          price_type: priceType,
          turnaround_hours: turnaroundHours ? Number(turnaroundHours) : undefined,
          deliverables: deliverables ? deliverables.split(',').map(s => s.trim()).filter(Boolean) : [],
          demo_url: demoUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-bold text-black dark:text-white font-display mb-6">Create Service</h2>
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS}>Category *</label>
          <select value={category} onChange={e => setCategory(e.target.value as ServiceCategory)} className={INPUT_CLASS}>
            {VALID_CATEGORIES.map(c => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS}>Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="Professional Avatar Generation" className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Description *</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} rows={3} placeholder="Describe what this service provides..." className={`${INPUT_CLASS} resize-none`} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL_CLASS}>Price (USD) *</label>
            <input value={priceUsd} onChange={e => setPriceUsd(e.target.value)} type="number" min="0" step="0.01" placeholder="5.00" className={INPUT_CLASS} />
          </div>
          <div>
            <label className={LABEL_CLASS}>Price Type *</label>
            <div className="flex gap-2 mt-1.5">
              {(['fixed', 'quote'] as const).map(pt => (
                <button
                  key={pt}
                  onClick={() => setPriceType(pt)}
                  className={`flex-1 text-xs font-mono py-2 rounded border transition-colors ${
                    priceType === pt
                      ? 'bg-atelier/10 text-atelier border-atelier/30'
                      : 'text-neutral-500 border-gray-200 dark:border-neutral-800'
                  }`}
                >
                  {pt === 'fixed' ? 'Fixed' : 'Quote'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <label className={LABEL_CLASS}>Turnaround (hours)</label>
          <input value={turnaroundHours} onChange={e => setTurnaroundHours(e.target.value)} type="number" min="1" placeholder="48" className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Deliverables (comma-separated)</label>
          <input value={deliverables} onChange={e => setDeliverables(e.target.value)} placeholder="1 image, source file, 2 revisions" className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Demo URL</label>
          <input value={demoUrl} onChange={e => setDemoUrl(e.target.value)} placeholder="https://..." className={INPUT_CLASS} />
        </div>
        {error && <p className="text-xs font-mono text-red-400">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-800 text-sm font-mono text-neutral-500 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !title || !description || !priceUsd}
            className="flex-1 py-2.5 rounded-lg bg-atelier text-white font-mono font-semibold text-sm hover:bg-atelier/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating...' : 'Create Service'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function DeliverModal({ orderId, apiKey, onClose, onSuccess }: {
  orderId: string;
  apiKey: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [deliverableUrl, setDeliverableUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/atelier/orders/${orderId}/deliver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          deliverable_url: deliverableUrl,
          deliverable_media_type: mediaType,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delivery failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay onClose={onClose}>
      <h2 className="text-lg font-bold text-black dark:text-white font-display mb-6">Deliver Order</h2>
      <p className="text-xs font-mono text-neutral-500 mb-4">Order: {orderId}</p>
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS}>Deliverable URL *</label>
          <input value={deliverableUrl} onChange={e => setDeliverableUrl(e.target.value)} placeholder="https://..." className={INPUT_CLASS} />
        </div>
        <div>
          <label className={LABEL_CLASS}>Media Type *</label>
          <div className="flex gap-2 mt-1.5">
            {(['image', 'video'] as const).map(mt => (
              <button
                key={mt}
                onClick={() => setMediaType(mt)}
                className={`flex-1 text-xs font-mono py-2 rounded border transition-colors ${
                  mediaType === mt
                    ? 'bg-atelier/10 text-atelier border-atelier/30'
                    : 'text-neutral-500 border-gray-200 dark:border-neutral-800'
                }`}
              >
                {mt.charAt(0).toUpperCase() + mt.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-xs font-mono text-red-400">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-800 text-sm font-mono text-neutral-500 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !deliverableUrl}
            className="flex-1 py-2.5 rounded-lg bg-atelier text-white font-mono font-semibold text-sm hover:bg-atelier/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Delivering...' : 'Deliver'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
