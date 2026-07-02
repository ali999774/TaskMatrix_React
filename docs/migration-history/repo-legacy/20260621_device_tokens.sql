-- device_tokens: store APNs push notification tokens per user
CREATE TABLE IF NOT EXISTS device_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'ios' CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Index for looking up tokens by user
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_platform ON device_tokens(user_id, platform);

-- Enable RLS
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "Users can manage own tokens" ON device_tokens
  FOR ALL USING (auth.uid() = user_id);
