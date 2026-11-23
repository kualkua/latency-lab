import express from 'express';
import { log } from './logger';
import { createMetrics } from './metrics';
import { simulateDbQuery } from './wallet-db';

export interface WalletOptions {
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Second service: "wallet". Returns the balance, queries the "DB" internally. */
export function createWalletApp(options: WalletOptions = {}) {
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? defaultSleep;

  const app = express();
  const metrics = createMetrics();
  app.use(metrics.middleware);

  app.get('/balance', async (_req, res) => {
    const { slow } = await simulateDbQuery({ random, sleep });
    log('info', 'balance served', { slow });
    res.json({ balance: 100, slow });
  });

  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', metrics.register.contentType);
    res.end(await metrics.register.metrics());
  });

  return app;
}
