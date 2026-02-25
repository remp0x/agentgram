'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { AtelierAppLayout } from '@/components/atelier/AtelierAppLayout';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

interface Profile {
  wallet: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

export default function AtelierProfilePage() {
  const wallet = useWallet();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const walletAddress = wallet.publicKey?.toBase58();

  const loadProfile = useCallback(async (addr: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/atelier/profile?wallet=${addr}`);
      const json = await res.json();
      if (json.success && json.data) {
        setProfile(json.data);
        setDisplayName(json.data.display_name || '');
        setBio(json.data.bio || '');
        setAvatarUrl(json.data.avatar_url || '');
      } else {
        setProfile(null);
        setDisplayName('');
        setBio('');
        setAvatarUrl('');
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (walletAddress) {
      loadProfile(walletAddress);
    } else if (!wallet.connecting) {
      setLoading(false);
    }
  }, [walletAddress, wallet.connecting, loadProfile]);

  const handleSave = async () => {
    if (!walletAddress) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/atelier/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          display_name: displayName || undefined,
          bio: bio || undefined,
          avatar_url: avatarUrl || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setProfile(json.data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !walletAddress) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/atelier/profile/avatar?wallet=${walletAddress}`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (json.success) {
        setAvatarUrl(json.data.url);
      }
    } catch {
      // silent
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const truncatedWallet = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <AtelierAppLayout>
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold text-black dark:text-white font-display mb-8">
          Profile
        </h1>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-atelier border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !walletAddress ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-atelier/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-atelier" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
            </div>
            <p className="text-sm text-neutral-500 font-mono mb-4">Connect your wallet to view your profile</p>
            <WalletMultiButton
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 600,
                borderRadius: '0.5rem',
                height: '2.5rem',
                padding: '0 1.5rem',
              }}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Wallet display */}
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-black-soft border border-gray-200 dark:border-neutral-800">
              <label className="block text-xs font-mono text-neutral-500 mb-1">Wallet</label>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-black dark:text-white">{truncatedWallet}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(walletAddress)}
                  className="text-neutral-400 hover:text-atelier transition-colors"
                  title="Copy full address"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Avatar preview + upload */}
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-800 group flex-shrink-0"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-atelier/10 flex items-center justify-center text-atelier text-xl font-bold font-display">
                    {displayName ? displayName.charAt(0).toUpperCase() : '?'}
                  </div>
                )}
                {uploading ? (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                    </svg>
                  </div>
                )}
              </button>
              <div className="flex-1">
                <p className="text-sm font-semibold text-black dark:text-white font-display">
                  {displayName || 'Anonymous'}
                </p>
                <p className="text-xs text-neutral-500 font-mono">{truncatedWallet}</p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-neutral-500 mb-1.5">Display Name</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={50}
                  placeholder="How you want to be known"
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 text-black dark:text-white text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier"
                />
              </div>

              <div>
                <label className="block text-sm font-mono text-neutral-500 mb-1.5">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  rows={3}
                  placeholder="A short bio about yourself"
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 text-black dark:text-white text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier resize-none"
                />
                <span className="text-2xs font-mono text-neutral-500">{bio.length}/280</span>
              </div>

            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded-lg bg-gradient-atelier text-white text-sm font-semibold font-mono disabled:opacity-60 button-press transition-opacity flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                'Saved'
              ) : profile ? (
                'Save Changes'
              ) : (
                'Create Profile'
              )}
            </button>
          </div>
        )}
      </div>
    </AtelierAppLayout>
  );
}
