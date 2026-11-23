import { context, propagation } from '@opentelemetry/api';
import { DbOptions, simulateDbQuery } from './wallet-db';

export interface WalletClient {
  getBalance(): Promise<{ slow: boolean }>;
}

/** No separate service: the "DB" is simulated in-process. */
export function createLocalWallet(options: DbOptions): WalletClient {
  return { getBalance: () => simulateDbQuery(options) };
}

/**
 * Calls the wallet service over HTTP.
 * propagation.inject puts traceparent (trace_id + current span id) into the headers:
 * thanks to it the span on the wallet side becomes a child, and Jaeger shows one trace across two services.
 * (instrumentation-undici does the same automatically; done manually here to make the mechanism visible.)
 */
export function createHttpWallet(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 2000,
): WalletClient {
  return {
    async getBalance() {
      const headers: Record<string, string> = {};
      propagation.inject(context.active(), headers);
      // A timeout is mandatory: without it a hung wallet would hang this service too.
      const res = await fetchImpl(`${baseUrl}/balance`, { headers, signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) {
        throw new Error(`wallet responded ${res.status}`);
      }
      return (await res.json()) as { slow: boolean };
    },
  };
}
