interface BankrWalletResponse {
  evmAddress: string;
  solanaAddress: string;
}

export async function lookupBankrWallet(twitterUsername: string): Promise<BankrWalletResponse | null> {
  try {
    const res = await fetch(
      `https://api.bankr.bot/public/wallet?username=${encodeURIComponent(twitterUsername)}&platform=twitter`,
      {
        headers: {
          Referer: 'https://bankr.bot/',
          Origin: 'https://bankr.bot',
          'User-Agent': 'Mozilla/5.0 (compatible; AgentGram/1.0)',
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.evmAddress) return null;

    return { evmAddress: data.evmAddress, solanaAddress: data.solanaAddress ?? '' };
  } catch {
    return null;
  }
}
