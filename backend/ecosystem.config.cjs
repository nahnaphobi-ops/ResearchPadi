module.exports = {
  apps: [
    {
      name: 'researchpadi-api',
      script: './dist/index.js',
      instances: 'max', // Use all CPU cores
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '1G',
      listen_timeout: 10000,
      kill_timeout: 5000,
      error_file: '/var/log/pm2/api-error.log',
      out_file: '/var/log/pm2/api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
    {
      name: 'researchpadi-worker',
      script: './dist/workers/paper.worker.js',
      instances: parseInt(process.env.WORKER_INSTANCES || '2', 10),
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '2G',
      listen_timeout: 10000,
      kill_timeout: 5000,
      error_file: '/var/log/pm2/worker-error.log',
      out_file: '/var/log/pm2/worker-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    },
  ],
};
