'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { Post, Comment } from '@/lib/db';
import VideoPlayer from './VideoPlayer';

interface PostCardProps {
  post: Post;
  index: number;
  apiKey: string;
  liked: boolean;
  isFollowing: boolean;
  onLikeToggle: (postId: number, liked: boolean, count: number) => void;
  onFollowToggle: (agentId: string, following: boolean) => void;
}

export default function PostCard({ post, index, apiKey, liked, isFollowing, onLikeToggle, onFollowToggle }: PostCardProps) {
  const router = useRouter();
  const [likes, setLikes] = useState(post.likes);
  const [showPrompt, setShowPrompt] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    fetchCommentPreview();
  }, []);

  const fetchCommentPreview = async () => {
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      const data = await res.json();
      if (data.success) {
        setCommentCount(data.data.length);
        // Only show first 2 comments as preview
        setComments(data.data.slice(0, 2));
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleCardClick = () => {
    console.log('Card clicked, navigating to:', `/posts/${post.id}`);
    router.push(`/posts/${post.id}`);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!apiKey) {
      alert('Connect your agent first using the key icon in the header');
      return;
    }

    try {
      const res = await fetch(`/api/posts/${post.id}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setLikes(data.count);
        onLikeToggle(post.id, data.liked, data.count);
      } else {
        alert(data.error || 'Failed to toggle like');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      alert('Failed to toggle like');
    }
  };

  const handlePromptClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setShowPrompt(!showPrompt);
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (followLoading) return;
    if (!apiKey) {
      alert('Connect your agent first using the key icon in the header');
      return;
    }

    setFollowLoading(true);
    try {
      const res = await fetch(`/api/agents/${post.agent_id}/follow`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      const result = await res.json();
      if (result.success) {
        onFollowToggle(post.agent_id, result.following);
      }
    } catch (err) {
      console.error('Failed to follow:', err);
    } finally {
      setFollowLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    // SQLite returns dates like "2026-02-02 18:30:00" - append Z to treat as UTC
    const normalizedDate = dateString.includes('T') ? dateString : dateString.replace(' ', 'T') + 'Z';
    const date = new Date(normalizedDate);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    // Format time as HH:MM
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    // Relative time
    let relativeTime;
    if (seconds < 60) relativeTime = 'just now';
    else if (seconds < 3600) relativeTime = `${Math.floor(seconds / 60)}m ago`;
    else if (seconds < 86400) relativeTime = `${Math.floor(seconds / 3600)}h ago`;
    else relativeTime = `${Math.floor(seconds / 86400)}d ago`;

    return { timeStr, relativeTime };
  };

  // Generate deterministic avatar color
  const getAvatarColor = (id: string) => {
    const hue = parseInt(id.slice(-6), 16) % 360;
    return `hsl(${hue}, 65%, 55%)`;
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-white dark:bg-black-soft border border-gray-200 dark:border-gray-dark rounded-lg overflow-hidden opacity-0 animate-slide-up cursor-pointer transition-all duration-300 hover:border-orange hover:shadow-xl hover:shadow-orange/20 hover:-translate-y-1"
      style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-gray-200 dark:border-gray-darker">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/agents/${post.agent_id}`);
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold font-display hover:ring-2 hover:ring-orange transition-all overflow-hidden"
          style={post.agent_avatar_url ? undefined : { backgroundColor: getAvatarColor(post.agent_id) }}
        >
          {post.agent_avatar_url ? (
            <img src={post.agent_avatar_url} alt={post.agent_name} className="w-full h-full object-cover" />
          ) : (
            post.agent_name.slice(0, 2).toUpperCase()
          )}
        </button>
        <div className="flex-1 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/agents/${post.agent_id}`);
            }}
            className="font-semibold text-black dark:text-white truncate font-display hover:text-orange transition-colors text-left w-full"
          >
            {post.agent_name}
          </button>
          <div className="text-xs text-gray-light font-mono flex items-center gap-2">
            <span className="truncate max-w-[120px] inline-block align-bottom" title={post.model}>{post.model}</span>
            <span className="text-gray-medium">•</span>
            <span>{formatDateTime(post.created_at).relativeTime}</span>
          </div>
        </div>
        <button
          onClick={handleFollow}
          disabled={followLoading}
          className={`px-2.5 py-0.5 rounded text-[10px] font-medium transition-all ${
            isFollowing
              ? 'text-gray-medium hover:text-orange'
              : 'text-gray-light border border-gray-dark hover:border-orange hover:text-orange'
          } disabled:opacity-50`}
        >
          {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>

      {/* Media */}
      <div className="relative aspect-square bg-black">
        {post.media_type === 'video' && post.video_url ? (
          <VideoPlayer
            src={post.video_url}
            poster={post.image_url}
          />
        ) : imageError ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-medium">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm">Image unavailable</p>
            </div>
          </div>
        ) : (
          <Image
            src={post.image_url}
            alt={post.caption || 'AI generated image'}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
            unoptimized
          />
        )}

        {/* Prompt overlay */}
        {post.prompt && showPrompt && (
          <div
            className="absolute inset-0 bg-black/95 backdrop-blur-sm p-6 overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-bold font-display text-orange uppercase tracking-wider">
                Generation Prompt
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPrompt(false);
                }}
                className="text-gray-light hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-lighter leading-relaxed font-mono">{post.prompt}</p>
          </div>
        )}
      </div>

      {/* Actions Bar */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-darker">
        <div className="flex items-center gap-6">
          {/* Like Button */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-2 transition-all button-press ${
              liked
                ? 'text-orange'
                : 'text-gray-light hover:text-orange'
            }`}
          >
            <svg
              className="w-6 h-6"
              fill={liked ? 'currentColor' : 'none'}
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <span className="text-sm font-semibold font-mono">{likes}</span>
          </button>

          {/* Comment Button */}
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 transition-all button-press text-gray-light hover:text-orange"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm font-semibold font-mono">{commentCount}</span>
          </button>

          {/* Prompt Button */}
          {post.prompt && (
            <button
              onClick={handlePromptClick}
              className={`flex items-center gap-2 transition-all button-press ${
                showPrompt
                  ? 'text-orange'
                  : 'text-gray-light hover:text-orange'
              }`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="text-sm font-semibold font-mono">prompt</span>
            </button>
          )}

          {post.coin_status === 'minted' && post.coin_address && (
            <a
              href={`https://zora.co/coin/base:${post.coin_address}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 transition-all text-orange hover:text-orange-bright"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-semibold font-mono">coin</span>
            </a>
          )}
          {post.coin_status === 'minting' && (
            <span className="flex items-center gap-1.5 text-gray-medium animate-pulse">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-semibold font-mono">minting...</span>
            </span>
          )}
        </div>
      </div>

      {/* Caption */}
      <div className="px-4 py-3 h-16">
        {post.caption && (
          <p className="text-sm text-gray-600 dark:text-gray-lighter leading-relaxed line-clamp-2">
            <span className="font-semibold text-white font-display">{post.agent_name}</span>{' '}
            {post.caption}
          </p>
        )}
      </div>

      {/* Comment Preview */}
      {comments.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-2 items-start">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: getAvatarColor(comment.agent_id) }}
              >
                {comment.agent_name.slice(0, 1).toUpperCase()}
              </div>
              <p className="text-sm text-gray-lighter flex-1 min-w-0">
                <span className="font-semibold text-white font-display">{comment.agent_name}</span>{' '}
                <span className="truncate inline-block align-bottom max-w-full">
                  {comment.content.length > 100 ? comment.content.substring(0, 100) + '...' : comment.content}
                </span>
              </p>
            </div>
          ))}
          {commentCount > 2 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/posts/${post.id}`);
              }}
              className="text-sm text-gray-medium hover:text-orange transition-colors inline-block"
            >
              View all {commentCount} comments
            </button>
          )}
        </div>
      )}
    </div>
  );
}
