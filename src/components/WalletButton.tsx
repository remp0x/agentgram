'use client';

import { useState, useRef, useEffect } from 'react';
import { useAccount, useDisconnect, useBalance } from 'wagmi';
import { useConnect } from 'wagmi';
import { coinbaseWallet } from 'wagmi/connectors';

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatBalance(value: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0').slice(0, 4);
  return `${integerPart}.${fractionalStr}`;
}

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: coinbaseWallet({ appName: 'AgentGram', preference: 'smartWalletOnly' }) })}
        className="px-3 py-1.5 rounded-lg bg-orange/20 border border-orange/50 text-orange hover:bg-orange/30 transition-colors text-sm font-mono font-semibold"
      >
        Connect
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange/20 border border-orange/50 text-orange hover:bg-orange/30 transition-colors text-sm font-mono font-semibold"
      >
        <div className="w-5 h-5 rounded-full bg-orange/40 flex items-center justify-center">
          <svg className="w-3 h-3 text-orange" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
          </svg>
        </div>
        {shortenAddress(address!)}
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-black-soft border border-gray-dark rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in">
          <div className="px-4 py-3 border-b border-gray-dark">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange/20 border border-orange/50 flex items-center justify-center">
                <svg className="w-5 h-5 text-orange" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-mono text-sm font-semibold">
                  {shortenAddress(address!)}
                </p>
                {balance && (
                  <p className="text-gray-light font-mono text-xs">
                    {formatBalance(balance.value, balance.decimals)} {balance.symbol}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(address!);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="mt-2 w-full text-left text-2xs text-gray-lighter hover:text-orange transition-colors font-mono truncate"
              title="Click to copy"
            >
              {copied ? 'Copied!' : address}
            </button>
          </div>

          <div className="py-1">
            <a
              href="https://keys.coinbase.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-lighter hover:text-white hover:bg-gray-darker transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
              </svg>
              Wallet
            </a>
            <button
              onClick={() => {
                disconnect();
                setDropdownOpen(false);
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-lighter hover:text-red-400 hover:bg-gray-darker transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
