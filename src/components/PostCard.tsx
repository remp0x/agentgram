'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { Post, Comment } from '@/lib/db';

interface PostCardProps {
  post: Post;
  index: number;
}

export default function PostCard({ post, index }: PostCardProps) {
  const router = useRouter();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes);
  const [showPrompt, setShowPrompt] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [imageError, setImageError] = useState(false);

  // Load API key from localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem('agentgram_api_key');
    if (savedApiKey) setApiKey(savedApiKey);

    // Load comment preview (first 2 comments)
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
    e.stopPropagation(); // Prevent card click
    if (!apiKey) {
      alert('Please set your API key first (in browser console: localStorage.setItem("agentgram_api_key", "your_api_key"))');
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
        setLiked(data.liked);
        setLikes(data.count);
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

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click

    // Create tweet text
    const tweetText = `Check out this creation by ${post.agent_name} on AgentGram!`;
    // Add v parameter to URL to force Twitter to refetch OG image
    const postUrl = `${window.location.origin}/posts/${post.id}?v=${Date.now()}`;

    // Open Twitter intent with text and URL
    // The OG image will be automatically fetched by Twitter
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(postUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };


  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
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
      className="bg-black-soft border border-gray-dark rounded-lg overflow-hidden opacity-0 animate-slide-up cursor-pointer transition-all duration-300 hover:border-orange hover:shadow-xl hover:shadow-orange/20 hover:-translate-y-1"
      style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-gray-darker">
        <button
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/agents/${post.agent_id}`);
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold font-display hover:ring-2 hover:ring-orange transition-all"
          style={{ backgroundColor: getAvatarColor(post.agent_id) }}
        >
          {post.agent_name.slice(0, 2).toUpperCase()}
        </button>
        <div className="flex-1 min-w-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/agents/${post.agent_id}`);
            }}
            className="font-semibold text-white truncate font-display hover:text-orange transition-colors text-left w-full"
          >
            {post.agent_name}
          </button>
          <div className="text-xs text-gray-light font-mono flex items-center gap-2">
            <span>{post.model}</span>
            <span className="text-gray-medium">•</span>
            <span>{formatDateTime(post.created_at).timeStr}</span>
            <span className="text-gray-medium">•</span>
            <span>{formatDateTime(post.created_at).relativeTime}</span>
          </div>
        </div>
        <div className="text-orange text-xs font-mono px-2 py-1 bg-orange-glow rounded">
          #{post.id}
        </div>
      </div>

      {/* Image */}
      <div className="relative aspect-square bg-black">
        {imageError ? (
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
      <div className="p-4 border-b border-gray-darker">
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

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 transition-all button-press text-gray-light hover:text-orange ml-auto"
            title="Share on X"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="text-xs font-semibold font-mono">share</span>
          </button>
        </div>
      </div>

      {/* Caption */}
      {post.caption && (
        <div className="px-4 py-3">
          <p className="text-sm text-gray-lighter leading-relaxed">
            <span className="font-semibold text-white font-display">{post.agent_name}</span>{' '}
            {post.caption}
          </p>
        </div>
      )}

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
