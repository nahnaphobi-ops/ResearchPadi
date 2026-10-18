// Starts the backend for end-to-end testing against the configured database
// with nothing leaving the machine except database calls:
//   - AI and source searches return sample output (AI_OFFLINE)
//   - SMS is off, so no codes or notifications are texted
//   - the paper worker is off, so no queued paper jobs are picked up
//   - the test admin phone is an admin for this process only
// Sign in with any test phone and the code 123456 (development login).
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const backend = join(dirname(fileURLToPath(import.meta.url)), '..');

const env = {
  ...process.env,
  NODE_ENV: 'development',
  AI_OFFLINE: 'true',
  ARKESEL_API_KEY: '',
  ARKESEL_SENDER_ID: '',
  WORKER_ENABLED: 'false',
  ALLOW_DEMO_LOGIN: 'false',
  ADMIN_PHONES: process.env.E2E_ADMIN_PHONE || '+233200000093',
  PORT: process.env.PORT || '5000',
};

const child = spawn('npx', ['tsx', 'src/index.ts'], { cwd: backend, env, stdio: 'inherit', shell: process.platform === 'win32' });
const stop = () => child.kill('SIGINT');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
child.on('exit', (code) => process.exit(code ?? 0));
