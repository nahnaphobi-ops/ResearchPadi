import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { CONFIG } from './config';
import authRoutes from './routes/auth.routes';
import papersRoutes from './routes/papers.routes';
import paymentsRoutes from './routes/payments.routes';
import subscriptionsRoutes from './routes/subscriptions.routes';
import workspaceRoutes from './routes/workspace.routes';
import adminRoutes from './routes/admin.routes';
import writingAssistRoutes from './routes/writing-assist.routes';
import blueprintRoutes from './routes/blueprint.routes';
import usageRoutes from './routes/usage.routes';
import { healthCheck, liveness, readiness } from './controllers/health.controller';
import { metricsEndpoint } from './controllers/metrics.controller';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/request-logger.middleware';
import { createGlobalRateLimit } from './middleware/rate-limit.middleware';

dotenv.config();

const app = express();

// Security
app.use(helmet({
  contentSecurityPolicy: CONFIG.NODE_ENV === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Compression — gzip/brotli for all responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024,
}));

// Global rate limit: Redis-backed for distributed pods
app.use(createGlobalRateLimit());

app.use(express.json({ limit: '10mb' }));

// Request logging
app.use(requestLogger);

// API response caching for GET requests
if (CONFIG.NODE_ENV === 'production') {
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET') {
      const noCache = req.headers['cache-control'] === 'no-cache' || req.query._nocache;
      if (!noCache) {
        res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
        res.setHeader('X-Cache-Tier', 'api');
      }
    }
    next();
  });
}

// Static asset caching headers
app.use('/assets', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/papers', papersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/writing-assist', writingAssistRoutes);
app.use('/api/blueprints', blueprintRoutes);
app.use('/api/usage', usageRoutes);

// Health checks (no compression overhead)
app.get('/health', healthCheck);
app.get('/health/live', liveness);
app.get('/health/ready', readiness);

// Prometheus metrics
app.get('/metrics', metricsEndpoint);

app.get('/', (req, res) => {
  res.json({ message: 'ResearchPadi API is running' });
});

// Error handling
app.use(errorHandler);

export default app;
