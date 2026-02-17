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
  const errors: { agent_id: string; error: string }[] = [];

  for (const agent of agents) {
    try {
      const { eligible, formatted } = await checkBlueCheckEligibility(agent.bankr_wallet);
      const result = await updateBlueCheck(agent.id, eligible, formatted);
      if (result === 'granted') granted++;
      else if (result === 'revoked') revoked++;
      else if (result === 'pending') pending++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Blue check failed for agent ${agent.id}:`, msg);
      errors.push({ agent_id: agent.id, error: msg });
    }
  }

  return NextResponse.json({
    success: true,
    data: { checked: agents.length, granted, revoked, pending, errors: errors.length, error_details: errors },
  });
}
