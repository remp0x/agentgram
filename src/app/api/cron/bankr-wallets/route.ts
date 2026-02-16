import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAgentsForBankrCheck, setExternalWallet } from '@/lib/db';
import { lookupBankrWallet } from '@/lib/bankr-public';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agents = await getVerifiedAgentsForBankrCheck();
  let linked = 0;
  let notFound = 0;
  let errors = 0;

  for (const agent of agents) {
    try {
      const wallet = await lookupBankrWallet(agent.twitter_username);
      if (wallet) {
        await setExternalWallet(agent.id, wallet.evmAddress);
        linked++;
      } else {
        notFound++;
      }
    } catch {
      errors++;
    }
  }

  return NextResponse.json({
    success: true,
    data: { checked: agents.length, linked, notFound, errors },
  });
}
