-- 0002_locale_currency.sql
BEGIN;
ALTER TABLE guilds ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'es';
ALTER TABLE users ADD COLUMN IF NOT EXISTS coins BIGINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_claim TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS users_coins_idx ON users (guild_id, coins DESC);
ALTER TABLE pomodoro_sessions ADD COLUMN IF NOT EXISTS long_break_minutes INT;
ALTER TABLE pomodoro_sessions ADD COLUMN IF NOT EXISTS cycle_before_long_break INT;
ALTER TABLE pomodoro_group_sessions ADD COLUMN IF NOT EXISTS long_break_minutes INT;
ALTER TABLE pomodoro_group_sessions ADD COLUMN IF NOT EXISTS cycle_before_long_break INT;
CREATE TABLE IF NOT EXISTS badge_meta (
  id TEXT PRIMARY KEY,
  name_es TEXT NOT NULL,
  name_en TEXT NOT NULL,
  criteria TEXT
);
-- seed básico
INSERT INTO badge_meta (id,name_es,name_en,criteria) VALUES
  ('streak_3','🔥 Racha 3 días','🔥 3-day streak','Logra 3 días seguidos activo')
ON CONFLICT DO NOTHING;
COMMIT;
