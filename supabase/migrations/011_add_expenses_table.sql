-- ============================================================================
-- Migration: Add Expenses Table
-- Date: 2025-10-11
-- Purpose: Implement expense tracking persistence (currently data loss)
-- Severity: HIGH - Users think expenses are saved but they're lost
-- ============================================================================
--
-- PROBLEM IDENTIFIED:
-- - lib/claude-tools.ts executeTrackExpense() only logs to console
-- - No 'expenses' table exists in database
-- - AI responds "✅ Listo! Registré tu gasto..." but data is lost
-- - Users have no way to query their expense history
--
-- SOLUTION:
-- - Create expenses table with proper schema
-- - Add RLS policies (service role bypass + user SELECT)
-- - Add indexes for common queries (by user, by date, by category)
-- - Support for multiple currencies (COP, USD, MXN)
--
-- ============================================================================

-- ========================================
-- PHASE 1: Create Expenses Table
-- ========================================

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'COP',
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT chk_currency CHECK (currency IN ('COP', 'USD', 'MXN', 'EUR')),
  CONSTRAINT chk_category CHECK (category IN (
    'Alimentación',
    'Transporte',
    'Entretenimiento',
    'Salud',
    'Servicios',
    'Compras',
    'Educación',
    'Hogar',
    'Otros'
  ))
);

-- ========================================
-- PHASE 2: Indexes for Performance
-- ========================================

-- Primary user lookup (most common query: all expenses for user)
CREATE INDEX IF NOT EXISTS idx_expenses_user
  ON public.expenses USING btree (user_id);

-- Date-based queries (monthly/weekly summaries)
CREATE INDEX IF NOT EXISTS idx_expenses_date
  ON public.expenses USING btree (expense_date DESC);

-- User + Date composite (user's expenses in date range)
CREATE INDEX IF NOT EXISTS idx_expenses_user_date
  ON public.expenses USING btree (user_id, expense_date DESC);

-- Category analysis (spending by category)
CREATE INDEX IF NOT EXISTS idx_expenses_category
  ON public.expenses USING btree (category);

-- User + Category (user's spending per category)
CREATE INDEX IF NOT EXISTS idx_expenses_user_category
  ON public.expenses USING btree (user_id, category);

-- ========================================
-- PHASE 3: RLS Policies
-- ========================================

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Service role bypass: Backend can manage all expenses
CREATE POLICY "service_role_expenses_all" ON public.expenses
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can SELECT their own expenses (for future expense reports)
CREATE POLICY "users_select_own_expenses" ON public.expenses
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- ========================================
-- PHASE 4: Triggers
-- ========================================

-- Auto-update updated_at timestamp
DROP TRIGGER IF EXISTS t_expenses_updated ON public.expenses;
CREATE TRIGGER t_expenses_updated
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ========================================
-- PHASE 5: Useful Views for Analytics
-- ========================================

-- Monthly spending summary per user
CREATE OR REPLACE VIEW monthly_expenses_summary AS
SELECT
  user_id,
  DATE_TRUNC('month', expense_date) AS month,
  currency,
  SUM(amount) AS total_spent,
  COUNT(*) AS expense_count,
  AVG(amount) AS avg_expense
FROM public.expenses
GROUP BY user_id, DATE_TRUNC('month', expense_date), currency
ORDER BY user_id, month DESC;

-- Category breakdown per user
CREATE OR REPLACE VIEW category_expenses_summary AS
SELECT
  user_id,
  category,
  currency,
  SUM(amount) AS total_spent,
  COUNT(*) AS expense_count,
  AVG(amount) AS avg_expense,
  MAX(expense_date) AS last_expense_date
FROM public.expenses
GROUP BY user_id, category, currency
ORDER BY user_id, total_spent DESC;

-- ========================================
-- DOCUMENTATION
-- ========================================

COMMENT ON TABLE public.expenses IS
  'User expense tracking. Persists financial transactions reported via WhatsApp AI assistant.';

COMMENT ON COLUMN public.expenses.amount IS
  'Expense amount in the specified currency. Stored as DECIMAL(12,2) to support amounts up to 999,999,999.99';

COMMENT ON COLUMN public.expenses.currency IS
  'Currency code (ISO 4217). Defaults to COP (Colombian Peso). Supports USD, MXN, EUR.';

COMMENT ON COLUMN public.expenses.category IS
  'Expense category for budget tracking. Validated against predefined list.';

COMMENT ON COLUMN public.expenses.expense_date IS
  'Date when expense occurred (not when it was recorded). Defaults to today.';

COMMENT ON POLICY "service_role_expenses_all" ON public.expenses IS
  'Service role bypass: Backend AI can create/update expenses when users report them via WhatsApp.';

COMMENT ON POLICY "users_select_own_expenses" ON public.expenses IS
  'Users can query their own expense history for reports/analysis (future feature).';

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Verify table created:
-- SELECT table_name, table_type FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'expenses';

-- Verify indexes:
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE tablename = 'expenses' ORDER BY indexname;

-- Verify RLS policies:
-- SELECT policyname, cmd, roles FROM pg_policies
-- WHERE tablename = 'expenses' ORDER BY policyname;

-- Test insert (replace user_id with actual UUID):
-- INSERT INTO public.expenses (user_id, amount, currency, category, description)
-- VALUES ('00000000-0000-0000-0000-000000000000', 50000, 'COP', 'Alimentación', 'Compras del supermercado')
-- RETURNING *;

-- ============================================================================
-- INTEGRATION NOTES
-- ============================================================================
--
-- After applying this migration:
--
-- 1. Update lib/claude-tools.ts executeTrackExpense():
--    - Replace console.log with Supabase insert
--    - Use getSupabaseServerClient() to insert expense
--    - Handle errors and return proper confirmation
--
-- 2. Regenerate TypeScript types:
--    npx supabase gen types typescript --project-id pdliixrgdvunoymxaxmw > lib/database.types.ts
--
-- 3. Test expense tracking flow:
--    - Send WhatsApp message: "gasté $50 en el almuerzo"
--    - Verify record in Supabase Dashboard
--    - Query: SELECT * FROM expenses ORDER BY created_at DESC LIMIT 10;
--
-- 4. Future enhancements:
--    - Monthly expense reports via WhatsApp
--    - Budget alerts when spending exceeds limits
--    - Category-based spending insights
--    - Export to CSV/PDF
--
-- ============================================================================
