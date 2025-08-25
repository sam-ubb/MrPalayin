-- 0001_initial.sql
-- Contiene el estado actual del esquema para iniciar sistema de migraciones.
-- Futuras modificaciones deberán añadirse como nuevos archivos incrementalmente.

BEGIN;
-- (Este archivo replica schema.sql actual para baseline)
-- Usuarios y XP
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  xp BIGINT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 0,
  last_message_time TIMESTAMPTZ,
  PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS guilds (
  guild_id TEXT PRIMARY KEY,
  welcome_channel TEXT,
  welcome_message TEXT,
  level_roles JSONB DEFAULT '[]'::jsonb,
  levelup_message TEXT DEFAULT '🎉 {user} subió a nivel {level}!'
);

CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  message TEXT NOT NULL,
  remind_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS reminders_due_idx ON reminders (sent, remind_time);

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  focus_minutes INT NOT NULL,
  break_minutes INT NOT NULL,
  cycles INT NOT NULL DEFAULT 1,
  current_cycle INT NOT NULL DEFAULT 1,
  phase TEXT NOT NULL DEFAULT 'focus',
  phase_end TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  tag TEXT
);
CREATE INDEX IF NOT EXISTS pomodoro_active_idx ON pomodoro_sessions (guild_id, user_id, phase) WHERE finished_at IS NULL;

CREATE TABLE IF NOT EXISTS pomodoro_group_sessions (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  focus_minutes INT NOT NULL,
  break_minutes INT NOT NULL,
  cycles INT NOT NULL DEFAULT 1,
  current_cycle INT NOT NULL DEFAULT 1,
  phase TEXT NOT NULL DEFAULT 'focus',
  phase_end TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  tag TEXT
);
CREATE INDEX IF NOT EXISTS pomodoro_group_active_idx ON pomodoro_group_sessions (guild_id, channel_id, phase) WHERE finished_at IS NULL;

CREATE TABLE IF NOT EXISTS pomodoro_group_participants (
  session_id INT REFERENCES pomodoro_group_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS pomodoro_stats (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  focus_minutes_total BIGINT NOT NULL DEFAULT 0,
  sessions_completed INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS xp_channel_modifiers (
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.00,
  PRIMARY KEY (guild_id, channel_id)
);

CREATE TABLE IF NOT EXISTS missions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  type TEXT NOT NULL,
  target INT NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS missions_idx ON missions (user_id, guild_id, scope, expires_at);

CREATE TABLE IF NOT EXISTS user_activity (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  last_active_date DATE NOT NULL,
  streak_count INT NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, guild_id, badge_id)
);

CREATE TABLE IF NOT EXISTS pomodoro_focus_log (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  minutes INT NOT NULL,
  tag TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pomodoro_focus_log_idx ON pomodoro_focus_log (guild_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS pomodoro_tag_stats (
  guild_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  focus_minutes_total BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, tag)
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  description TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS tasks_user_idx ON tasks (user_id, guild_id, completed);

CREATE TABLE IF NOT EXISTS moderation_logs (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS moderation_logs_idx ON moderation_logs (guild_id, user_id);

CREATE TABLE IF NOT EXISTS warns (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS warns_idx ON warns (guild_id, user_id);

CREATE TABLE IF NOT EXISTS mutes (
  id SERIAL PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  reason TEXT,
  until TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mutes_active_idx ON mutes (guild_id, active, until);
COMMIT;
