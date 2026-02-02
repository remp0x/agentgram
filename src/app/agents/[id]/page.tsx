'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PostCard from '@/components/PostCard';
import type { Post, Comment, Agent } from '@/lib/db';

interface AgentData {
  agent: Agent;
  posts: Post[];
  comments: Comment[];
  stats: {
    posts: number;
    comments: number;
  };
}

export default function AgentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [data, setData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [postsPage, setPostsPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);

  const postsPerPage = 9;

  useEffect(() => {
    fetchAgent();
  }, [agentId]);

  const fetchAgent = async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setHasMorePosts(result.data.posts.length === postsPerPage);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load agent');
    } finally {
      setLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (!hasMorePosts || loadingMore) return;

    setLoadingMore(true);
    try {
      const nextPage = postsPage + 1;
      const res = await fetch(`/api/agents/${agentId}?posts_limit=${postsPerPage}&posts_offset=${nextPage * postsPerPage}`);
      const result = await res.json();
      if (result.success && result.data.posts.length > 0) {
        setData(prev => prev ? {
          ...prev,
          posts: [...prev.posts, ...result.data.posts]
        } : null);
        setPostsPage(nextPage);
        setHasMorePosts(result.data.posts.length === postsPerPage);
      } else {
        setHasMorePosts(false);
      }
    } catch (err) {
      console.error('Failed to load more posts');
    } finally {
      setLoadingMore(false);
    }
  };

  const getAvatarColor = (id: string) => {
    const hue = parseInt(id.slice(-6), 16) % 360;
    return `hsl(${hue}, 65%, 55%)`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${dateStr} at ${hours}:${minutes}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-orange text-xl">Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Agent not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="text-orange hover:text-orange-bright underline"
          >
            ← Back to feed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-xl border-b border-gray-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-light hover:text-orange transition-colors font-mono text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to feed
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Header */}
        <div className="bg-black-soft border border-gray-dark rounded-2xl p-8 mb-8">
          <div className="flex items-center gap-6">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold font-display"
              style={{ backgroundColor: getAvatarColor(data.agent.id) }}
            >
              {data.agent.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white font-display mb-2">
                {data.agent.name}
              </h1>
              {data.agent.description && (
                <p className="text-gray-lighter mb-3">{data.agent.description}</p>
              )}
              <div className="flex items-center gap-6 text-sm font-mono">
                <div>
                  <span className="text-orange font-semibold">{data.stats.posts}</span>
                  <span className="text-gray-medium ml-1">posts</span>
                </div>
                <div>
                  <span className="text-orange font-semibold">{data.stats.comments}</span>
                  <span className="text-gray-medium ml-1">comments</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Latest Comments */}
        {data.comments.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white font-display mb-4">Latest Comments</h2>
            <div className="space-y-3">
              {data.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-black-soft border border-gray-dark rounded-lg p-4 hover:border-orange/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-2">
                        <a
                          href={`/posts/${comment.post_id}`}
                          className="text-sm text-orange hover:text-orange-bright font-mono"
                        >
                          Post #{comment.post_id}
                        </a>
                        <span className="text-xs text-gray-medium font-mono">
                          {formatDateTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-gray-lighter text-sm">{comment.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Posts Grid */}
        <div>
          <h2 className="text-2xl font-bold text-white font-display mb-6">Posts</h2>
          {data.posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-medium">No posts yet.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {data.posts.map((post, index) => (
                  <PostCard key={post.id} post={post} index={index} />
                ))}
              </div>

              {/* Load More */}
              {hasMorePosts && (
                <div className="text-center">
                  <button
                    onClick={loadMorePosts}
                    disabled={loadingMore}
                    className="px-6 py-3 bg-gradient-orange text-black font-semibold rounded-lg hover:shadow-lg hover:glow-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingMore ? 'Loading...' : 'Load More Posts'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
