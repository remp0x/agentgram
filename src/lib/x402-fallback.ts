import { NextRequest, NextResponse } from 'next/server';
import { x402HTTPResourceServer } from '@x402/core/server';
import type { HTTPAdapter, RouteConfig } from '@x402/core/server';
import { ensureResourceServerInit } from './x402';

type WrappedHandler = (request: NextRequest) => Promise<NextResponse>;

export interface PaymentSettlement {
  transaction?: string;
  network?: string;
  payer?: string;
}

class NextJSAdapter implements HTTPAdapter {
  constructor(private req: NextRequest) {}

  getHeader(name: string): string | undefined {
    return this.req.headers.get(name) ?? undefined;
  }

  getMethod(): string {
    return this.req.method;
  }

  getPath(): string {
    return this.req.nextUrl.pathname;
  }

  getUrl(): string {
    return this.req.url;
  }

  getAcceptHeader(): string {
    return this.req.headers.get('accept') ?? '';
  }

  getUserAgent(): string {
    return this.req.headers.get('user-agent') ?? '';
  }
}

export function withX402Fallback<T = unknown>(
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
  routeConfig: RouteConfig,
  onPaymentSettled?: (req: NextRequest, settlement: PaymentSettlement) => Promise<void>,
): WrappedHandler {
  let httpServer: x402HTTPResourceServer | null = null;
  let initPromise: Promise<void> | null = null;

  async function lazyInit(): Promise<x402HTTPResourceServer> {
    if (!httpServer) {
      const resourceServer = await ensureResourceServerInit();
      httpServer = new x402HTTPResourceServer(resourceServer, routeConfig);
      initPromise = httpServer.initialize();
    }
    await initPromise;
    return httpServer;
  }

  return async function protectedHandler(request: NextRequest): Promise<NextResponse> {
    const server = await lazyInit();
    const adapter = new NextJSAdapter(request);
    const context = {
      adapter,
      path: adapter.getPath(),
      method: adapter.getMethod(),
    };

    const result = await server.processHTTPRequest(context);

    if (result.type === 'no-payment-required') {
      return handler(request);
    }

    if (result.type === 'payment-error') {
      const { status, headers, body, isHtml } = result.response;
      return new NextResponse(
        typeof body === 'string' ? body : JSON.stringify(body),
        {
          status,
          headers: {
            'Content-Type': isHtml ? 'text/html' : 'application/json',
            ...headers,
          },
        },
      );
    }

    const response = await handler(request) as NextResponse;

    const settleResult = await server.processSettlement(
      result.paymentPayload,
      result.paymentRequirements,
      result.declaredExtensions,
    );

    if (settleResult.success) {
      for (const [key, value] of Object.entries(settleResult.headers)) {
        response.headers.set(key, value);
      }

      if (onPaymentSettled) {
        onPaymentSettled(request, {
          transaction: settleResult.transaction,
          network: settleResult.network,
          payer: settleResult.payer,
        }).catch(err => console.error('onPaymentSettled callback error:', err));
      }
    } else {
      console.warn('x402: settlement failed after handler —', settleResult.errorReason);
    }

    return response;
  };
}
