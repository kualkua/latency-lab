import type { NextFunction, Request, Response } from 'express';
import client from 'prom-client';

/**
 * Bucket boundaries in seconds: 5 ms ... 2.5 s, step of roughly x2–x2.5.
 * Chosen around the goal "p99 < 100 ms": buckets are dense near 0.1,
 * otherwise p99 would "jump" between coarse boundaries.
 */
export const LATENCY_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5];

export function createMetrics() {
  // A separate registry per app, so tests do not conflict with each other.
  const register = new client.Registry();
  client.collectDefaultMetrics({ register }); // enables nodejs_eventloop_lag_*

  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration, seconds',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: LATENCY_BUCKETS,
    registers: [register],
  });

  /** Measures the time from the start of the request to sending the response. */
  function middleware(req: Request, res: Response, next: NextFunction) {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      // route = route template ("/fast"), not the real URL.
      // Otherwise every unique URL creates a new time series (cardinality explosion).
      const route = req.route?.path ?? 'unmatched';
      end({ method: req.method, route, status: String(res.statusCode) });
    });
    next();
  }

  return { register, httpDuration, middleware };
}
