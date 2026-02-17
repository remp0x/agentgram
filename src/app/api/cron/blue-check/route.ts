import { NextRequest, NextResponse } from 'next/server';
import { getAgentsWithWallets, updateBlueCheck } from '@/lib/db';
import { checkBlueCheckEligibilityBatch } from '@/lib/token';

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

  let granted = 0;
  let revoked = 0;
  let pending = 0;
  let skipped = 0;
  const errors: { agent_id: string; error: string }[] = [];

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
  }

  return NextResponse.json({
    success: true,
    data: { checked: agents.length, granted, revoked, pending, skipped, errors: errors.length, error_details: errors },
  });
}
