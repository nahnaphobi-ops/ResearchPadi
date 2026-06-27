import dotenv from 'dotenv';
dotenv.config();

const REQUIRED_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
];

const RECOMMENDED_VARS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'DATABASE_URL',
  'REDIS_URL',
  'PAYSTACK_SECRET_KEY',
  'PERPLEXITY_API_KEY',
  'STORAGE_PROVIDER',
  'STORAGE_BUCKET',
];

const PRODUCTION_REQUIRED_VARS = [
  'DATABASE_URL',
  'REDIS_URL',
  'ADMIN_EMAIL',
  'ADMIN_PASSWORD',
];

interface EnvValidation {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnv(): EnvValidation {
  const missing: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  for (const v of REQUIRED_VARS) {
    if (!process.env[v]) missing.push(v);
  }

  if (isProduction) {
    for (const v of PRODUCTION_REQUIRED_VARS) {
      if (!process.env[v]) missing.push(`${v} (required in production)`);
    }
  }

  for (const v of RECOMMENDED_VARS) {
    if (!process.env[v]) warnings.push(v);
  }

  if (isProduction && process.env.JWT_SECRET === 'fallback-secret-for-dev-only') {
    missing.push('JWT_SECRET (using fallback in production)');
  }

  if (isProduction && process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length < 12) {
    warnings.push('ADMIN_PASSWORD should be at least 12 characters');
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}
