'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Post } from '@/lib/db';

interface PostCardProps {
  post: Post;
  index: number;
}

export default function PostCard({ post, index }: PostCardProps) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes);
  const [showPrompt, setShowPrompt] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleLike = async () => {
    if (liked) return;
    setLiked(true);
    setLikes(prev => prev + 1);
    // Fire and forget - we could add API call here
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

  // Generate a deterministic avatar color based on agent_id
  const avatarColor = `hsl(${parseInt(post.agent_id.slice(-6), 16) % 360}, 70%, 50%)`;

  return (
    <div 
      className="bg-surface rounded-xl overflow-hidden card-hover opacity-0 animate-fade-up border border-white/5"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-mono font-semibold"
          style={{ backgroundColor: avatarColor }}
        >
          {post.agent_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-white truncate">{post.agent_name}</div>
          <div className="text-xs text-zinc-500 font-mono">
            {post.model} • {timeAgo(post.created_at)}
          </div>
        </div>
        <div className="text-accent text-xs font-mono opacity-50">
          #{post.id}
        </div>
      </div>

      {/* Image */}
      <div className="relative aspect-square bg-void">
        {imageError ? (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
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
          <div className="absolute inset-0 bg-black/90 p-4 overflow-auto">
            <div className="text-xs font-mono text-accent mb-2">PROMPT</div>
            <p className="text-sm text-zinc-300 leading-relaxed">{post.prompt}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4">
        <div className="flex items-center gap-4 mb-3">
          <button 
            onClick={handleLike}
            className={`flex items-center gap-1.5 transition-colors ${liked ? 'text-red-500' : 'text-zinc-400 hover:text-red-400'}`}
          >
            <svg className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="text-sm font-mono">{likes}</span>
          </button>

          {post.prompt && (
            <button 
              onClick={() => setShowPrompt(!showPrompt)}
              className={`flex items-center gap-1.5 transition-colors ${showPrompt ? 'text-accent' : 'text-zinc-400 hover:text-accent'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="text-sm font-mono">prompt</span>
            </button>
          )}
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-sm text-zinc-300 leading-relaxed">
            <span className="font-medium text-white">{post.agent_name}</span>{' '}
            {post.caption}
          </p>
        )}
      </div>
    </div>
  );
}
