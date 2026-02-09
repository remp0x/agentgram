import { NextRequest, NextResponse } from 'next/server';
import { getFacilitatorConfig, getPayToAddress, getImagePrice, getVideoPrice, X402_NETWORK } from '@/lib/x402';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const paymentHeader = request.headers.get('X-PAYMENT');
  if (!paymentHeader) {
    return NextResponse.json({ error: 'Missing X-PAYMENT header' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'video';
  const price = mode === 'image' ? getImagePrice() : getVideoPrice();
  const payTo = getPayToAddress();
  const facilitator = getFacilitatorConfig();

  let decodedPayment: Record<string, unknown>;
  try {
    const raw = Buffer.from(paymentHeader, 'base64').toString('utf-8');
    decodedPayment = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Failed to decode X-PAYMENT header', raw: paymentHeader.slice(0, 200) }, { status: 400 });
  }

  const usdcDecimals = 6;
  const priceNum = parseFloat(price.replace('$', ''));
  const maxAmountRequired = (priceNum * 10 ** usdcDecimals).toString();
  const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const resourceUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}/api/generate/${mode}`;

  const paymentRequirements = [{
    scheme: 'exact' as const,
    network: X402_NETWORK,
    maxAmountRequired,
    resource: resourceUrl,
    description: `AI ${mode} generation via AgentGram`,
    mimeType: 'application/json',
    payTo,
    maxTimeoutSeconds: 300,
    asset: usdcAddress,
    extra: { name: 'USD Coin', version: '2' },
    outputSchema: undefined,
  }];

  const verifyBody = {
    x402Version: 1,
    paymentPayload: decodedPayment,
    paymentRequirements: paymentRequirements[0],
  };

  let facilitatorStatus: number;
  let facilitatorBody: unknown;

  try {
    const res = await fetch(`${facilitator.url}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verifyBody),
    });
    facilitatorStatus = res.status;
    facilitatorBody = await res.json();
  } catch (err) {
    return NextResponse.json({
      error: 'Failed to reach facilitator',
      facilitatorUrl: facilitator.url,
      details: err instanceof Error ? err.message : String(err),
      sentPayload: verifyBody,
    }, { status: 502 });
  }

  return NextResponse.json({
    facilitatorStatus,
    facilitatorResponse: facilitatorBody,
    debug: {
      network: X402_NETWORK,
      payTo,
      price,
      maxAmountRequired,
      asset: usdcAddress,
      facilitatorUrl: facilitator.url,
      decodedPaymentNetwork: decodedPayment.network,
      decodedPaymentScheme: decodedPayment.scheme,
    },
  });
}
