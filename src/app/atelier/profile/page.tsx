'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { AtelierAppLayout } from '@/components/atelier/AtelierAppLayout';
import { signWalletAuth } from '@/lib/solana-auth-client';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then(mod => mod.WalletMultiButton),
  { ssr: false }
);

interface Profile {
  wallet: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  twitter_handle: string | null;
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
  const [twitterHandle, setTwitterHandle] = useState('');

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
        setTwitterHandle(json.data.twitter_handle || '');
      } else {
        setProfile(null);
        setDisplayName('');
        setBio('');
        setAvatarUrl('');
        setTwitterHandle('');
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
      const auth = await signWalletAuth(wallet);
      const res = await fetch('/api/atelier/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...auth,
          display_name: displayName || undefined,
          bio: bio || undefined,
          avatar_url: avatarUrl || undefined,
          twitter_handle: twitterHandle || undefined,
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
      const auth = await signWalletAuth(wallet);
      const form = new FormData();
      form.append('file', file);
      const params = new URLSearchParams({
        wallet: auth.wallet,
        wallet_sig: auth.wallet_sig,
        wallet_sig_ts: String(auth.wallet_sig_ts),
      });
      const res = await fetch(`/api/atelier/profile/avatar?${params}`, {
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
                className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800 group flex-shrink-0"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-atelier/10 flex items-center justify-center text-atelier text-2xl font-bold font-display">
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
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                    </svg>
                  </div>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-black dark:text-white font-display truncate">
                  {displayName || 'Anonymous'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs font-mono text-neutral-500">{truncatedWallet}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(walletAddress)}
                    className="text-neutral-400 hover:text-atelier transition-colors"
                    title="Copy full address"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                    </svg>
                  </button>
                </div>
                {twitterHandle && (
                  <a
                    href={`https://x.com/${twitterHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-atelier hover:underline mt-0.5 inline-block"
                  >
                    @{twitterHandle}
                  </a>
                )}
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

              <div>
                <label className="block text-sm font-mono text-neutral-500 mb-1.5">X / Twitter</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-sm font-mono">@</span>
                  <input
                    value={twitterHandle}
                    onChange={(e) => setTwitterHandle(e.target.value.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, ''))}
                    maxLength={30}
                    placeholder="username"
                    className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-gray-50 dark:bg-black border border-gray-200 dark:border-neutral-800 text-black dark:text-white text-sm font-mono placeholder:text-neutral-500 focus:outline-none focus:border-atelier"
                  />
                </div>
              </div>
            </div>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 rounded bg-atelier text-white text-sm font-semibold font-mono uppercase tracking-wider disabled:opacity-60 btn-atelier btn-primary transition-opacity flex items-center justify-center gap-2"
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
