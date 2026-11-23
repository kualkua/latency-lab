import express from 'express';
import { log } from './logger';
import { createMetrics } from './metrics';
import { withSpan } from './spans';
import { createHttpWallet, createLocalWallet, WalletClient } from './wallet-client';

export interface AppOptions {
  /** Source of randomness: replaced in tests to make results predictable. */
  random?: () => number;
  /** Asynchronous pause (simulates a call to a DB / external service). */
  sleep?: (ms: number) => Promise<void>;
  /** Synchronous thread block (simulates heavy CPU code). */
  busyWait?: (ms: number) => void;
  /** Wallet service client. Default: HTTP if WALLET_URL is set, otherwise an in-process "DB". */
  wallet?: WalletClient;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const defaultBusyWait = (ms: number) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    // spin and keep the event loop busy
  }
};

export const MAX_BLOCK_MS = 1000;

export function createApp(options: AppOptions = {}) {
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;
  const busyWait = options.busyWait ?? defaultBusyWait;
  const wallet =
    options.wallet ??
    (process.env.WALLET_URL ? createHttpWallet(process.env.WALLET_URL) : createLocalWallet({ random, sleep }));

  const app = express();
  const metrics = createMetrics();
  app.use(metrics.middleware);

  // Fast request: 5–15 ms (e.g. a cache hit).
  app.get('/fast', async (_req, res) => {
    await withSpan('cache.lookup', { 'cache.system': 'simulated' }, () => sleep(5 + random() * 10));
    res.json({ ok: true, path: 'fast' });
  });

  // Request with a "tail": fetches the balance from wallet (98% fast, 2% slow, 500–900 ms).
  // p50 stays low while p99 goes up — that is the difference between them.
  app.get('/tail', async (_req, res) => {
    try {
      const { slow } = await withSpan('wallet.getBalance', {}, () => wallet.getBalance());
      log('info', 'tail served', { slow });
      res.json({ ok: true, path: 'tail', slow });
    } catch (error) {
      log('error', 'wallet call failed', { error: (error as Error).message });
      res.status(502).json({ ok: false, error: 'wallet unavailable' });
    }
  });

  // Blocks the event loop for N ms (200 by default). While it is busy,
  // ALL other requests wait in the queue — the tail grows for the whole service.
  app.get('/blocking', (req, res) => {
    const requested = Number(req.query.ms ?? 200);
    const ms = Math.min(Number.isFinite(requested) ? requested : 200, MAX_BLOCK_MS);
    busyWait(ms);
    res.json({ ok: true, path: 'blocking', blockedMs: ms });
  });

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.register.metrics());
  });

  return app;
}
