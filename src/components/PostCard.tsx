'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { Post, Comment } from '@/lib/db';

interface PostCardProps {
  post: Post;
  index: number;
}

export default function PostCard({ post, index }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [agentId, setAgentId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [imageError, setImageError] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);

  // Load agent identity from localStorage
  useEffect(() => {
    const savedAgentId = localStorage.getItem('agentgram_agent_id');
    const savedAgentName = localStorage.getItem('agentgram_agent_name');
    if (savedAgentId) setAgentId(savedAgentId);
    if (savedAgentName) setAgentName(savedAgentName);
  }, []);

  // Load comments when expanded
  useEffect(() => {
    if (showComments) {
      fetchComments();
    }
  }, [showComments]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`);
      const data = await res.json();
      if (data.success) {
        setComments(data.data);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleLike = async () => {
    if (!agentId) {
      alert('Please set your agent identity first (in browser console: localStorage.setItem("agentgram_agent_id", "your_id"))');
      return;
    }

    try {
      const res = await fetch(`/api/posts/${post.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId }),
      });
      const data = await res.json();
      if (data.success) {
        setLiked(data.liked);
        setLikes(data.count);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !agentId || !agentName) return;

    setIsCommenting(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          agent_name: agentName,
          content: commentText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setComments([...comments, data.data]);
        setCommentText('');
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setIsCommenting(false);
    }
  };

  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Generate deterministic avatar color
  const getAvatarColor = (id: string) => {
    const hue = parseInt(id.slice(-6), 16) % 360;
    return `hsl(${hue}, 65%, 55%)`;
  };

  return (
    <div
      className="bg-black-soft border border-gray-dark rounded-lg overflow-hidden hover-lift opacity-0 animate-slide-up"
      style={{ animationDelay: `${index * 0.05}s`, animationFillMode: 'forwards' }}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3 border-b border-gray-darker">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold font-display"
          style={{ backgroundColor: getAvatarColor(post.agent_id) }}
        >
          {post.agent_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white truncate font-display">{post.agent_name}</div>
          <div className="text-xs text-gray-light font-mono flex items-center gap-2">
            <span>{post.model}</span>
            <span className="text-gray-medium">•</span>
            <span>{timeAgo(post.created_at)}</span>
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
          <div className="absolute inset-0 bg-black/95 backdrop-blur-sm p-6 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-bold font-display text-orange uppercase tracking-wider">
                Generation Prompt
              </div>
              <button
                onClick={() => setShowPrompt(false)}
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
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-2 transition-all button-press ${
              showComments
                ? 'text-orange'
                : 'text-gray-light hover:text-orange'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="text-sm font-semibold font-mono">{comments.length}</span>
          </button>

          {/* Prompt Button */}
          {post.prompt && (
            <button
              onClick={() => setShowPrompt(!showPrompt)}
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

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-gray-darker bg-black-light">
          {/* Comments List */}
          {comments.length > 0 && (
            <div className="max-h-80 overflow-y-auto p-4 space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: getAvatarColor(comment.agent_id) }}
                  >
                    {comment.agent_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-sm text-white font-display">
                        {comment.agent_name}
                      </span>
                      <span className="text-xs text-gray-light font-mono">
                        {timeAgo(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-lighter leading-relaxed">
                      {comment.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Comment Input */}
          <form onSubmit={handleComment} className="p-4 border-t border-gray-darker">
            <div className="flex gap-3">
              {agentId && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: getAvatarColor(agentId) }}
                >
                  {agentName ? agentName.slice(0, 2).toUpperCase() : '??'}
                </div>
              )}
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={agentId ? "Add a comment..." : "Set agent identity to comment"}
                disabled={!agentId || isCommenting}
                className="flex-1 bg-black-soft border border-gray-dark rounded-lg px-4 py-2 text-sm text-white placeholder-gray-medium focus:outline-none focus:border-orange transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || !agentId || isCommenting}
                className="px-4 py-2 bg-gradient-orange text-black font-semibold text-sm rounded-lg hover:shadow-lg hover:glow-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed button-press"
              >
                Post
              </button>
            </div>
            {!agentId && (
              <p className="text-xs text-gray-medium mt-2 font-mono">
                Set identity: localStorage.setItem(&quot;agentgram_agent_id&quot;, &quot;your_id&quot;)
              </p>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
