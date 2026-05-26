-- User feedback / correction system
-- Idempotent: uses IF NOT EXISTS where possible

-- Keep existing user_feedback table for backward compatibility
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'wrong_brand', 'wrong_amount', 'wrong_cycle', 'wrong_status',
    'not_subscription', 'missing_subscription'
  )),
  correct_brand TEXT,
  correct_amount NUMERIC,
  correct_cycle TEXT,
  correct_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_subscription_id ON user_feedback(subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(feedback_type);

-- User corrections on subscriptions (new structured correction loop)
CREATE TABLE IF NOT EXISTS user_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  corrected_brand text,
  corrected_amount numeric,
  corrected_currency text,
  corrected_cycle text,
  corrected_category text,
  corrected_status text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Low-confidence predictions flagged for review
CREATE TABLE IF NOT EXISTS review_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  reason text NOT NULL, -- e.g. "low_confidence", "user_flagged"
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, subscription_id)
);

CREATE INDEX IF NOT EXISTS idx_user_corrections_user ON user_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_corrections_subscription ON user_corrections(subscription_id);
CREATE INDEX IF NOT EXISTS idx_review_queue_user ON review_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_review_queue_resolved ON review_queue(resolved);

-- Row Level Security
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- user_feedback policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'user_feedback'
      AND policyname  = 'user_feedback_select_own'
  ) THEN
    CREATE POLICY user_feedback_select_own
      ON user_feedback
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'user_feedback'
      AND policyname  = 'user_feedback_insert_own'
  ) THEN
    CREATE POLICY user_feedback_insert_own
      ON user_feedback
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  -- user_corrections policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'user_corrections'
      AND policyname  = 'user_corrections_select_own'
  ) THEN
    CREATE POLICY user_corrections_select_own
      ON user_corrections
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'user_corrections'
      AND policyname  = 'user_corrections_insert_own'
  ) THEN
    CREATE POLICY user_corrections_insert_own
      ON user_corrections
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  -- review_queue policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'review_queue'
      AND policyname  = 'review_queue_select_own'
  ) THEN
    CREATE POLICY review_queue_select_own
      ON review_queue
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'review_queue'
      AND policyname  = 'review_queue_insert_own'
  ) THEN
    CREATE POLICY review_queue_insert_own
      ON review_queue
      FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename   = 'review_queue'
      AND policyname  = 'review_queue_update_own'
  ) THEN
    CREATE POLICY review_queue_update_own
      ON review_queue
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END
$$;

-- Aggregated feedback view per user
CREATE OR REPLACE VIEW user_feedback_summary AS
SELECT
  user_id,
  feedback_type,
  COUNT(*) AS feedback_count
FROM user_feedback
GROUP BY user_id, feedback_type;
