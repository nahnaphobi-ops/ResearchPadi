import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 5000 }, // ramp-up to 5k VUs
    { duration: '5m', target: 5000 }, // stay at 5k
    { duration: '2m', target: 0 },    // ramp-down
  ],
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SESSION_ID = __ENV.SESSION_ID || 'test-session';

export default function () {
  const res = http.get(`${BASE_URL}/api/workspace/${SESSION_ID}`);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1);
}
