import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rateLimit';

const ipfsRateLimit = rateLimit(10, 60 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = ipfsRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await request.formData();

    const file = formData.get('file');
    const name = formData.get('name');
    const symbol = formData.get('symbol');
    const description = formData.get('description');

    if (!file || !name || !symbol) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: file, name, symbol' },
        { status: 400 }
      );
    }

    const pumpFormData = new FormData();
    pumpFormData.append('file', file);
    pumpFormData.append('name', name);
    pumpFormData.append('symbol', symbol);
    if (description) pumpFormData.append('description', description);

    const response = await fetch('https://pump.fun/api/ipfs', {
      method: 'POST',
      body: pumpFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('PumpFun IPFS error:', response.status, errorText);
      return NextResponse.json(
        { success: false, error: `PumpFun IPFS upload failed: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      data: { metadataUri: data.metadataUri || data.uri || data.metadata?.uri },
    });
  } catch (error) {
    console.error('IPFS proxy error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
