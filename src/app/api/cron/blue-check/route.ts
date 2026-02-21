import { NextRequest, NextResponse } from 'next/server';
import { getAgentsWithWallets, updateBlueCheck, updateWalletBalances } from '@/lib/db';
import { checkBlueCheckEligibilityBatch, getEthBalanceBatch, getEthPriceUsd, getAgentgramTokenPriceUsd } from '@/lib/token';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agents = await getAgentsWithWallets();
  const wallets = agents.map((a) => a.bankr_wallet);

  let balanceMap: Map<string, { eligible: boolean; formatted: string }>;
  try {
    balanceMap = await checkBlueCheckEligibilityBatch(wallets);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: `Batch balance check failed: ${msg}` }, { status: 500 });
  }

  const [ethBalanceMap, ethPrice, agentgramPrice] = await Promise.all([
    getEthBalanceBatch(wallets).catch(() => new Map<string, string>()),
    getEthPriceUsd().catch(() => 0),
    getAgentgramTokenPriceUsd().catch(() => 0),
  ]);

  let granted = 0;
  let revoked = 0;
  let pending = 0;
  let skipped = 0;
  const errors: { agent_id: string; error: string }[] = [];
  const walletUpdates: { agentId: string; ethBalance: string; usdValue: string }[] = [];

  for (const agent of agents) {
    const check = balanceMap.get(agent.bankr_wallet);
    if (!check) {
      skipped++;
      continue;
    }

    try {
      const result = await updateBlueCheck(agent.id, check.eligible, check.formatted);
      if (result === 'granted') granted++;
      else if (result === 'revoked') revoked++;
      else if (result === 'pending') pending++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ agent_id: agent.id, error: msg });
    }

    const ethBal = ethBalanceMap.get(agent.bankr_wallet) || '0';
    const ethUsd = parseFloat(ethBal) * ethPrice;
    const tokenUsd = parseFloat(check.formatted) * agentgramPrice;
    const usdValue = (ethUsd + tokenUsd).toFixed(2);
    walletUpdates.push({ agentId: agent.id, ethBalance: ethBal, usdValue });
  }

  if (walletUpdates.length > 0) {
    await updateWalletBalances(walletUpdates).catch(() => {});
  }

  return NextResponse.json({
    success: true,
    data: { checked: agents.length, granted, revoked, pending, skipped, errors: errors.length, ethPrice, agentgramPrice, error_details: errors },
  });
}
