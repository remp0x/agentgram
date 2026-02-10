import { NextRequest, NextResponse } from 'next/server';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import { useFacilitator } from 'x402/verify';
import { decodePayment } from 'x402/schemes';
import {
  processPriceToAtomicAmount,
  findMatchingPaymentRequirements,
  toJsonSafe,
} from 'x402/shared';
import { settleResponseHeader } from 'x402/types';
import type {
  FacilitatorConfig,
  RouteConfig,
  PaymentRequirements,
} from 'x402/types';

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

function isRetryable(errorMsg: string): boolean {
  const lower = errorMsg.toLowerCase();
  return NON_RETRYABLE_PATTERNS.every(pattern => !lower.includes(pattern));
}

function buildPaymentRequirements(
  payTo: Address,
  resource: string,
  routeConfig: RouteConfig,
): PaymentRequirements[] {
  const result = processPriceToAtomicAmount(routeConfig.price, routeConfig.network);
  if ('error' in result) {
    throw new Error(`x402: invalid price config — ${result.error}`);
  }

  return [{
    scheme: 'exact' as const,
    network: routeConfig.network,
    maxAmountRequired: result.maxAmountRequired,
    asset: typeof result.asset === 'object' && 'address' in result.asset
      ? result.asset.address
      : String(result.asset),
    payTo: getAddress(payTo),
    resource,
    description: routeConfig.config?.description ?? '',
    mimeType: routeConfig.config?.mimeType ?? 'application/json',
    maxTimeoutSeconds: routeConfig.config?.maxTimeoutSeconds ?? 60,
    ...(routeConfig.config?.outputSchema ? { outputSchema: routeConfig.config.outputSchema } : {}),
  }];
}

function make402Response(requirements: PaymentRequirements[]): NextResponse {
  const body = {
    x402Version: 1,
    accepts: requirements,
  };
  return new NextResponse(JSON.stringify(toJsonSafe(body)), {
    status: 402,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function withX402Fallback<T = unknown>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
  payTo: Address,
  routeConfig: RouteConfigArg,
  facilitatorUrls: Resource[],
): WrappedHandler {
  return async function settleFirstHandler(request: NextRequest): Promise<NextResponse> {
    const resolvedConfig = typeof routeConfig === 'function'
      ? await routeConfig(request)
      : routeConfig;

    const resource = `${request.nextUrl.protocol}//${request.nextUrl.host}${request.nextUrl.pathname}` as Resource;
    const requirements = buildPaymentRequirements(payTo, resource, resolvedConfig);

    const paymentHeader = request.headers.get('X-PAYMENT');
    if (!paymentHeader) {
      return make402Response(requirements);
    }

    let payment;
    try {
      payment = decodePayment(paymentHeader);
    } catch (err) {
      console.warn('x402: failed to decode X-PAYMENT header:', err instanceof Error ? err.message : err);
      return new NextResponse(
        JSON.stringify({ x402Version: 1, error: 'invalid_payment' }),
        { status: 402, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const matched = findMatchingPaymentRequirements(requirements, payment);
    if (!matched) {
      return new NextResponse(
        JSON.stringify({
          x402Version: 1,
          error: 'unable to find matching payment requirements',
          accepts: requirements,
        }),
        { status: 402, headers: { 'Content-Type': 'application/json' } },
      );
    }

    let lastError: string | undefined;

    for (let i = 0; i < facilitatorUrls.length; i++) {
      const url = facilitatorUrls[i];
      const facilitator: FacilitatorConfig = { url };
      const { verify, settle } = useFacilitator(facilitator);

      try {
        const verifyResult = await verify(payment, matched);
        if (!verifyResult.isValid) {
          const reason = verifyResult.invalidReason ?? 'verification failed';
          console.warn(`x402 facilitator [${url}]: verify rejected — ${reason}`);

          if (!isRetryable(reason)) {
            return new NextResponse(
              JSON.stringify({ x402Version: 1, error: reason, payer: verifyResult.payer }),
              { status: 402, headers: { 'Content-Type': 'application/json' } },
            );
          }
          lastError = reason;
          continue;
        }

        const settleResult = await settle(payment, matched);
        if (!settleResult.success) {
          const reason = settleResult.errorReason ?? 'settlement failed';
          console.warn(`x402 facilitator [${url}]: settle failed — ${reason}`);

          if (!isRetryable(reason)) {
            return new NextResponse(
              JSON.stringify({ x402Version: 1, error: reason, payer: settleResult.payer }),
              { status: 402, headers: { 'Content-Type': 'application/json' } },
            );
          }
          lastError = reason;
          continue;
        }

        console.log(`x402 facilitator [${url}]: payment settled (tx: ${settleResult.transaction})`);

        const response = await handler(request) as NextResponse;
        response.headers.set('X-PAYMENT-RESPONSE', settleResponseHeader(settleResult));
        return response;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`x402 facilitator error [${url}]:`, msg);

        if (!isRetryable(msg)) {
          return new NextResponse(
            JSON.stringify({ x402Version: 1, error: msg }),
            { status: 402, headers: { 'Content-Type': 'application/json' } },
          );
        }
        lastError = msg;
        if (i < facilitatorUrls.length - 1) continue;
        throw err;
      }
    }

    return new NextResponse(
      JSON.stringify({ x402Version: 1, error: lastError ?? 'all facilitators failed' }),
      { status: 402, headers: { 'Content-Type': 'application/json' } },
    );
  };
}
