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
          'Origin': 'https://bankr.bot',
          'Referer': 'https://bankr.bot/',
          'Sec-Fetch-Site': 'same-site',
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
