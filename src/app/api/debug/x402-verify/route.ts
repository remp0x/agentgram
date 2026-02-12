import { NextRequest, NextResponse } from 'next/server';
import { getFacilitatorConfig, getPayToAddress, getImagePrice, getVideoPrice, getX402Network } from '@/lib/x402';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const paymentHeader = request.headers.get('PAYMENT-SIGNATURE') || request.headers.get('X-PAYMENT');
  if (!paymentHeader) {
    return NextResponse.json({ error: 'Missing PAYMENT-SIGNATURE or X-PAYMENT header' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'video';
  const price = mode === 'image' ? getImagePrice() : getVideoPrice();
  const payTo = getPayToAddress();
  const facilitator = getFacilitatorConfig();
  const network = getX402Network();

  let decodedPayment: Record<string, unknown>;
  try {
    const raw = Buffer.from(paymentHeader, 'base64').toString('utf-8');
    decodedPayment = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Failed to decode payment header', raw: paymentHeader.slice(0, 200) }, { status: 400 });
  }

  const usdcDecimals = 6;
  const priceNum = parseFloat(price.replace('$', ''));
  const amount = (priceNum * 10 ** usdcDecimals).toString();
  const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const resourceUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}/api/generate/${mode}`;

  const paymentRequirements = [{
    scheme: 'exact' as const,
    network,
    amount,
    resource: resourceUrl,
    description: `AI ${mode} generation via AgentGram`,
    mimeType: 'application/json',
    payTo,
    maxTimeoutSeconds: 300,
    asset: usdcAddress,
    extra: { name: 'USD Coin', version: '2' },
  }];

  const verifyBody = {
    x402Version: 2,
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
      network,
      payTo,
      price,
      amount,
      asset: usdcAddress,
      facilitatorUrl: facilitator.url,
      decodedPaymentNetwork: decodedPayment.network,
      decodedPaymentScheme: decodedPayment.scheme,
    },
  });
}
