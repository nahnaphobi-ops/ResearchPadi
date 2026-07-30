import { Client } from 'pg';
import bcrypt from 'bcryptjs';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'admin',
  mfa_enabled BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  otp_hash TEXT,
  otp_expires TIMESTAMPTZ,
  refresh_token TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
`;

const ADD_COLUMNS_SQL = `
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT true;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS otp_hash TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS otp_expires TIMESTAMPTZ;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
`;

function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 12) errors.push('Password must be at least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('Password must contain a special character');
  return { valid: errors.length === 0, errors };
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function needsSsl(connectionString: string): boolean {
  if (/[?&]sslmode=/i.test(connectionString)) return false;
  return (
    process.env.NODE_ENV === 'production' ||
    /supabase\.co/i.test(connectionString)
  );
}

async function main() {
  // Non-blocking for Render boot: log and exit 0 so the API can still start.
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('WARN: DATABASE_URL not set — skipping admin seed');
    process.exit(0);
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminFullName = process.env.ADMIN_FULL_NAME || 'Super Admin';

  const client = new Client({
    connectionString,
    ...(needsSsl(connectionString) ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  try {
    await client.connect();
    console.log('Connected to database');

    await client.query(CREATE_TABLE_SQL);
    console.log('admin_users table created successfully');

    await client.query(ADD_COLUMNS_SQL);
    console.log('admin_users columns updated');

    if (adminEmail && adminPassword) {
      if (!validateEmail(adminEmail)) {
        console.error(`WARN: Invalid email address: ${adminEmail} — skipping admin user`);
        return;
      }

      const pwCheck = validatePassword(adminPassword);
      if (!pwCheck.valid) {
        console.error('WARN: Password does not meet security requirements:');
        pwCheck.errors.forEach(e => console.error(`  - ${e}`));
        console.error('Skipping admin user creation');
        return;
      }

      const passwordHash = await bcrypt.hash(adminPassword, 12);
      const mfaEnabled = process.env.ADMIN_MFA !== 'false';
      await client.query(
        `INSERT INTO admin_users (email, password_hash, full_name, mfa_enabled, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (email) DO UPDATE SET password_hash = $2, full_name = $3, mfa_enabled = $4, is_active = true`,
        [adminEmail, passwordHash, adminFullName, mfaEnabled]
      );
      console.log(`Admin user '${adminEmail}' created/updated successfully`);
      console.log(`  Full name: ${adminFullName}`);
      console.log(`  MFA: ${mfaEnabled ? 'enabled' : 'disabled'}`);
      console.log(`  Role: admin`);
    } else {
      console.log('No ADMIN_EMAIL/ADMIN_PASSWORD env vars set. Skipping admin user creation.');
    }
  } catch (err: any) {
    console.error('WARN: Admin seed failed (continuing startup):', err.message);
  } finally {
    try {
      await client.end();
    } catch {
      // ignore close errors
    }
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('WARN: Admin seed unexpected error (continuing startup):', err?.message || err);
  process.exit(0);
});
