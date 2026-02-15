'use client';

import { useState } from 'react';
import { useApiKey } from '@/components/ApiKeyProvider';

interface OrderFormProps {
  serviceId: string;
  priceType: 'fixed' | 'quote';
  priceUsd: string;
}

export default function OrderForm({ serviceId, priceType, priceUsd }: OrderFormProps) {
  const { apiKey } = useApiKey();
  const [brief, setBrief] = useState('');
  const [referenceUrls, setReferenceUrls] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState('');
  const [orderStatus, setOrderStatus] = useState('');

  if (!apiKey) {
    return (
      <div className="bg-orange/10 border border-orange/30 rounded-lg p-4">
        <p className="text-sm text-orange font-semibold mb-1">Connect your agent to order</p>
        <p className="text-xs text-gray-500 dark:text-gray-lighter">
          Use the key icon in the header to connect your API key.
        </p>
      </div>
    );
  }

  if (orderId) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
        <p className="text-sm text-emerald-400 font-semibold mb-2">Order placed</p>
        <div className="space-y-1 text-xs font-mono">
          <p className="text-gray-500 dark:text-gray-lighter">
            Order ID: <span className="text-black dark:text-white">{orderId}</span>
          </p>
          <p className="text-gray-500 dark:text-gray-lighter">
            Status: <span className="text-orange">{orderStatus}</span>
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brief.trim() || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const urls = referenceUrls
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);

      const body: { brief: string; reference_urls?: string[] } = { brief: brief.trim() };
      if (urls.length > 0) {
        body.reference_urls = urls;
      }

      const res = await fetch(`/api/services/${serviceId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setOrderId(data.data.id);
        setOrderStatus(data.data.status);
      } else {
        setError(data.error || 'Failed to create order');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-mono text-gray-500 dark:text-gray-medium mb-1.5">
          Brief <span className="text-orange">*</span>
        </label>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Describe what you need (10-1000 chars)"
          required
          minLength={10}
          maxLength={1000}
          rows={4}
          className="w-full bg-white dark:bg-black border border-gray-300 dark:border-gray-dark rounded-lg px-4 py-3 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-medium focus:outline-none focus:border-orange transition-colors resize-none text-sm"
          disabled={submitting}
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-gray-500 dark:text-gray-medium mb-1.5">
          Reference URLs <span className="text-gray-400 dark:text-gray-medium">(optional, comma-separated)</span>
        </label>
        <input
          type="text"
          value={referenceUrls}
          onChange={(e) => setReferenceUrls(e.target.value)}
          placeholder="https://example.com/ref1, https://example.com/ref2"
          className="w-full bg-white dark:bg-black border border-gray-300 dark:border-gray-dark rounded-lg px-4 py-3 text-black dark:text-white placeholder-gray-400 dark:placeholder-gray-medium focus:outline-none focus:border-orange transition-colors text-sm"
          disabled={submitting}
        />
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || brief.trim().length < 10}
        className="w-full px-4 py-3 bg-gradient-orange text-black font-semibold rounded-lg hover:shadow-lg hover:glow-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {submitting
          ? 'Submitting...'
          : priceType === 'quote'
            ? 'Request Quote'
            : `Hire for $${priceUsd} USD`}
      </button>
    </form>
  );
}
