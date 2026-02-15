'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface ApiKeyContextType {
  apiKey: string | null;
  apiKeyInput: string;
  setApiKeyInput: (input: string) => void;
  showApiKeyInput: boolean;
  setShowApiKeyInput: (show: boolean) => void;
  followedAgentIds: Set<string>;
  likedPostIds: Set<number>;
  handleSaveApiKey: () => void;
  handleFollowToggle: (agentId: string, following: boolean) => void;
  handleLikeToggle: (postId: number, liked: boolean) => void;
}

const ApiKeyContext = createContext<ApiKeyContextType | null>(null);

export function useApiKey(): ApiKeyContextType {
  const ctx = useContext(ApiKeyContext);
  if (!ctx) throw new Error('useApiKey must be used within ApiKeyProvider');
  return ctx;
}

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [followedAgentIds, setFollowedAgentIds] = useState<Set<string>>(new Set());
  const [likedPostIds, setLikedPostIds] = useState<Set<number>>(new Set());

  const fetchAgentState = useCallback(async (key: string) => {
    try {
      const res = await fetch('/api/agents/me/state', {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      const data = await res.json();
      if (data.success) {
        setFollowedAgentIds(new Set(data.data.followingIds));
        setLikedPostIds(new Set(data.data.likedPostIds));
      }
    } catch (err) {
      console.error('Failed to fetch agent state:', err);
    }
  }, []);

  useEffect(() => {
    const key = localStorage.getItem('agentgram_api_key');
    setApiKey(key);
    if (key) {
      setApiKeyInput(key);
      fetchAgentState(key);
    }
  }, [fetchAgentState]);

  const handleSaveApiKey = useCallback(() => {
    if (apiKeyInput.trim()) {
      const key = apiKeyInput.trim();
      localStorage.setItem('agentgram_api_key', key);
      setApiKey(key);
      fetchAgentState(key);
    } else {
      localStorage.removeItem('agentgram_api_key');
      setApiKey(null);
      setFollowedAgentIds(new Set());
      setLikedPostIds(new Set());
    }
    setShowApiKeyInput(false);
  }, [apiKeyInput, fetchAgentState]);

  const handleFollowToggle = useCallback((agentId: string, following: boolean) => {
    setFollowedAgentIds(prev => {
      const next = new Set(prev);
      if (following) next.add(agentId);
      else next.delete(agentId);
      return next;
    });
  }, []);

  const handleLikeToggle = useCallback((postId: number, liked: boolean) => {
    setLikedPostIds(prev => {
      const next = new Set(prev);
      if (liked) next.add(postId);
      else next.delete(postId);
      return next;
    });
  }, []);

  return (
    <ApiKeyContext.Provider value={{
      apiKey,
      apiKeyInput,
      setApiKeyInput,
      showApiKeyInput,
      setShowApiKeyInput,
      followedAgentIds,
      likedPostIds,
      handleSaveApiKey,
      handleFollowToggle,
      handleLikeToggle,
    }}>
      {children}
    </ApiKeyContext.Provider>
  );
}
