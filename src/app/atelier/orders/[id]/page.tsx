'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { AtelierAppLayout } from '@/components/atelier/AtelierAppLayout';
import type { ServiceOrder, ServiceReview, OrderStatus, OrderDeliverable } from '@/lib/db';

interface OrderData {
  order: ServiceOrder;
  review: ServiceReview | null;
  deliverables: OrderDeliverable[];
}

type StepState = 'done' | 'active' | 'pending';

interface TimelineStep {
  label: string;
  state: StepState;
  timestamp: string | null;
  content: React.ReactNode | null;
}

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
  pending_quote: 'bg-neutral-500/20 text-neutral-300',
  quoted: 'bg-atelier/10 text-atelier-bright',
  accepted: 'bg-atelier/10 text-atelier-bright',
  paid: 'bg-atelier/20 text-atelier-bright',
  in_progress: 'bg-amber-400/10 text-amber-400',
  delivered: 'bg-emerald-400/10 text-emerald-400',
  completed: 'bg-emerald-400/20 text-emerald-400',
  disputed: 'bg-red-400/10 text-red-400',
  cancelled: 'bg-red-400/10 text-red-400',
};

const STATUS_SEQUENCE: OrderStatus[] = [
  'pending_quote', 'quoted', 'accepted', 'paid', 'in_progress', 'delivered', 'completed',
];

function statusIndex(status: OrderStatus): number {
  const idx = STATUS_SEQUENCE.indexOf(status);
  return idx === -1 ? -1 : idx;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function truncateId(id: string): string {
  return id.length > 16 ? `${id.slice(0, 8)}...${id.slice(-6)}` : id;
}

function formatTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

function buildTimeline(order: ServiceOrder, review: ServiceReview | null): TimelineStep[] {
  const idx = statusIndex(order.status);
  const isTerminal = order.status === 'cancelled' || order.status === 'disputed';

  const steps: TimelineStep[] = [
    {
      label: 'Order Placed',
      state: 'done',
      timestamp: order.created_at,
      content: (
        <p className="text-sm text-neutral-400">{order.brief}</p>
      ),
    },
    {
      label: 'Quote Received',
      state: idx >= 1 ? 'done' : isTerminal ? 'pending' : (idx === 0 ? 'active' : 'pending'),
      timestamp: idx >= 1 ? order.created_at : null,
      content: order.quoted_price_usd ? (
        <div className="flex items-center gap-3 text-sm font-mono">
          <span className="text-white">${order.quoted_price_usd}</span>
          {order.platform_fee_usd && (
            <span className="text-neutral-400">+ ${order.platform_fee_usd} fee</span>
          )}
        </div>
      ) : null,
    },
    {
      label: 'Payment Confirmed',
      state: idx >= 3 ? 'done' : isTerminal ? 'pending' : (idx === 2 ? 'active' : 'pending'),
      timestamp: null,
      content: idx >= 3 ? (
        <div className="text-sm font-mono space-y-1">
          {order.payment_method && <p className="text-neutral-400">{order.payment_method}</p>}
          {order.escrow_tx_hash && (
            <p className="text-neutral-400 break-all">
              tx: <span className="text-atelier-bright">{truncateId(order.escrow_tx_hash)}</span>
            </p>
          )}
        </div>
      ) : null,
    },
    {
      label: 'Generation Started',
      state: idx >= 4 ? 'done' : isTerminal ? 'pending' : (idx === 3 ? 'active' : 'pending'),
      timestamp: null,
      content: null,
    },
    {
      label: 'Delivered',
      state: idx >= 5 ? 'done' : isTerminal ? 'pending' : (idx === 4 ? 'active' : 'pending'),
      timestamp: order.delivered_at,
      content: idx >= 5 ? (
        <DeliverableMedia
          url={order.deliverable_url}
          mediaType={order.deliverable_media_type}
        />
      ) : null,
    },
    {
      label: 'Completed',
      state: idx >= 6 ? 'done' : isTerminal ? 'pending' : (idx === 5 ? 'active' : 'pending'),
      timestamp: order.completed_at,
      content: idx >= 6 && review ? (
        <ReviewInline review={review} />
      ) : null,
    },
  ];

  if (isTerminal) {
    steps.push({
      label: order.status === 'cancelled' ? 'Cancelled' : 'Disputed',
      state: 'done',
      timestamp: null,
      content: null,
    });
  }

  return steps;
}

function DeliverableMedia({ url, mediaType }: { url: string | null; mediaType: string | null }) {
  if (!url) return null;

  if (mediaType === 'video') {
    return (
      <video
        src={url}
        controls
        playsInline
        className="w-full max-w-md rounded-lg border border-neutral-800 mt-2"
      />
    );
  }

  return (
    <img
      src={url}
      alt="Deliverable"
      className="w-full max-w-md rounded-lg border border-neutral-800 mt-2"
    />
  );
}

function ReviewInline({ review }: { review: ServiceReview }) {
  return (
    <div className="mt-2 p-3 rounded-lg bg-black-soft border border-neutral-800">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold">{review.reviewer_name}</span>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg
              key={i}
              className={`w-3.5 h-3.5 ${i < review.rating ? 'text-atelier' : 'text-neutral-800'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
      </div>
      {review.comment && <p className="text-sm text-neutral-400">{review.comment}</p>}
    </div>
  );
}

function TimelineDot({ state, isTerminal }: { state: StepState; isTerminal: boolean }) {
  if (isTerminal) {
    return (
      <div className="w-3.5 h-3.5 rounded-full bg-red-400 ring-4 ring-red-400/20 shrink-0" />
    );
  }

  if (state === 'done') {
    return (
      <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20 shrink-0" />
    );
  }

  if (state === 'active') {
    return (
      <div className="w-3.5 h-3.5 rounded-full bg-atelier animate-pulse-atelier ring-4 ring-atelier/20 shrink-0" />
    );
  }

  return (
    <div className="w-3.5 h-3.5 rounded-full bg-neutral-800 border border-neutral-600 shrink-0" />
  );
}

function WorkspaceView({ data, onRefresh }: { data: OrderData; onRefresh: () => void }) {
  const { order, deliverables: initialDeliverables } = data;
  const wallet = useWallet();
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [deliverables, setDeliverables] = useState<OrderDeliverable[]>(initialDeliverables);
  const [quotaUsed, setQuotaUsed] = useState(order.quota_used);
  const [timeRemaining, setTimeRemaining] = useState(
    order.workspace_expires_at ? formatTimeRemaining(order.workspace_expires_at) : '',
  );
  const [approving, setApproving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const isActive = order.status === 'in_progress';
  const isExpired = order.workspace_expires_at
    ? new Date(order.workspace_expires_at) <= new Date()
    : false;
  const quotaRemaining = order.quota_total - quotaUsed;
  const canGenerate = isActive && !isExpired && quotaRemaining > 0 && !generating;

  useEffect(() => {
    if (!order.workspace_expires_at) return;

    const tick = () => {
      const remaining = formatTimeRemaining(order.workspace_expires_at!);
      setTimeRemaining(remaining);
      if (remaining === 'Expired' && order.status === 'in_progress') {
        onRefresh();
      }
    };

    tick();
    timerRef.current = setInterval(tick, 60_000);
    return () => clearInterval(timerRef.current);
  }, [order.workspace_expires_at, order.status, onRefresh]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || !wallet.publicKey || !prompt.trim()) return;

    setGenerating(true);
    setGenError(null);

    try {
      const res = await fetch(`/api/atelier/orders/${order.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          prompt: prompt.trim(),
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setGenError(json.error || 'Generation failed');
        if (json.data?.deliverable) {
          setDeliverables((prev) => [json.data.deliverable, ...prev]);
        }
        return;
      }

      setDeliverables((prev) => [json.data.deliverable, ...prev]);
      setQuotaUsed(json.data.quota_used);
      setPrompt('');

      if (json.data.quota_used >= order.quota_total) {
        onRefresh();
      }
    } catch {
      setGenError('Network error');
    } finally {
      setGenerating(false);
    }
  }, [canGenerate, wallet.publicKey, prompt, order.id, order.quota_total, onRefresh]);

  const handleApprove = useCallback(async () => {
    if (!wallet.publicKey) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/atelier/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: wallet.publicKey.toBase58(), action: 'approve' }),
      });
      const json = await res.json();
      if (json.success) onRefresh();
    } finally {
      setApproving(false);
    }
  }, [wallet.publicKey, order.id, onRefresh]);

  return (
    <div className="space-y-6">
      {/* Brief context */}
      {order.brief && (
        <div className="p-3 rounded bg-atelier/5 border border-atelier/10">
          <p className="text-2xs font-mono text-neutral-500 mb-1">Project brief</p>
          <p className="text-sm text-neutral-300">{order.brief}</p>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center justify-between p-4 rounded bg-black border border-neutral-800">
        <div className="font-mono text-sm">
          <span className="text-white font-bold">{quotaRemaining}</span>
          <span className="text-neutral-400"> / {order.quota_total} remaining</span>
        </div>
        <div className="font-mono text-sm">
          {isExpired ? (
            <span className="text-red-400">Expired</span>
          ) : (
            <span className="text-neutral-400">{timeRemaining}</span>
          )}
        </div>
      </div>

      {/* Prompt input */}
      {canGenerate && (
        <div className="space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={deliverables.length === 0
              ? 'Describe your first scene or image...'
              : 'Describe the next generation (characters and style will stay consistent)...'}
            rows={3}
            maxLength={1000}
            className="w-full px-4 py-3 rounded bg-black border border-neutral-800 text-white text-sm font-mono placeholder:text-neutral-600 focus:outline-none focus:border-atelier resize-none"
          />
          {genError && <p className="text-sm text-red-400 font-mono">{genError}</p>}
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            className="w-full py-2.5 rounded bg-atelier text-white text-sm font-semibold font-mono uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed btn-atelier btn-primary transition-opacity flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              'Generate'
            )}
          </button>
        </div>
      )}

      {/* Approve button for delivered workspace orders */}
      {order.status === 'delivered' && wallet.publicKey && order.client_wallet === wallet.publicKey.toBase58() && (
        <button
          onClick={handleApprove}
          disabled={approving}
          className="w-full py-2.5 rounded bg-emerald-500 text-white text-sm font-semibold font-mono uppercase tracking-wider disabled:opacity-60 btn-atelier btn-green transition-opacity flex items-center justify-center gap-2"
        >
          {approving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Approving...
            </>
          ) : (
            'Approve & Complete'
          )}
        </button>
      )}

      {/* Gallery */}
      {deliverables.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-mono text-neutral-400">
            Gallery ({deliverables.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {deliverables.map((d) => (
              <div
                key={d.id}
                className="relative rounded-lg border border-neutral-800 overflow-hidden bg-black"
              >
                {d.status === 'completed' && d.deliverable_url ? (
                  d.deliverable_media_type === 'video' ? (
                    <video
                      src={d.deliverable_url}
                      controls
                      playsInline
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <img
                      src={d.deliverable_url}
                      alt={d.prompt}
                      className="w-full aspect-square object-cover"
                    />
                  )
                ) : (
                  <div className="w-full aspect-square flex items-center justify-center">
                    {d.status === 'generating' || d.status === 'pending' ? (
                      <div className="w-5 h-5 border-2 border-atelier border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                )}
                <div className="p-2">
                  <p className="text-2xs text-neutral-400 font-mono line-clamp-2">{d.prompt}</p>
                  {d.status === 'failed' && d.error && (
                    <p className="text-2xs text-red-400 font-mono mt-1 line-clamp-1">{d.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {deliverables.length === 0 && isActive && (
        <div className="text-center py-12">
          <p className="text-sm text-neutral-500 font-mono">
            No generations yet. Submit a prompt to get started.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AtelierOrderPage() {
  const params = useParams();
  const [data, setData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/atelier/orders/${params.id}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error || 'Order not found');
        return;
      }
      setData(json.data);
    } catch {
      setError('Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <AtelierAppLayout>
        <div className="flex items-center justify-center min-h-screen pt-14">
          <div className="w-6 h-6 border-2 border-atelier border-t-transparent rounded-full animate-spin" />
        </div>
      </AtelierAppLayout>
    );
  }

  if (error || !data) {
    return (
      <AtelierAppLayout>
        <div className="flex flex-col items-center justify-center min-h-screen pt-14 gap-4">
          <p className="text-neutral-500 font-mono">{error || 'Order not found'}</p>
          <Link href="/atelier/browse" className="text-atelier font-mono text-sm hover:underline">
            Back to Browse
          </Link>
        </div>
      </AtelierAppLayout>
    );
  }

  const { order, review } = data;
  const isWorkspace = order.quota_total > 0;
  const isTerminal = order.status === 'cancelled' || order.status === 'disputed';
  const showWorkspace = isWorkspace && ['in_progress', 'delivered', 'completed'].includes(order.status);

  return (
    <AtelierAppLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20">
        <Link
          href="/atelier/browse"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-atelier font-mono mb-8 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-xl font-bold font-display mb-1">{order.service_title}</h1>
              <p className="text-xs font-mono text-neutral-400">{order.id}</p>
            </div>
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-mono font-medium ${STATUS_COLORS[order.status] || 'bg-neutral-800 text-neutral-300'}`}>
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-neutral-400">
            <span>
              <span className="text-neutral-500">Provider:</span>{' '}
              <Link href={`/atelier/agents/${order.provider_agent_id}`} className="text-atelier hover:underline">
                {order.provider_name}
              </Link>
            </span>
            {order.client_name && (
              <span>
                <span className="text-neutral-500">Client:</span>{' '}
                <span className="text-white">{order.client_name}</span>
              </span>
            )}
          </div>
        </div>

        {showWorkspace ? (
          <WorkspaceView data={data} onRefresh={load} />
        ) : (
          <div className="relative">
            {buildTimeline(order, review).map((step, i, arr) => {
              const isLast = i === arr.length - 1;
              const isTerminalStep = isTerminal && isLast;

              return (
                <div key={step.label} className="relative flex gap-4">
                  <div className="flex flex-col items-center">
                    <TimelineDot
                      state={step.state}
                      isTerminal={isTerminalStep}
                    />
                    {!isLast && (
                      <div className={`w-px flex-1 min-h-[2rem] ${
                        step.state === 'done' ? 'bg-emerald-400/30' :
                        step.state === 'active' ? 'bg-atelier/30' :
                        'bg-neutral-800'
                      }`} />
                    )}
                  </div>

                  <div className={`pb-8 ${isLast ? 'pb-0' : ''}`}>
                    <div className="flex items-center gap-3 -mt-0.5">
                      <h3 className={`text-sm font-medium ${
                        isTerminalStep ? 'text-red-400' :
                        step.state === 'done' ? 'text-white' :
                        step.state === 'active' ? 'text-atelier-bright' :
                        'text-neutral-500'
                      }`}>
                        {step.label}
                      </h3>
                      {step.timestamp && (
                        <span className="text-2xs text-neutral-400 font-mono">{formatDate(step.timestamp)}</span>
                      )}
                    </div>
                    {step.content && <div className="mt-2">{step.content}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AtelierAppLayout>
  );
}
