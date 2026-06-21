-- Seed test accounts for a user
-- Replace YOUR_USER_ID with your actual user UUID from auth.users
-- Find your user ID: SELECT id FROM auth.users WHERE email = 'your@email.com';

DO $$
DECLARE
  uid uuid := 'YOUR_USER_ID';  -- ← replace this
BEGIN

INSERT INTO public.accounts (user_id, name, kind, type, institution, current_balance, currency, is_active)
VALUES
  (uid, 'Chase Checking',       'asset',      'checking',     'Chase Bank',          4821.50,   'USD', true),
  (uid, 'Chase Savings',        'asset',      'savings',      'Chase Bank',         12340.00,   'USD', true),
  (uid, 'Fidelity Brokerage',   'investment', 'investment',   'Fidelity',           28750.00,   'USD', true),
  (uid, 'Chase Sapphire Card',  'liability',  'credit_card',  'Chase Bank',         -1284.33,   'USD', true),
  (uid, 'Student Loan',         'liability',  'loan',         'Sallie Mae',        -18500.00,   'USD', true)
ON CONFLICT DO NOTHING;

END $$;
