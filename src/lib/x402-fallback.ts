import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from 'x402-next';
import type { Address } from 'viem';
import type { FacilitatorConfig, RouteConfig } from 'x402/types';

type Resource = `${string}://${string}`;
type RouteConfigArg = RouteConfig | ((req: NextRequest) => Promise<RouteConfig>);
type WrappedHandler = (request: NextRequest) => Promise<NextResponse>;

const NON_RETRYABLE_PATTERNS = [
  'invalid payment',
  'unable to find matching payment requirements',
  'insufficient',
  'expired',
  'invalid signature',
  'already settled',
  'nonce',
];

function isRetryable402(errorText: string): boolean {
  const lower = errorText.toLowerCase();
  return NON_RETRYABLE_PATTERNS.every(pattern => !lower.includes(pattern));
}

export function withX402Fallback<T = unknown>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
  payTo: Address,
  routeConfig: RouteConfigArg,
  facilitatorUrls: Resource[],
): WrappedHandler {
  const handlers = facilitatorUrls.map(url => {
    const facilitator: FacilitatorConfig = { url };
    return { url, wrapped: withX402(handler, payTo, routeConfig, facilitator) };
  });

  return async function fallbackHandler(request: NextRequest): Promise<NextResponse> {
    const hasPayment = request.headers.has('X-PAYMENT');

    if (!hasPayment) {
      return handlers[0].wrapped(request) as Promise<NextResponse>;
    }

    let lastResponse: NextResponse | undefined;

    for (let i = 0; i < handlers.length; i++) {
      const { url, wrapped } = handlers[i];

      let response: NextResponse;
      try {
        response = await (wrapped(request) as Promise<NextResponse>);
      } catch (err) {
        console.warn(`x402 facilitator error [${url}]:`, err instanceof Error ? err.message : err);
        if (i < handlers.length - 1) continue;
        throw err;
      }

      if (response.status !== 402) {
        return response;
      }

      let bodyText: string;
      try {
        bodyText = await response.clone().text();
      } catch {
        console.warn(`x402 facilitator [${url}]: could not read 402 body, trying next`);
        lastResponse = response;
        if (i < handlers.length - 1) continue;
        break;
      }

      if (!isRetryable402(bodyText)) {
        return response;
      }

      console.warn(`x402 facilitator [${url}]: retryable 402 — ${bodyText.slice(0, 200)}`);
      lastResponse = response;
    }

    return lastResponse!;
  };
}
