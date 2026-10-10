-- Atomic wallet operations, admin MFA columns, and canonical phone numbers.
-- Safe to re-run: every statement is idempotent.

-- ── Wallets: one per user ────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_id_key ON wallets (user_id);

-- ── Wallet operations ────────────────────────────────────────────────────
-- Each function takes a per-user advisory lock, so concurrent charges/credits
-- for the same user run one at a time (no lost updates, no double spend).
-- A non-null reference makes the call idempotent: repeating it is a no-op.

CREATE OR REPLACE FUNCTION debit_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_product TEXT,
  p_reference TEXT DEFAULT NULL
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('wallet:' || p_user_id::text));

  IF p_reference IS NOT NULL AND EXISTS (
    SELECT 1 FROM transactions WHERE reference = p_reference AND type = 'debit' AND status = 'success'
  ) THEN
    SELECT balance_ghs INTO v_balance FROM wallets WHERE user_id = p_user_id;
    RETURN COALESCE(v_balance, 0);
  END IF;

  UPDATE wallets
     SET balance_ghs = balance_ghs - p_amount, updated_at = NOW()
   WHERE user_id = p_user_id AND balance_ghs >= p_amount
  RETURNING balance_ghs INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;

  INSERT INTO transactions (user_id, type, amount_ghs, product, reference, status)
  VALUES (p_user_id, 'debit', p_amount, p_product, p_reference, 'success');

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION credit_wallet(
  p_user_id UUID,
  p_amount NUMERIC,
  p_product TEXT,
  p_reference TEXT DEFAULT NULL
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('wallet:' || p_user_id::text));

  IF p_reference IS NOT NULL AND EXISTS (
    SELECT 1 FROM transactions WHERE reference = p_reference AND type = 'credit' AND status = 'success'
  ) THEN
    SELECT balance_ghs INTO v_balance FROM wallets WHERE user_id = p_user_id;
    RETURN COALESCE(v_balance, 0);
  END IF;

  INSERT INTO wallets (user_id, balance_ghs) VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance_ghs = wallets.balance_ghs + EXCLUDED.balance_ghs, updated_at = NOW()
  RETURNING balance_ghs INTO v_balance;

  INSERT INTO transactions (user_id, type, amount_ghs, product, reference, status)
  VALUES (p_user_id, 'credit', p_amount, p_product, p_reference, 'success');

  RETURN v_balance;
END;
$$;

-- Adds to the balance without writing a transaction row. Used when the
-- transaction row already exists (e.g. a Paystack top-up marked successful).
CREATE OR REPLACE FUNCTION increment_wallet_balance(
  p_user_id UUID,
  p_amount NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('wallet:' || p_user_id::text));

  INSERT INTO wallets (user_id, balance_ghs) VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance_ghs = wallets.balance_ghs + EXCLUDED.balance_ghs, updated_at = NOW()
  RETURNING balance_ghs INTO v_balance;

  RETURN v_balance;
END;
$$;

-- Only the backend (service role) may move money.
REVOKE ALL ON FUNCTION debit_wallet(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION credit_wallet(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION increment_wallet_balance(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION debit_wallet(UUID, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION credit_wallet(UUID, NUMERIC, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION increment_wallet_balance(UUID, NUMERIC) TO service_role;

-- ── Admin MFA columns (the admin controller expects these) ──────────────
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT true;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS otp_hash TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS otp_expires TIMESTAMPTZ;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS refresh_token TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'admin';
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
-- Admin MFA codes are delivered by SMS to this number (233XXXXXXXXX or +233…).
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS phone TEXT;

-- ── Canonical phone numbers: +233XXXXXXXXX ───────────────────────────────
-- Matches normalizePhone() in the backend so 0244…, 233244… and +233244…
-- all resolve to the same account. Skips any row that would collide.
UPDATE users u
   SET phone = '+233' || right(regexp_replace(u.phone, '\D', '', 'g'), 9)
 WHERE regexp_replace(u.phone, '\D', '', 'g') ~ '^(0|233)?[25][0-9]{8}$'
   AND u.phone <> '+233' || right(regexp_replace(u.phone, '\D', '', 'g'), 9)
   AND NOT EXISTS (
     SELECT 1 FROM users o
      WHERE o.id <> u.id
        AND o.phone = '+233' || right(regexp_replace(u.phone, '\D', '', 'g'), 9)
   );
