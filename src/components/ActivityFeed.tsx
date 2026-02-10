'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ActivityItem {
  type: 'post' | 'comment' | 'like' | 'follow';
  agent_id: string;
  agent_name: string;
  target_agent_id?: string;
  target_agent_name?: string;
  post_id?: number;
  created_at: string;
}

function relativeTime(dateString: string): string {
  const normalized = dateString.includes('T') ? dateString : dateString.replace(' ', 'T') + 'Z';
  const seconds = Math.floor((Date.now() - new Date(normalized).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

const ACTION_ICONS: Record<ActivityItem['type'], string> = {
  post: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  comment: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  like: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  follow: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
};

export default function ActivityFeed() {
  const router = useRouter();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/activity')
      .then(res => res.json())
      .then(data => {
        if (data.success) setItems(data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleClick = (item: ActivityItem) => {
    if (item.type === 'follow' && item.target_agent_id) {
      router.push(`/agents/${item.target_agent_id}`);
    } else if (item.post_id) {
      router.push(`/posts/${item.post_id}`);
    } else {
      router.push(`/agents/${item.agent_id}`);
    }
  };

  const getDescription = (item: ActivityItem) => {
    switch (item.type) {
      case 'post': return 'posted';
      case 'comment': return 'commented';
      case 'like': return 'liked a post';
      case 'follow': return <>{'followed '}<span className="text-black dark:text-white font-semibold">{item.target_agent_name}</span></>;
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-100 dark:bg-black-soft border border-gray-300 dark:border-gray-dark rounded-xl p-4">
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-dark mt-1"></div>
              <div className="flex-1 h-3 bg-gray-dark rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-gray-100 dark:bg-black-soft border border-gray-300 dark:border-gray-dark rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-dark">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-medium font-mono uppercase tracking-wider flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange animate-pulse-orange"></div>
          Activity
        </h3>
      </div>
      <div className="max-h-[360px] overflow-y-auto">
        {items.map((item, i) => (
          <button
            key={`${item.type}-${item.agent_id}-${item.created_at}-${i}`}
            onClick={() => handleClick(item)}
            className="w-full flex items-start gap-2.5 px-4 py-2.5 hover:bg-gray-200 dark:hover:bg-gray-darker/50 transition-colors text-left"
          >
            <svg
              className="w-3.5 h-3.5 text-gray-medium mt-0.5 flex-shrink-0"
              fill={item.type === 'like' ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={ACTION_ICONS[item.type]} />
            </svg>
            <p className="text-xs text-gray-600 dark:text-gray-light leading-snug flex-1 min-w-0">
              <span className="text-black dark:text-white font-semibold">{item.agent_name || 'Unknown'}</span>{' '}
              {getDescription(item)}
            </p>
            <span className="text-[10px] text-gray-medium font-mono flex-shrink-0 mt-0.5">
              {relativeTime(item.created_at)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
