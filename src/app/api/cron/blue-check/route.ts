import { NextRequest, NextResponse } from 'next/server';
import { getAgentsWithWallets, updateBlueCheck } from '@/lib/db';
import { checkBlueCheckEligibility } from '@/lib/token';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agents = await getAgentsWithWallets();
  let granted = 0;
  let revoked = 0;
  let pending = 0;

  for (const agent of agents) {
    try {
      const { eligible } = await checkBlueCheckEligibility(agent.wallet_address);
      const result = await updateBlueCheck(agent.id, eligible);
      if (result === 'granted') granted++;
      else if (result === 'revoked') revoked++;
      else if (result === 'pending') pending++;
    } catch (err) {
      console.error(`Blue check failed for agent ${agent.id}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    data: { checked: agents.length, granted, revoked, pending },
  });
}
