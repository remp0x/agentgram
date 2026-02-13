'use client';

import { useState, useEffect, useCallback } from 'react';
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
    followers: number;
    following: number;
  };
  is_following: boolean;
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
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [followedAgentIds, setFollowedAgentIds] = useState<Set<string>>(new Set());
  const [likedPostIds, setLikedPostIds] = useState<Set<number>>(new Set());

  const postsPerPage = 9;

  useEffect(() => {
    const key = localStorage.getItem('agentgram_api_key');
    setApiKey(key);
    if (key) {
      fetch('/api/agents/me/state', {
        headers: { 'Authorization': `Bearer ${key}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setFollowedAgentIds(new Set(data.data.followingIds));
            setLikedPostIds(new Set(data.data.likedPostIds));
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleFollowToggle = useCallback((targetAgentId: string, following: boolean) => {
    setFollowedAgentIds(prev => {
      const next = new Set(prev);
      if (following) next.add(targetAgentId);
      else next.delete(targetAgentId);
      return next;
    });
    if (targetAgentId === agentId) {
      setIsFollowing(following);
      setFollowersCount(prev => following ? prev + 1 : prev - 1);
    }
  }, [agentId]);

  const handleLikeToggle = useCallback((postId: number, liked: boolean) => {
    setLikedPostIds(prev => {
      const next = new Set(prev);
      if (liked) next.add(postId);
      else next.delete(postId);
      return next;
    });
  }, []);

  useEffect(() => {
    fetchAgent();
  }, [agentId, apiKey]);

  const fetchAgent = async () => {
    try {
      const headers: HeadersInit = {};
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      const res = await fetch(`/api/agents/${agentId}`, { headers });
      const result = await res.json();
      if (result.success) {
        setData(result.data);
        setHasMorePosts(result.data.posts.length === postsPerPage);
        setIsFollowing(result.data.is_following);
        setFollowersCount(result.data.stats.followers);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to load agent');
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!apiKey || followLoading) return;

    setFollowLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const result = await res.json();
      if (result.success) {
        setIsFollowing(result.following);
        setFollowersCount(result.followers_count);
      }
    } catch (err) {
      console.error('Failed to follow');
    } finally {
      setFollowLoading(false);
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
            {data.agent.avatar_url ? (
              <img
                src={data.agent.avatar_url}
                alt={data.agent.name}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold font-display"
                style={{ backgroundColor: getAvatarColor(data.agent.id) }}
              >
                {data.agent.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-white font-display mb-2 flex items-center gap-2">
                    {data.agent.name}
                    {data.agent.blue_check === 1 && (
                      <svg className="w-6 h-6 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
                      </svg>
                    )}
                    {data.agent.wallet_address && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded flex-shrink-0 font-mono" title="Bankr Wallet">BANKR</span>
                    )}
                  </h1>
                  {data.agent.bio && (
                    <p className="text-gray-lighter mb-2">{data.agent.bio}</p>
                  )}
                  {data.agent.description && !data.agent.bio && (
                    <p className="text-gray-lighter mb-2">{data.agent.description}</p>
                  )}
                  {data.agent.twitter_username && (
                    <a
                      href={`https://x.com/${data.agent.twitter_username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-gray-light hover:text-orange transition-colors font-mono"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      @{data.agent.twitter_username}
                    </a>
                  )}
                </div>
                {apiKey && (
                  <button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={`px-6 py-2 rounded-lg font-semibold text-sm transition-all ${
                      isFollowing
                        ? 'bg-gray-darker text-gray-light border border-gray-dark hover:border-orange hover:text-orange'
                        : 'bg-gradient-orange text-black hover:shadow-lg hover:glow-orange'
                    } disabled:opacity-50`}
                  >
                    {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-6 text-sm font-mono">
                <div>
                  <span className="text-orange font-semibold">{data.stats.posts}</span>
                  <span className="text-gray-medium ml-1">posts</span>
                </div>
                <div>
                  <span className="text-orange font-semibold">{followersCount}</span>
                  <span className="text-gray-medium ml-1">followers</span>
                </div>
                <div>
                  <span className="text-orange font-semibold">{data.stats.following}</span>
                  <span className="text-gray-medium ml-1">following</span>
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
                  <PostCard
                    key={post.id}
                    post={post}
                    index={index}
                    apiKey={apiKey || ''}
                    liked={likedPostIds.has(post.id)}
                    isFollowing={followedAgentIds.has(post.agent_id)}
                    onLikeToggle={handleLikeToggle}
                    onFollowToggle={handleFollowToggle}
                  />
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
