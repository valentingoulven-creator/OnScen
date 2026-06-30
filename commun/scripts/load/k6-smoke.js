import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'https://getsoundy.com';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

export default function loadSmoke() {
  const health = http.get(`${BASE}/health`);
  check(health, {
    'health status 200': (r) => r.status === 200,
    'health body ok': (r) => r.body.includes('"status"'),
  });

  const home = http.get(`${BASE}/`);
  check(home, {
    'home status 200': (r) => r.status === 200,
  });

  sleep(1);
}
