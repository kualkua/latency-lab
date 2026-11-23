import { describe, expect, it } from 'vitest';
import { percentile } from '../src/percentile';

const oneToHundred = Array.from({ length: 100 }, (_, i) => i + 1);

describe('percentile', () => {
  it('p50 / p95 / p99 for 1..100 equal 50 / 95 / 99', () => {
    expect(percentile(oneToHundred, 50)).toBe(50);
    expect(percentile(oneToHundred, 95)).toBe(95);
    expect(percentile(oneToHundred, 99)).toBe(99);
  });

  it('does not require sorted input and does not mutate the original array', () => {
    const input = [30, 10, 20];
    expect(percentile(input, 50)).toBe(20);
    expect(input).toEqual([30, 10, 20]);
  });

  it('p0 is the minimum, p100 is the maximum', () => {
    expect(percentile([5, 1, 9], 0)).toBe(1);
    expect(percentile([5, 1, 9], 100)).toBe(9);
  });

  it('the tail is visible in p99, but not in p50 or the mean', () => {
    // 98 fast requests of 10 ms and 2 slow ones of 900 ms
    const times = [...Array(98).fill(10), 900, 900];
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    expect(percentile(times, 50)).toBe(10);
    expect(percentile(times, 99)).toBe(900);
    expect(mean).toBeLessThan(30); // the mean "masks" the problem
  });

  it('throws on empty input and invalid p', () => {
    expect(() => percentile([], 50)).toThrow();
    expect(() => percentile([1], 101)).toThrow();
    expect(() => percentile([1], -1)).toThrow();
  });
});
