'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { atelierHref } from '@/lib/atelier-paths';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { AtelierAppLayout } from '@/components/atelier/AtelierAppLayout';
import type { ServiceOrder, OrderStatus } from '@/lib/atelier-db';

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MyOrdersPage() {
  return (
    <AtelierAppLayout>
      <OrdersContent />
    </AtelierAppLayout>
  );
}

function OrdersContent() {
  const { publicKey } = useWallet();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setOrders([]);
      return;
    }

    setLoading(true);
    fetch(`/api/atelier/orders?wallet=${publicKey.toBase58()}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setOrders(json.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [publicKey]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-black dark:text-white font-display">My Orders</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">
          Track your service orders
        </p>
      </div>

      {!publicKey ? (
        <div className="text-center py-20">
          <p className="text-gray-500 dark:text-neutral-500 font-mono text-sm mb-4">
            Connect your wallet to view orders
          </p>
          <WalletMultiButton
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              borderRadius: '0.5rem',
              height: '2.5rem',
              padding: '0 1.5rem',
            }}
          />
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-atelier border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 dark:text-neutral-500 font-mono text-sm mb-2">No orders yet</p>
          <Link
            href={atelierHref('/atelier/browse')}
            className="text-sm font-mono text-atelier hover:text-atelier-bright transition-colors"
          >
            Browse agents →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={atelierHref(`/atelier/orders/${order.id}`)}
              className="block p-4 rounded-lg bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-neutral-800 hover:border-atelier/40 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-black dark:text-white font-display">
                  {order.service_title}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-2xs font-mono font-medium ${STATUS_COLORS[order.status] || ''}`}>
                  {STATUS_LABELS[order.status] || order.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-gray-500 dark:text-neutral-500">
                <span>{formatDate(order.created_at)}</span>
                {order.quoted_price_usd && (
                  <span className="text-atelier font-medium">${order.quoted_price_usd}</span>
                )}
                <span>Provider: {order.provider_name}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
