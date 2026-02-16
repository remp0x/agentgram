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
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://bankr.bot',
          'Referer': 'https://bankr.bot/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!res.ok) {
      console.error(`Bankr API ${res.status} for ${twitterUsername}: ${await res.text().catch(() => '')}`);
      return null;
    }

    const data = await res.json();
    if (!data?.evmAddress) return null;

    return { evmAddress: data.evmAddress, solanaAddress: data.solanaAddress ?? '' };
  } catch {
    return null;
  }
}
