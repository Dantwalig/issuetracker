import http from 'k6/http';
import { check, sleep } from 'k6';

// ── Scenario ────────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '5s', target: 10 },  // ramp up to 10 users
    { duration: '15s', target: 10 }, // hold at 10 users
    { duration: '5s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<800'], // 95% of requests < 300ms
  },
};

// Point at a local backend by default; override for the hosted API:
//   k6 run -e BASE_URL=https://trackr-api-yync.onrender.com/api scripts/load-test.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api';

// Optional: scope the test to one project's sprint/backlog/board endpoints.
const PROJECT_ID = __ENV.PROJECT_ID || '';

// ── Auth (runs once) ─────────────────────────────────────────────────────────
// Login up-front so the whole run exercises real authorized code paths:
//   k6 run -e TEST_EMAIL=you@example.com -e TEST_PASSWORD=secret scripts/load-test.js
export function setup() {
  const email = __ENV.TEST_EMAIL || '';
  const password = __ENV.TEST_PASSWORD || '';
  if (!email || !password) return { token: '' };

  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const body = res.json();
  return { token: body?.accessToken || body?.access_token || '' };
}

export default function (data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...(data.token ? { Authorization: 'Bearer ' + data.token } : {}),
    },
  };

  const endpoints = [
    ['dashboard', `${BASE_URL}/my-work/dashboard`],
    ['conversations', `${BASE_URL}/messages/conversations`],
    ['projects', `${BASE_URL}/projects`],
    ['notifications', `${BASE_URL}/notifications`],
  ];

  if (PROJECT_ID) {
    endpoints.push(
      [`sprints:${PROJECT_ID}`, `${BASE_URL}/projects/${PROJECT_ID}/sprints`],
      [`backlog:${PROJECT_ID}`, `${BASE_URL}/projects/${PROJECT_ID}/backlog`],
      [`board:${PROJECT_ID}`, `${BASE_URL}/projects/${PROJECT_ID}/board`],
    );
  }

  for (const [name, url] of endpoints) {
    const res = http.get(url, params);
    check(res, {
      [`${name} is 200`]: (r) => r.status === 200,
      [`${name} < 300ms`]: (r) => r.timings.duration < 300,
    });
  }

  sleep(1);
}
