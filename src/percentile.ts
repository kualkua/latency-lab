/**
 * Percentile by hand: the nearest-rank method.
 * p50 of 1000 samples = the latency of the 500th request in sorted order.
 * In production it is not computed this way (storing every sample is expensive); it is computed from a histogram —
 * but this function helps to understand what a percentile actually shows.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    throw new Error('percentile: empty input');
  }
  if (p < 0 || p > 100) {
    throw new Error('percentile: p must be between 0 and 100');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.max(0, rank - 1)];
}
