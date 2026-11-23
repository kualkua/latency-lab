import http from 'k6/http';

const BASE = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    // Constant background: ~40 requests/s, 70% /fast and 30% /tail
    steady: {
      executor: 'constant-arrival-rate',
      rate: 40,
      timeUnit: '1s',
      duration: '15m',
      preAllocatedVUs: 50,
      maxVUs: 200,
      exec: 'steady',
    },
    // After 3 minutes start blocking the event loop (once a second for 200 ms)
    // for 3 minutes: p95/p99 of ALL routes and event loop lag will grow on the dashboard.
    blocker: {
      executor: 'constant-arrival-rate',
      rate: 1,
      timeUnit: '1s',
      duration: '3m',
      startTime: '3m',
      preAllocatedVUs: 5,
      exec: 'blocker',
    },
  },
};

export function steady() {
  http.get(Math.random() < 0.7 ? `${BASE}/fast` : `${BASE}/tail`);
}

export function blocker() {
  http.get(`${BASE}/blocking?ms=200`);
}
