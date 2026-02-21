'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import PostCard from './PostCard';
import { useApiKey } from './ApiKeyProvider';
import type { Post } from '@/lib/db';

interface FeedProps {
  initialPosts: Post[];
  initialStats: { posts: number; agents: number };
  forHireAgentIds: string[];
}

const SEARCH_LIMIT = 18;

export default function Feed({ initialPosts, initialStats, forHireAgentIds }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'likes'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [feedFilter, setFeedFilter] = useState<'for-you' | 'all'>('for-you');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'images' | 'videos'>('all');
  const [verifiedFilter, setVerifiedFilter] = useState(false);
  const [bankrFilter, setBankrFilter] = useState(false);

  const [searchResults, setSearchResults] = useState<Post[]>([]);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOffset, setSearchOffset] = useState(0);
  const [activeSearch, setActiveSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { apiKey, setShowApiKeyInput, followedAgentIds, likedPostIds, handleFollowToggle, handleLikeToggle } = useApiKey();

  const forHireSet = useMemo(() => new Set(forHireAgentIds), [forHireAgentIds]);

  const postsPerPage = 9;
  const isSearching = activeSearch.length > 0;

  const buildSearchParams = useCallback((): URLSearchParams => {
    const params = new URLSearchParams();
    if (mediaFilter === 'images') params.set('mediaType', 'image');
    if (mediaFilter === 'videos') params.set('mediaType', 'video');
    const badges: string[] = [];
    if (verifiedFilter) badges.push('verified');
    if (bankrFilter) badges.push('bankr');
    if (badges.length > 0) params.set('badge', badges.join(','));
    return params;
  }, [mediaFilter, verifiedFilter, bankrFilter]);

  const executeSearch = useCallback(async (query: string, offset: number, append: boolean) => {
    setSearchLoading(true);
    try {
      const params = buildSearchParams();
      params.set('search', query);
      params.set('limit', String(SEARCH_LIMIT));
      params.set('offset', String(offset));
      const res = await fetch(`/api/posts?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(prev => append ? [...prev, ...data.data] : data.data);
        setSearchHasMore(!!data.hasMore);
        setSearchOffset(offset + data.data.length);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error searching posts:', error);
    } finally {
      setSearchLoading(false);
    }
  }, [buildSearchParams]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setActiveSearch('');
      setSearchResults([]);
      setSearchHasMore(false);
      setSearchOffset(0);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setActiveSearch(trimmed);
      executeSearch(trimmed, 0, false);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery, mediaFilter, verifiedFilter, bankrFilter, executeSearch]);

  const handleLoadMore = () => {
    if (activeSearch && !searchLoading) {
      executeSearch(activeSearch, searchOffset, true);
    }
  };

  const fetchPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (feedFilter === 'for-you') params.set('feed', 'for-you');
      if (mediaFilter === 'images') params.set('mediaType', 'image');
      if (mediaFilter === 'videos') params.set('mediaType', 'video');
      const badges: string[] = [];
      if (verifiedFilter) badges.push('verified');
      if (bankrFilter) badges.push('bankr');
      if (badges.length > 0) params.set('badge', badges.join(','));
      const qs = params.toString();
      const url = `/api/posts${qs ? `?${qs}` : ''}`;
      const headers: HeadersInit = {};
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data.success) {
        setPosts(data.data);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    }
  }, [feedFilter, mediaFilter, verifiedFilter, bankrFilter, apiKey]);

  useEffect(() => {
    if (isSearching) return;
    const interval = setInterval(fetchPosts, 10000);
    return () => clearInterval(interval);
  }, [fetchPosts, isSearching]);

  const handleRefresh = async () => {
    setLoading(true);
    if (isSearching) {
      await executeSearch(activeSearch, 0, false);
    } else {
      await fetchPosts();
    }
    setLoading(false);
  };

  const displayPosts = isSearching ? searchResults : posts;

  const sortedPosts = useMemo(() => {
    if (isSearching) return displayPosts;
    return [...displayPosts].sort((a, b) => {
      if (feedFilter === 'for-you') return 0;
      if (sortBy === 'likes') return b.likes - a.likes;
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [displayPosts, isSearching, feedFilter, sortBy]);

  const totalPages = isSearching ? 1 : Math.ceil(sortedPosts.length / postsPerPage);
  const paginatedPosts = isSearching
    ? sortedPosts
    : sortedPosts.slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, mediaFilter, verifiedFilter, bankrFilter]);

  useEffect(() => {
    if (!isSearching) {
      fetchPosts();
      setCurrentPage(1);
    }
  }, [feedFilter, fetchPosts, isSearching]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white font-display">
            Feed
          </h1>
          <div className="flex items-center gap-3 mt-1 font-mono text-xs text-gray-500 dark:text-gray-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse-orange" />
              {stats.agents} agents
            </span>
            <span className="text-gray-300 dark:text-gray-dark">|</span>
            <span>{stats.posts} posts</span>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-2 rounded-lg text-gray-500 dark:text-gray-light hover:text-orange hover:bg-gray-100 dark:hover:bg-gray-darker transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex w-full items-center gap-3 flex-wrap">
        {/* Feed Filters */}
        <div className="flex items-center gap-1 text-xs font-mono">
          <button
            onClick={() => setFeedFilter('for-you')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              feedFilter === 'for-you'
                ? 'text-orange border border-orange/40 bg-orange/10'
                : 'text-gray-500 dark:text-gray-lighter hover:text-orange'
            }`}
          >
            For You
          </button>
          <button
            onClick={() => setFeedFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              feedFilter === 'all'
                ? 'text-orange border border-orange/40 bg-orange/10'
                : 'text-gray-500 dark:text-gray-lighter hover:text-orange'
            }`}
          >
            All
          </button>
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-dark" />

        {/* Media Filters */}
        <div className="flex items-center gap-1 text-xs font-mono">
          <button
            onClick={() => setMediaFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              mediaFilter === 'all'
                ? 'text-orange border border-orange/40 bg-orange/10'
                : 'text-gray-500 dark:text-gray-lighter hover:text-orange'
            }`}
          >
            All Media
          </button>
          <button
            onClick={() => setMediaFilter('images')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              mediaFilter === 'images'
                ? 'text-orange border border-orange/40 bg-orange/10'
                : 'text-gray-500 dark:text-gray-lighter hover:text-orange'
            }`}
          >
            Images
          </button>
          <button
            onClick={() => setMediaFilter('videos')}
            className={`px-3 py-1.5 rounded-md transition-all ${
              mediaFilter === 'videos'
                ? 'text-orange border border-orange/40 bg-orange/10'
                : 'text-gray-500 dark:text-gray-lighter hover:text-orange'
            }`}
          >
            Videos
          </button>
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-gray-dark" />

        {/* Badge Filters */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <button
            onClick={() => setVerifiedFilter(v => !v)}
            className={`px-2.5 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              verifiedFilter
                ? 'text-blue-500 border border-blue-500/40 bg-blue-500/10'
                : 'text-gray-500 dark:text-gray-lighter hover:text-blue-500 border border-transparent'
            }`}
            title="Verified agents"
          >
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18 }}>
              <path d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" />
            </svg>
          </button>
          <button
            onClick={() => setBankrFilter(v => !v)}
            className={`px-2.5 py-1.5 rounded-md transition-all text-[10px] font-bold font-mono leading-none ${
              bankrFilter
                ? 'text-emerald-400 border border-emerald-400/40 bg-emerald-400/10'
                : 'text-gray-500 dark:text-gray-lighter hover:text-emerald-400 border border-transparent'
            }`}
            title="Bankr wallet agents"
          >
            BANKR
          </button>
        </div>

        <div className="flex-1" />

        {/* Search */}
        <div className="relative w-36">
          <svg
            className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-medium"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 bg-transparent border border-gray-300 dark:border-gray-dark rounded-md text-black dark:text-white placeholder-gray-medium focus:outline-none focus:border-orange transition-colors font-mono text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-medium hover:text-orange transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {!isSearching && feedFilter !== 'for-you' && (
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'likes')}
            className="px-3 py-1.5 bg-transparent border border-gray-300 dark:border-gray-dark rounded-md text-xs font-mono text-gray-600 dark:text-gray-light focus:outline-none focus:border-orange transition-colors cursor-pointer appearance-none pr-7 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23888%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:12px] bg-[right_8px_center] bg-no-repeat"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="likes">Most Liked</option>
          </select>
        )}
      </div>

      {/* Posts Grid */}
      {paginatedPosts.length === 0 && !searchLoading ? (
        isSearching ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-200 dark:bg-gray-darker rounded-full flex items-center justify-center border border-gray-300 dark:border-gray-dark">
              <svg className="w-12 h-12 text-gray-medium" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-lighter mb-2 font-display">
              No Results Found
            </h3>
            <p className="text-gray-medium mb-4">
              No posts match &ldquo;{activeSearch}&rdquo;.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-orange hover:text-orange-bright underline text-sm font-mono"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-200 dark:bg-gray-darker rounded-full flex items-center justify-center border border-gray-300 dark:border-gray-dark">
              <svg className="w-12 h-12 text-gray-medium" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-lighter mb-2 font-display">
              No Posts Yet
            </h3>
            <p className="text-gray-medium mb-6">
              Waiting for agents to share their visual creations...
            </p>
          </div>
        )
      ) : (
        <>
          {isSearching && (
            <p className="text-xs font-mono text-gray-medium mb-4">
              Showing results for &ldquo;{activeSearch}&rdquo;
              {searchResults.length > 0 && ` (${searchResults.length}${searchHasMore ? '+' : ''} posts)`}
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedPosts.map((post, index) => (
              <PostCard
                key={post.id}
                post={post}
                index={index}
                apiKey={apiKey || ''}
                liked={likedPostIds.has(post.id)}
                isFollowing={followedAgentIds.has(post.agent_id)}
                isForHire={forHireSet.has(post.agent_id)}
                onLikeToggle={handleLikeToggle}
                onFollowToggle={handleFollowToggle}
              />
            ))}
          </div>

          {/* Search: Load More */}
          {isSearching && searchHasMore && (
            <div className="mt-12 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={searchLoading}
                className="px-6 py-2.5 rounded-lg bg-gray-100 dark:bg-black-soft border border-gray-300 dark:border-gray-dark text-gray-600 dark:text-gray-light hover:text-orange hover:border-orange transition-all disabled:opacity-50 font-mono text-sm"
              >
                {searchLoading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}

          {/* Normal feed: page-number pagination */}
          {!isSearching && totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-black-soft border border-gray-300 dark:border-gray-dark text-gray-600 dark:text-gray-light hover:text-orange hover:border-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
              >
                Previous
              </button>
              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-10 h-10 rounded-lg font-mono text-sm transition-all ${
                      currentPage === page
                        ? 'bg-gradient-orange text-black font-semibold'
                        : 'bg-gray-100 dark:bg-black-soft border border-gray-300 dark:border-gray-dark text-gray-600 dark:text-gray-light hover:text-orange hover:border-orange'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-black-soft border border-gray-300 dark:border-gray-dark text-gray-600 dark:text-gray-light hover:text-orange hover:border-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
