import pg from 'pg';
import { logger } from '../utils/logger.js';
const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL no definido en el entorno');
  process.exit(1);
}

export const pool = new Pool({ connectionString, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });

export async function runMigrations() {
  // Ejecutar archivos .sql en migrations en orden alfabético
  const fs = await import('fs');
  const path = await import('path');
  const dir = path.resolve(process.cwd(), 'src/database/migrations');
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await pool.query(sql);
  }
}

export async function initSchema() {
  const fs = await import('fs');
  const path = await import('path');
  const schemaPath = path.resolve(process.cwd(), 'src/database/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  logger.info('Esquema de base de datos verificado');
}

export async function getUser(guildId, userId) {
  const { rows } = await pool.query('SELECT * FROM users WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rows[0];
}

export async function upsertUserXP(guildId, userId, xpDelta, level, nowIso) {
  await pool.query(`INSERT INTO users (guild_id, user_id, xp, level, last_message_time) VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (user_id,guild_id) DO UPDATE SET xp = users.xp + EXCLUDED.xp, level = $4, last_message_time=$5`, [guildId, userId, xpDelta, level, nowIso]);
}

export async function setGuildConfig(guildId, data) {
  const { welcome_channel, welcome_message, level_roles } = data;
  await pool.query(`INSERT INTO guilds (guild_id, welcome_channel, welcome_message, level_roles)
    VALUES ($1,$2,$3,$4)
    ON CONFLICT (guild_id) DO UPDATE SET welcome_channel=EXCLUDED.welcome_channel, welcome_message=EXCLUDED.welcome_message, level_roles=EXCLUDED.level_roles`, [guildId, welcome_channel, welcome_message, JSON.stringify(level_roles||[])]);
}

export async function updateGuildField(guildId, field, value) {
  const allowed = ['welcome_channel','welcome_message','level_roles'];
  if (!allowed.includes(field)) throw new Error('Campo no permitido');
  await pool.query(`UPDATE guilds SET ${field}=$1 WHERE guild_id=$2`, [value, guildId]);
}

export async function getGuildConfig(guildId) {
  const { rows } = await pool.query('SELECT * FROM guilds WHERE guild_id=$1', [guildId]);
  return rows[0];
}

export async function createReminder(userId, guildId, message, remindTime) {
  const { rows } = await pool.query('INSERT INTO reminders (user_id,guild_id,message,remind_time) VALUES ($1,$2,$3,$4) RETURNING *', [userId, guildId, message, remindTime]);
  return rows[0];
}

export async function fetchDueReminders() {
  const { rows } = await pool.query('SELECT * FROM reminders WHERE sent=false AND remind_time <= NOW() ORDER BY remind_time ASC LIMIT 20');
  return rows;
}

export async function markReminderSent(id) {
  await pool.query('UPDATE reminders SET sent=true WHERE id=$1', [id]);
}

export async function getLeaderboard(guildId, offset = 0, limit = 10) {
  const { rows } = await pool.query('SELECT user_id, xp, level FROM users WHERE guild_id=$1 ORDER BY xp DESC OFFSET $2 LIMIT $3', [guildId, offset, limit]);
  const { rows: totalRows } = await pool.query('SELECT COUNT(*)::int AS total FROM users WHERE guild_id=$1', [guildId]);
  return { rows, total: totalRows[0].total };
}

// ------- Pomodoro Individual --------
export async function startPomodoroSession(userId, guildId, focusMinutes, breakMinutes, cycles) {
  const { rows } = await pool.query(`INSERT INTO pomodoro_sessions (user_id,guild_id,focus_minutes,break_minutes,cycles,phase_end)
    VALUES ($1,$2,$3,$4,$5, NOW() + ($3 || ' minutes')::interval) RETURNING *`, [userId, guildId, focusMinutes, breakMinutes, cycles]);
  return rows[0];
}

export async function getActivePomodoro(userId, guildId) {
  const { rows } = await pool.query('SELECT * FROM pomodoro_sessions WHERE user_id=$1 AND guild_id=$2 AND finished_at IS NULL ORDER BY id DESC LIMIT 1', [userId, guildId]);
  return rows[0];
}

export async function updatePomodoroPhase(id, phase, minutes) {
  await pool.query("UPDATE pomodoro_sessions SET phase=$1, phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$3", [phase, String(minutes), id]);
}

export async function advancePomodoroCycle(id, focusMinutes) {
  await pool.query("UPDATE pomodoro_sessions SET current_cycle=current_cycle+1, phase='focus', phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$1", [id, String(focusMinutes)]);
}

export async function finishPomodoro(id) {
  await pool.query("UPDATE pomodoro_sessions SET phase='finished', finished_at=NOW() WHERE id=$1", [id]);
}

export async function addPomodoroStats(userId, guildId, focusMinutes) {
  await pool.query(`INSERT INTO pomodoro_stats (user_id,guild_id,focus_minutes_total,sessions_completed)
    VALUES ($1,$2,$3,1)
    ON CONFLICT (user_id,guild_id) DO UPDATE SET focus_minutes_total = pomodoro_stats.focus_minutes_total + EXCLUDED.focus_minutes_total, sessions_completed = pomodoro_stats.sessions_completed + 1`, [userId, guildId, focusMinutes]);
}

export async function topPomodoroStats(guildId, limit=10) {
  const { rows } = await pool.query('SELECT user_id, focus_minutes_total, sessions_completed FROM pomodoro_stats WHERE guild_id=$1 ORDER BY focus_minutes_total DESC LIMIT $2', [guildId, limit]);
  return rows;
}

export async function fetchDuePomodoroSessions() {
  const { rows } = await pool.query("SELECT * FROM pomodoro_sessions WHERE finished_at IS NULL AND phase_end <= NOW() ORDER BY id ASC LIMIT 25");
  return rows;
}

// ------- Pomodoro Grupal --------
export async function startGroupPomodoro(guildId, channelId, creatorId, focusMinutes, breakMinutes, cycles) {
  const { rows } = await pool.query(`INSERT INTO pomodoro_group_sessions (guild_id,channel_id,creator_id,focus_minutes,break_minutes,cycles,phase_end)
    VALUES ($1,$2,$3,$4,$5,$6, NOW() + ($4 || ' minutes')::interval) RETURNING *`, [guildId, channelId, creatorId, focusMinutes, breakMinutes, cycles]);
  // creador se añade como participante
  await pool.query('INSERT INTO pomodoro_group_participants (session_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rows[0].id, creatorId]);
  return rows[0];
}

export async function getActiveGroupPomodoro(guildId, channelId) {
  const { rows } = await pool.query('SELECT * FROM pomodoro_group_sessions WHERE guild_id=$1 AND channel_id=$2 AND finished_at IS NULL ORDER BY id DESC LIMIT 1', [guildId, channelId]);
  return rows[0];
}

export async function addGroupParticipant(sessionId, userId) {
  await pool.query('INSERT INTO pomodoro_group_participants (session_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [sessionId, userId]);
}

export async function removeGroupParticipant(sessionId, userId) {
  await pool.query('DELETE FROM pomodoro_group_participants WHERE session_id=$1 AND user_id=$2', [sessionId, userId]);
}

export async function getGroupParticipants(sessionId) {
  const { rows } = await pool.query('SELECT user_id FROM pomodoro_group_participants WHERE session_id=$1', [sessionId]);
  return rows.map(r=>r.user_id);
}

export async function updateGroupPomodoroPhase(id, phase, minutes) {
  await pool.query("UPDATE pomodoro_group_sessions SET phase=$1, phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$3", [phase, String(minutes), id]);
}

export async function advanceGroupPomodoroCycle(id, focusMinutes) {
  await pool.query("UPDATE pomodoro_group_sessions SET current_cycle=current_cycle+1, phase='focus', phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$1", [id, String(focusMinutes)]);
}

export async function finishGroupPomodoro(id) {
  await pool.query("UPDATE pomodoro_group_sessions SET phase='finished', finished_at=NOW() WHERE id=$1", [id]);
}

export async function fetchDueGroupPomodoroSessions() {
  const { rows } = await pool.query("SELECT * FROM pomodoro_group_sessions WHERE finished_at IS NULL AND phase_end <= NOW() ORDER BY id ASC LIMIT 25");
  return rows;
}

export async function setXPChannelModifier(guildId, channelId, multiplier) {
  await pool.query(`INSERT INTO xp_channel_modifiers (guild_id, channel_id, multiplier) VALUES ($1,$2,$3)
    ON CONFLICT (guild_id, channel_id) DO UPDATE SET multiplier=EXCLUDED.multiplier`, [guildId, channelId, multiplier]);
}

export async function getXPChannelMultiplier(guildId, channelId) {
  const { rows } = await pool.query('SELECT multiplier FROM xp_channel_modifiers WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
  return rows[0]?.multiplier || 1;
}

export async function deleteXPChannelModifier(guildId, channelId) {
  await pool.query('DELETE FROM xp_channel_modifiers WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
}

export async function listXPModifiers(guildId) {
  const { rows } = await pool.query('SELECT channel_id, multiplier FROM xp_channel_modifiers WHERE guild_id=$1 ORDER BY channel_id', [guildId]);
  return rows;
}

export async function setLevelUpMessage(guildId, template) {
  await pool.query(`UPDATE guilds SET levelup_message=$1 WHERE guild_id=$2`, [template, guildId]);
}

// ------- Misiones --------
export async function getOrCreateDailyMissions(userId, guildId) {
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  const { rows } = await pool.query("SELECT * FROM missions WHERE user_id=$1 AND guild_id=$2 AND scope='daily' AND expires_at >= NOW()", [userId, guildId]);
  if (rows.length) return rows;
  // crear misiones base
  const templates = [
    { type: 'messages', target: 20 },
    { type: 'focus_minutes', target: 50 }
  ];
  const inserted = [];
  for (const t of templates) {
    const { rows: r2 } = await pool.query("INSERT INTO missions (user_id,guild_id,scope,type,target,expires_at) VALUES ($1,$2,'daily',$3,$4,$5) RETURNING *", [userId, guildId, t.type, t.target, todayEnd.toISOString()]);
    inserted.push(r2[0]);
  }
  return inserted;
}

export async function incrementMission(userId, guildId, type, amount) {
  await pool.query("UPDATE missions SET progress = LEAST(target, progress + $4), completed = (progress + $4) >= target WHERE user_id=$1 AND guild_id=$2 AND type=$3 AND scope='daily' AND expires_at >= NOW()", [userId, guildId, type, amount]);
}

// ------- Actividad --------
export async function updateUserActivity(userId, guildId) {
  await pool.query(`INSERT INTO user_activity (user_id,guild_id,last_active_date,streak_count)
    VALUES ($1,$2,CURRENT_DATE,1)
    ON CONFLICT (user_id,guild_id) DO UPDATE SET streak_count = CASE
      WHEN user_activity.last_active_date = CURRENT_DATE THEN user_activity.streak_count
      WHEN user_activity.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN user_activity.streak_count + 1
      ELSE 1 END, last_active_date = CURRENT_DATE`, [userId, guildId]);
}

export async function getUserStreak(userId, guildId) {
  const { rows } = await pool.query('SELECT streak_count FROM user_activity WHERE user_id=$1 AND guild_id=$2', [userId, guildId]);
  return rows[0]?.streak_count || 0;
}

// ------- Badges --------
export async function grantBadge(userId, guildId, badgeId) {
  await pool.query('INSERT INTO user_badges (user_id,guild_id, badge_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, guildId, badgeId]);
}

export async function listBadges(userId, guildId) {
  const { rows } = await pool.query('SELECT badge_id, earned_at FROM user_badges WHERE user_id=$1 AND guild_id=$2 ORDER BY earned_at ASC', [userId, guildId]);
  return rows;
}

// ------- Logging --------
export async function logFocusBlock(userId, guildId, minutes, tag) {
  await pool.query('INSERT INTO pomodoro_focus_log (user_id,guild_id,minutes,tag) VALUES ($1,$2,$3,$4)', [userId, guildId, minutes, tag || null]);
  if (tag) {
    await pool.query(`INSERT INTO pomodoro_tag_stats (guild_id, tag, focus_minutes_total) VALUES ($1,$2,$3)
      ON CONFLICT (guild_id, tag) DO UPDATE SET focus_minutes_total = pomodoro_tag_stats.focus_minutes_total + EXCLUDED.focus_minutes_total`, [guildId, tag, minutes]);
  }
}

export async function topTagStats(guildId, limit=10) {
  const { rows } = await pool.query('SELECT tag, focus_minutes_total FROM pomodoro_tag_stats WHERE guild_id=$1 ORDER BY focus_minutes_total DESC LIMIT $2', [guildId, limit]);
  return rows;
}

// Tasks CRUD
export async function addTask(userId, guildId, description) {
  const { rows } = await pool.query('INSERT INTO tasks (user_id,guild_id,description) VALUES ($1,$2,$3) RETURNING *', [userId, guildId, description]);
  return rows[0];
}
export async function listTasks(userId, guildId, includeCompleted=false) {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE user_id=$1 AND guild_id=$2 AND ($3 OR completed=false) ORDER BY id DESC LIMIT 50', [userId, guildId, includeCompleted]);
  return rows;
}
export async function completeTask(userId, guildId, id) {
  const { rowCount } = await pool.query("UPDATE tasks SET completed=true, completed_at=NOW() WHERE id=$1 AND user_id=$2 AND guild_id=$3 AND completed=false", [id, userId, guildId]);
  return rowCount > 0;
}
export async function deleteTask(userId, guildId, id) {
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id=$1 AND user_id=$2 AND guild_id=$3', [id, userId, guildId]);
  return rowCount > 0;
}

// ------- Moderación --------
export async function logModeration(guildId, userId, moderatorId, action, reason) {
  await pool.query('INSERT INTO moderation_logs (guild_id,user_id,moderator_id,action,reason) VALUES ($1,$2,$3,$4,$5)', [guildId, userId, moderatorId, action, reason || null]);
}

export async function addWarn(guildId, userId, moderatorId, reason) {
  const { rows } = await pool.query('INSERT INTO warns (guild_id,user_id,moderator_id,reason) VALUES ($1,$2,$3,$4) RETURNING *', [guildId, userId, moderatorId, reason || null]);
  return rows[0];
}
export async function listWarns(guildId, userId) {
  const { rows } = await pool.query('SELECT id, reason, created_at FROM warns WHERE guild_id=$1 AND user_id=$2 ORDER BY id DESC LIMIT 20', [guildId, userId]);
  return rows;
}

export async function addMute(guildId, userId, moderatorId, reason, until) {
  const { rows } = await pool.query('INSERT INTO mutes (guild_id,user_id,moderator_id,reason,until) VALUES ($1,$2,$3,$4,$5) RETURNING *', [guildId, userId, moderatorId, reason || null, until]);
  return rows[0];
}
export async function listActiveMutes() {
  const { rows } = await pool.query("SELECT * FROM mutes WHERE active=true AND until <= NOW() ORDER BY until ASC LIMIT 50");
  return rows;
}
export async function deactivateMute(id) {
  await pool.query('UPDATE mutes SET active=false WHERE id=$1', [id]);
}

// ------- Locale --------
export async function setGuildLocale(guildId, locale) {
  await pool.query('UPDATE guilds SET locale=$1 WHERE guild_id=$2', [locale, guildId]);
}
export async function getGuildLocale(guildId) {
  const { rows } = await pool.query('SELECT locale FROM guilds WHERE guild_id=$1', [guildId]);
  return rows[0]?.locale || 'es';
}

// ------- Economía --------
export async function addCoins(guildId, userId, amount) {
  await pool.query(`INSERT INTO users (guild_id,user_id,xp,level,coins) VALUES ($1,$2,0,0,$3)
    ON CONFLICT (user_id,guild_id) DO UPDATE SET coins = users.coins + EXCLUDED.coins`, [guildId, userId, amount]);
}
export async function getUserCoins(guildId, userId) {
  const { rows } = await pool.query('SELECT coins FROM users WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rows[0]?.coins || 0;
}
export async function transferCoins(guildId, fromId, toId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const balRes = await client.query('SELECT coins FROM users WHERE guild_id=$1 AND user_id=$2 FOR UPDATE', [guildId, fromId]);
    const bal = balRes.rows[0]?.coins || 0;
    if (bal < amount) { await client.query('ROLLBACK'); return false; }
    await client.query(`UPDATE users SET coins = coins - $3 WHERE guild_id=$1 AND user_id=$2`, [guildId, fromId, amount]);
    await client.query(`INSERT INTO users (guild_id,user_id,xp,level,coins) VALUES ($1,$2,0,0,$3)
      ON CONFLICT (user_id,guild_id) DO UPDATE SET coins = users.coins + EXCLUDED.coins`, [guildId, toId, amount]);
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}
export async function claimDaily(guildId, userId, amount) {
  const { rows } = await pool.query(`UPDATE users SET coins = coins + $3, last_daily_claim=NOW() WHERE guild_id=$1 AND user_id=$2 AND (last_daily_claim IS NULL OR last_daily_claim < NOW() - interval '23 hours') RETURNING coins`, [guildId, userId, amount]);
  return rows[0];
}
export async function leaderboardCoins(guildId, limit=10, offset=0) {
  const { rows } = await pool.query('SELECT user_id, coins FROM users WHERE guild_id=$1 ORDER BY coins DESC OFFSET $2 LIMIT $3', [guildId, offset, limit]);
  return rows;
}

// ------- Pomodoro Individual --------
export async function startPomodoroSession(userId, guildId, focusMinutes, breakMinutes, cycles) {
  const { rows } = await pool.query(`INSERT INTO pomodoro_sessions (user_id,guild_id,focus_minutes,break_minutes,cycles,phase_end)
    VALUES ($1,$2,$3,$4,$5, NOW() + ($3 || ' minutes')::interval) RETURNING *`, [userId, guildId, focusMinutes, breakMinutes, cycles]);
  return rows[0];
}

export async function getActivePomodoro(userId, guildId) {
  const { rows } = await pool.query('SELECT * FROM pomodoro_sessions WHERE user_id=$1 AND guild_id=$2 AND finished_at IS NULL ORDER BY id DESC LIMIT 1', [userId, guildId]);
  return rows[0];
}

export async function updatePomodoroPhase(id, phase, minutes) {
  await pool.query("UPDATE pomodoro_sessions SET phase=$1, phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$3", [phase, String(minutes), id]);
}

export async function advancePomodoroCycle(id, focusMinutes) {
  await pool.query("UPDATE pomodoro_sessions SET current_cycle=current_cycle+1, phase='focus', phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$1", [id, String(focusMinutes)]);
}

export async function finishPomodoro(id) {
  await pool.query("UPDATE pomodoro_sessions SET phase='finished', finished_at=NOW() WHERE id=$1", [id]);
}

export async function addPomodoroStats(userId, guildId, focusMinutes) {
  await pool.query(`INSERT INTO pomodoro_stats (user_id,guild_id,focus_minutes_total,sessions_completed)
    VALUES ($1,$2,$3,1)
    ON CONFLICT (user_id,guild_id) DO UPDATE SET focus_minutes_total = pomodoro_stats.focus_minutes_total + EXCLUDED.focus_minutes_total, sessions_completed = pomodoro_stats.sessions_completed + 1`, [userId, guildId, focusMinutes]);
}

export async function topPomodoroStats(guildId, limit=10) {
  const { rows } = await pool.query('SELECT user_id, focus_minutes_total, sessions_completed FROM pomodoro_stats WHERE guild_id=$1 ORDER BY focus_minutes_total DESC LIMIT $2', [guildId, limit]);
  return rows;
}

export async function fetchDuePomodoroSessions() {
  const { rows } = await pool.query("SELECT * FROM pomodoro_sessions WHERE finished_at IS NULL AND phase_end <= NOW() ORDER BY id ASC LIMIT 25");
  return rows;
}

// ------- Pomodoro Grupal --------
export async function startGroupPomodoro(guildId, channelId, creatorId, focusMinutes, breakMinutes, cycles) {
  const { rows } = await pool.query(`INSERT INTO pomodoro_group_sessions (guild_id,channel_id,creator_id,focus_minutes,break_minutes,cycles,phase_end)
    VALUES ($1,$2,$3,$4,$5,$6, NOW() + ($4 || ' minutes')::interval) RETURNING *`, [guildId, channelId, creatorId, focusMinutes, breakMinutes, cycles]);
  // creador se añade como participante
  await pool.query('INSERT INTO pomodoro_group_participants (session_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rows[0].id, creatorId]);
  return rows[0];
}

export async function getActiveGroupPomodoro(guildId, channelId) {
  const { rows } = await pool.query('SELECT * FROM pomodoro_group_sessions WHERE guild_id=$1 AND channel_id=$2 AND finished_at IS NULL ORDER BY id DESC LIMIT 1', [guildId, channelId]);
  return rows[0];
}

export async function addGroupParticipant(sessionId, userId) {
  await pool.query('INSERT INTO pomodoro_group_participants (session_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [sessionId, userId]);
}

export async function removeGroupParticipant(sessionId, userId) {
  await pool.query('DELETE FROM pomodoro_group_participants WHERE session_id=$1 AND user_id=$2', [sessionId, userId]);
}

export async function getGroupParticipants(sessionId) {
  const { rows } = await pool.query('SELECT user_id FROM pomodoro_group_participants WHERE session_id=$1', [sessionId]);
  return rows.map(r=>r.user_id);
}

export async function updateGroupPomodoroPhase(id, phase, minutes) {
  await pool.query("UPDATE pomodoro_group_sessions SET phase=$1, phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$3", [phase, String(minutes), id]);
}

export async function advanceGroupPomodoroCycle(id, focusMinutes) {
  await pool.query("UPDATE pomodoro_group_sessions SET current_cycle=current_cycle+1, phase='focus', phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$1", [id, String(focusMinutes)]);
}

export async function finishGroupPomodoro(id) {
  await pool.query("UPDATE pomodoro_group_sessions SET phase='finished', finished_at=NOW() WHERE id=$1", [id]);
}

export async function fetchDueGroupPomodoroSessions() {
  const { rows } = await pool.query("SELECT * FROM pomodoro_group_sessions WHERE finished_at IS NULL AND phase_end <= NOW() ORDER BY id ASC LIMIT 25");
  return rows;
}

export async function setXPChannelModifier(guildId, channelId, multiplier) {
  await pool.query(`INSERT INTO xp_channel_modifiers (guild_id, channel_id, multiplier) VALUES ($1,$2,$3)
    ON CONFLICT (guild_id, channel_id) DO UPDATE SET multiplier=EXCLUDED.multiplier`, [guildId, channelId, multiplier]);
}

export async function getXPChannelMultiplier(guildId, channelId) {
  const { rows } = await pool.query('SELECT multiplier FROM xp_channel_modifiers WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
  return rows[0]?.multiplier || 1;
}

export async function deleteXPChannelModifier(guildId, channelId) {
  await pool.query('DELETE FROM xp_channel_modifiers WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
}

export async function listXPModifiers(guildId) {
  const { rows } = await pool.query('SELECT channel_id, multiplier FROM xp_channel_modifiers WHERE guild_id=$1 ORDER BY channel_id', [guildId]);
  return rows;
}

export async function setLevelUpMessage(guildId, template) {
  await pool.query(`UPDATE guilds SET levelup_message=$1 WHERE guild_id=$2`, [template, guildId]);
}

// ------- Misiones --------
export async function getOrCreateDailyMissions(userId, guildId) {
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  const { rows } = await pool.query("SELECT * FROM missions WHERE user_id=$1 AND guild_id=$2 AND scope='daily' AND expires_at >= NOW()", [userId, guildId]);
  if (rows.length) return rows;
  // crear misiones base
  const templates = [
    { type: 'messages', target: 20 },
    { type: 'focus_minutes', target: 50 }
  ];
  const inserted = [];
  for (const t of templates) {
    const { rows: r2 } = await pool.query("INSERT INTO missions (user_id,guild_id,scope,type,target,expires_at) VALUES ($1,$2,'daily',$3,$4,$5) RETURNING *", [userId, guildId, t.type, t.target, todayEnd.toISOString()]);
    inserted.push(r2[0]);
  }
  return inserted;
}

export async function incrementMission(userId, guildId, type, amount) {
  await pool.query("UPDATE missions SET progress = LEAST(target, progress + $4), completed = (progress + $4) >= target WHERE user_id=$1 AND guild_id=$2 AND type=$3 AND scope='daily' AND expires_at >= NOW()", [userId, guildId, type, amount]);
}

// ------- Actividad --------
export async function updateUserActivity(userId, guildId) {
  await pool.query(`INSERT INTO user_activity (user_id,guild_id,last_active_date,streak_count)
    VALUES ($1,$2,CURRENT_DATE,1)
    ON CONFLICT (user_id,guild_id) DO UPDATE SET streak_count = CASE
      WHEN user_activity.last_active_date = CURRENT_DATE THEN user_activity.streak_count
      WHEN user_activity.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN user_activity.streak_count + 1
      ELSE 1 END, last_active_date = CURRENT_DATE`, [userId, guildId]);
}

export async function getUserStreak(userId, guildId) {
  const { rows } = await pool.query('SELECT streak_count FROM user_activity WHERE user_id=$1 AND guild_id=$2', [userId, guildId]);
  return rows[0]?.streak_count || 0;
}

// ------- Badges --------
export async function grantBadge(userId, guildId, badgeId) {
  await pool.query('INSERT INTO user_badges (user_id,guild_id, badge_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, guildId, badgeId]);
}

export async function listBadges(userId, guildId) {
  const { rows } = await pool.query('SELECT badge_id, earned_at FROM user_badges WHERE user_id=$1 AND guild_id=$2 ORDER BY earned_at ASC', [userId, guildId]);
  return rows;
}

// ------- Logging --------
export async function logFocusBlock(userId, guildId, minutes, tag) {
  await pool.query('INSERT INTO pomodoro_focus_log (user_id,guild_id,minutes,tag) VALUES ($1,$2,$3,$4)', [userId, guildId, minutes, tag || null]);
  if (tag) {
    await pool.query(`INSERT INTO pomodoro_tag_stats (guild_id, tag, focus_minutes_total) VALUES ($1,$2,$3)
      ON CONFLICT (guild_id, tag) DO UPDATE SET focus_minutes_total = pomodoro_tag_stats.focus_minutes_total + EXCLUDED.focus_minutes_total`, [guildId, tag, minutes]);
  }
}

export async function topTagStats(guildId, limit=10) {
  const { rows } = await pool.query('SELECT tag, focus_minutes_total FROM pomodoro_tag_stats WHERE guild_id=$1 ORDER BY focus_minutes_total DESC LIMIT $2', [guildId, limit]);
  return rows;
}

// Tasks CRUD
export async function addTask(userId, guildId, description) {
  const { rows } = await pool.query('INSERT INTO tasks (user_id,guild_id,description) VALUES ($1,$2,$3) RETURNING *', [userId, guildId, description]);
  return rows[0];
}
export async function listTasks(userId, guildId, includeCompleted=false) {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE user_id=$1 AND guild_id=$2 AND ($3 OR completed=false) ORDER BY id DESC LIMIT 50', [userId, guildId, includeCompleted]);
  return rows;
}
export async function completeTask(userId, guildId, id) {
  const { rowCount } = await pool.query("UPDATE tasks SET completed=true, completed_at=NOW() WHERE id=$1 AND user_id=$2 AND guild_id=$3 AND completed=false", [id, userId, guildId]);
  return rowCount > 0;
}
export async function deleteTask(userId, guildId, id) {
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id=$1 AND user_id=$2 AND guild_id=$3', [id, userId, guildId]);
  return rowCount > 0;
}

// ------- Moderación --------
export async function logModeration(guildId, userId, moderatorId, action, reason) {
  await pool.query('INSERT INTO moderation_logs (guild_id,user_id,moderator_id,action,reason) VALUES ($1,$2,$3,$4,$5)', [guildId, userId, moderatorId, action, reason || null]);
}

export async function addWarn(guildId, userId, moderatorId, reason) {
  const { rows } = await pool.query('INSERT INTO warns (guild_id,user_id,moderator_id,reason) VALUES ($1,$2,$3,$4) RETURNING *', [guildId, userId, moderatorId, reason || null]);
  return rows[0];
}
export async function listWarns(guildId, userId) {
  const { rows } = await pool.query('SELECT id, reason, created_at FROM warns WHERE guild_id=$1 AND user_id=$2 ORDER BY id DESC LIMIT 20', [guildId, userId]);
  return rows;
}

export async function addMute(guildId, userId, moderatorId, reason, until) {
  const { rows } = await pool.query('INSERT INTO mutes (guild_id,user_id,moderator_id,reason,until) VALUES ($1,$2,$3,$4,$5) RETURNING *', [guildId, userId, moderatorId, reason || null, until]);
  return rows[0];
}
export async function listActiveMutes() {
  const { rows } = await pool.query("SELECT * FROM mutes WHERE active=true AND until <= NOW() ORDER BY until ASC LIMIT 50");
  return rows;
}
export async function deactivateMute(id) {
  await pool.query('UPDATE mutes SET active=false WHERE id=$1', [id]);
}

// ------- Locale --------
export async function setGuildLocale(guildId, locale) {
  await pool.query('UPDATE guilds SET locale=$1 WHERE guild_id=$2', [locale, guildId]);
}
export async function getGuildLocale(guildId) {
  const { rows } = await pool.query('SELECT locale FROM guilds WHERE guild_id=$1', [guildId]);
  return rows[0]?.locale || 'es';
}

// ------- Economía --------
export async function addCoins(guildId, userId, amount) {
  await pool.query(`INSERT INTO users (guild_id,user_id,xp,level,coins) VALUES ($1,$2,0,0,$3)
    ON CONFLICT (user_id,guild_id) DO UPDATE SET coins = users.coins + EXCLUDED.coins`, [guildId, userId, amount]);
}
export async function getUserCoins(guildId, userId) {
  const { rows } = await pool.query('SELECT coins FROM users WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rows[0]?.coins || 0;
}
export async function transferCoins(guildId, fromId, toId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const balRes = await client.query('SELECT coins FROM users WHERE guild_id=$1 AND user_id=$2 FOR UPDATE', [guildId, fromId]);
    const bal = balRes.rows[0]?.coins || 0;
    if (bal < amount) { await client.query('ROLLBACK'); return false; }
    await client.query(`UPDATE users SET coins = coins - $3 WHERE guild_id=$1 AND user_id=$2`, [guildId, fromId, amount]);
    await client.query(`INSERT INTO users (guild_id,user_id,xp,level,coins) VALUES ($1,$2,0,0,$3)
      ON CONFLICT (user_id,guild_id) DO UPDATE SET coins = users.coins + EXCLUDED.coins`, [guildId, toId, amount]);
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}
export async function claimDaily(guildId, userId, amount) {
  const { rows } = await pool.query(`UPDATE users SET coins = coins + $3, last_daily_claim=NOW() WHERE guild_id=$1 AND user_id=$2 AND (last_daily_claim IS NULL OR last_daily_claim < NOW() - interval '23 hours') RETURNING coins`, [guildId, userId, amount]);
  return rows[0];
}
export async function leaderboardCoins(guildId, limit=10, offset=0) {
  const { rows } = await pool.query('SELECT user_id, coins FROM users WHERE guild_id=$1 ORDER BY coins DESC OFFSET $2 LIMIT $3', [guildId, offset, limit]);
  return rows;
}

// ------- Pomodoro Individual --------
export async function startPomodoroSession(userId, guildId, focusMinutes, breakMinutes, cycles) {
  const { rows } = await pool.query(`INSERT INTO pomodoro_sessions (user_id,guild_id,focus_minutes,break_minutes,cycles,phase_end)
    VALUES ($1,$2,$3,$4,$5, NOW() + ($3 || ' minutes')::interval) RETURNING *`, [userId, guildId, focusMinutes, breakMinutes, cycles]);
  return rows[0];
}

export async function getActivePomodoro(userId, guildId) {
  const { rows } = await pool.query('SELECT * FROM pomodoro_sessions WHERE user_id=$1 AND guild_id=$2 AND finished_at IS NULL ORDER BY id DESC LIMIT 1', [userId, guildId]);
  return rows[0];
}

export async function updatePomodoroPhase(id, phase, minutes) {
  await pool.query("UPDATE pomodoro_sessions SET phase=$1, phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$3", [phase, String(minutes), id]);
}

export async function advancePomodoroCycle(id, focusMinutes) {
  await pool.query("UPDATE pomodoro_sessions SET current_cycle=current_cycle+1, phase='focus', phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$1", [id, String(focusMinutes)]);
}

export async function finishPomodoro(id) {
  await pool.query("UPDATE pomodoro_sessions SET phase='finished', finished_at=NOW() WHERE id=$1", [id]);
}

export async function addPomodoroStats(userId, guildId, focusMinutes) {
  await pool.query(`INSERT INTO pomodoro_stats (user_id,guild_id,focus_minutes_total,sessions_completed)
    VALUES ($1,$2,$3,1)
    ON CONFLICT (user_id,guild_id) DO UPDATE SET focus_minutes_total = pomodoro_stats.focus_minutes_total + EXCLUDED.focus_minutes_total, sessions_completed = pomodoro_stats.sessions_completed + 1`, [userId, guildId, focusMinutes]);
}

export async function topPomodoroStats(guildId, limit=10) {
  const { rows } = await pool.query('SELECT user_id, focus_minutes_total, sessions_completed FROM pomodoro_stats WHERE guild_id=$1 ORDER BY focus_minutes_total DESC LIMIT $2', [guildId, limit]);
  return rows;
}

export async function fetchDuePomodoroSessions() {
  const { rows } = await pool.query("SELECT * FROM pomodoro_sessions WHERE finished_at IS NULL AND phase_end <= NOW() ORDER BY id ASC LIMIT 25");
  return rows;
}

// ------- Pomodoro Grupal --------
export async function startGroupPomodoro(guildId, channelId, creatorId, focusMinutes, breakMinutes, cycles) {
  const { rows } = await pool.query(`INSERT INTO pomodoro_group_sessions (guild_id,channel_id,creator_id,focus_minutes,break_minutes,cycles,phase_end)
    VALUES ($1,$2,$3,$4,$5,$6, NOW() + ($4 || ' minutes')::interval) RETURNING *`, [guildId, channelId, creatorId, focusMinutes, breakMinutes, cycles]);
  // creador se añade como participante
  await pool.query('INSERT INTO pomodoro_group_participants (session_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rows[0].id, creatorId]);
  return rows[0];
}

export async function getActiveGroupPomodoro(guildId, channelId) {
  const { rows } = await pool.query('SELECT * FROM pomodoro_group_sessions WHERE guild_id=$1 AND channel_id=$2 AND finished_at IS NULL ORDER BY id DESC LIMIT 1', [guildId, channelId]);
  return rows[0];
}

export async function addGroupParticipant(sessionId, userId) {
  await pool.query('INSERT INTO pomodoro_group_participants (session_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [sessionId, userId]);
}

export async function removeGroupParticipant(sessionId, userId) {
  await pool.query('DELETE FROM pomodoro_group_participants WHERE session_id=$1 AND user_id=$2', [sessionId, userId]);
}

export async function getGroupParticipants(sessionId) {
  const { rows } = await pool.query('SELECT user_id FROM pomodoro_group_participants WHERE session_id=$1', [sessionId]);
  return rows.map(r=>r.user_id);
}

export async function updateGroupPomodoroPhase(id, phase, minutes) {
  await pool.query("UPDATE pomodoro_group_sessions SET phase=$1, phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$3", [phase, String(minutes), id]);
}

export async function advanceGroupPomodoroCycle(id, focusMinutes) {
  await pool.query("UPDATE pomodoro_group_sessions SET current_cycle=current_cycle+1, phase='focus', phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$1", [id, String(focusMinutes)]);
}

export async function finishGroupPomodoro(id) {
  await pool.query("UPDATE pomodoro_group_sessions SET phase='finished', finished_at=NOW() WHERE id=$1", [id]);
}

export async function fetchDueGroupPomodoroSessions() {
  const { rows } = await pool.query("SELECT * FROM pomodoro_group_sessions WHERE finished_at IS NULL AND phase_end <= NOW() ORDER BY id ASC LIMIT 25");
  return rows;
}

export async function setXPChannelModifier(guildId, channelId, multiplier) {
  await pool.query(`INSERT INTO xp_channel_modifiers (guild_id, channel_id, multiplier) VALUES ($1,$2,$3)
    ON CONFLICT (guild_id, channel_id) DO UPDATE SET multiplier=EXCLUDED.multiplier`, [guildId, channelId, multiplier]);
}

export async function getXPChannelMultiplier(guildId, channelId) {
  const { rows } = await pool.query('SELECT multiplier FROM xp_channel_modifiers WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
  return rows[0]?.multiplier || 1;
}

export async function deleteXPChannelModifier(guildId, channelId) {
  await pool.query('DELETE FROM xp_channel_modifiers WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
}

export async function listXPModifiers(guildId) {
  const { rows } = await pool.query('SELECT channel_id, multiplier FROM xp_channel_modifiers WHERE guild_id=$1 ORDER BY channel_id', [guildId]);
  return rows;
}

export async function setLevelUpMessage(guildId, template) {
  await pool.query(`UPDATE guilds SET levelup_message=$1 WHERE guild_id=$2`, [template, guildId]);
}

// ------- Misiones --------
export async function getOrCreateDailyMissions(userId, guildId) {
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  const { rows } = await pool.query("SELECT * FROM missions WHERE user_id=$1 AND guild_id=$2 AND scope='daily' AND expires_at >= NOW()", [userId, guildId]);
  if (rows.length) return rows;
  // crear misiones base
  const templates = [
    { type: 'messages', target: 20 },
    { type: 'focus_minutes', target: 50 }
  ];
  const inserted = [];
  for (const t of templates) {
    const { rows: r2 } = await pool.query("INSERT INTO missions (user_id,guild_id,scope,type,target,expires_at) VALUES ($1,$2,'daily',$3,$4,$5) RETURNING *", [userId, guildId, t.type, t.target, todayEnd.toISOString()]);
    inserted.push(r2[0]);
  }
  return inserted;
}

export async function incrementMission(userId, guildId, type, amount) {
  await pool.query("UPDATE missions SET progress = LEAST(target, progress + $4), completed = (progress + $4) >= target WHERE user_id=$1 AND guild_id=$2 AND type=$3 AND scope='daily' AND expires_at >= NOW()", [userId, guildId, type, amount]);
}

// ------- Actividad --------
export async function updateUserActivity(userId, guildId) {
  await pool.query(`INSERT INTO user_activity (user_id,guild_id,last_active_date,streak_count)
    VALUES ($1,$2,CURRENT_DATE,1)
    ON CONFLICT (user_id,guild_id) DO UPDATE SET streak_count = CASE
      WHEN user_activity.last_active_date = CURRENT_DATE THEN user_activity.streak_count
      WHEN user_activity.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN user_activity.streak_count + 1
      ELSE 1 END, last_active_date = CURRENT_DATE`, [userId, guildId]);
}

export async function getUserStreak(userId, guildId) {
  const { rows } = await pool.query('SELECT streak_count FROM user_activity WHERE user_id=$1 AND guild_id=$2', [userId, guildId]);
  return rows[0]?.streak_count || 0;
}

// ------- Badges --------
export async function grantBadge(userId, guildId, badgeId) {
  await pool.query('INSERT INTO user_badges (user_id,guild_id, badge_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, guildId, badgeId]);
}

export async function listBadges(userId, guildId) {
  const { rows } = await pool.query('SELECT badge_id, earned_at FROM user_badges WHERE user_id=$1 AND guild_id=$2 ORDER BY earned_at ASC', [userId, guildId]);
  return rows;
}

// ------- Logging --------
export async function logFocusBlock(userId, guildId, minutes, tag) {
  await pool.query('INSERT INTO pomodoro_focus_log (user_id,guild_id,minutes,tag) VALUES ($1,$2,$3,$4)', [userId, guildId, minutes, tag || null]);
  if (tag) {
    await pool.query(`INSERT INTO pomodoro_tag_stats (guild_id, tag, focus_minutes_total) VALUES ($1,$2,$3)
      ON CONFLICT (guild_id, tag) DO UPDATE SET focus_minutes_total = pomodoro_tag_stats.focus_minutes_total + EXCLUDED.focus_minutes_total`, [guildId, tag, minutes]);
  }
}

export async function topTagStats(guildId, limit=10) {
  const { rows } = await pool.query('SELECT tag, focus_minutes_total FROM pomodoro_tag_stats WHERE guild_id=$1 ORDER BY focus_minutes_total DESC LIMIT $2', [guildId, limit]);
  return rows;
}

// Tasks CRUD
export async function addTask(userId, guildId, description) {
  const { rows } = await pool.query('INSERT INTO tasks (user_id,guild_id,description) VALUES ($1,$2,$3) RETURNING *', [userId, guildId, description]);
  return rows[0];
}
export async function listTasks(userId, guildId, includeCompleted=false) {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE user_id=$1 AND guild_id=$2 AND ($3 OR completed=false) ORDER BY id DESC LIMIT 50', [userId, guildId, includeCompleted]);
  return rows;
}
export async function completeTask(userId, guildId, id) {
  const { rowCount } = await pool.query("UPDATE tasks SET completed=true, completed_at=NOW() WHERE id=$1 AND user_id=$2 AND guild_id=$3 AND completed=false", [id, userId, guildId]);
  return rowCount > 0;
}
export async function deleteTask(userId, guildId, id) {
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id=$1 AND user_id=$2 AND guild_id=$3', [id, userId, guildId]);
  return rowCount > 0;
}

// ------- Moderación --------
export async function logModeration(guildId, userId, moderatorId, action, reason) {
  await pool.query('INSERT INTO moderation_logs (guild_id,user_id,moderator_id,action,reason) VALUES ($1,$2,$3,$4,$5)', [guildId, userId, moderatorId, action, reason || null]);
}

export async function addWarn(guildId, userId, moderatorId, reason) {
  const { rows } = await pool.query('INSERT INTO warns (guild_id,user_id,moderator_id,reason) VALUES ($1,$2,$3,$4) RETURNING *', [guildId, userId, moderatorId, reason || null]);
  return rows[0];
}
export async function listWarns(guildId, userId) {
  const { rows } = await pool.query('SELECT id, reason, created_at FROM warns WHERE guild_id=$1 AND user_id=$2 ORDER BY id DESC LIMIT 20', [guildId, userId]);
  return rows;
}

export async function addMute(guildId, userId, moderatorId, reason, until) {
  const { rows } = await pool.query('INSERT INTO mutes (guild_id,user_id,moderator_id,reason,until) VALUES ($1,$2,$3,$4,$5) RETURNING *', [guildId, userId, moderatorId, reason || null, until]);
  return rows[0];
}
export async function listActiveMutes() {
  const { rows } = await pool.query("SELECT * FROM mutes WHERE active=true AND until <= NOW() ORDER BY until ASC LIMIT 50");
  return rows;
}
export async function deactivateMute(id) {
  await pool.query('UPDATE mutes SET active=false WHERE id=$1', [id]);
}

// ------- Locale --------
export async function setGuildLocale(guildId, locale) {
  await pool.query('UPDATE guilds SET locale=$1 WHERE guild_id=$2', [locale, guildId]);
}
export async function getGuildLocale(guildId) {
  const { rows } = await pool.query('SELECT locale FROM guilds WHERE guild_id=$1', [guildId]);
  return rows[0]?.locale || 'es';
}

// ------- Economía --------
export async function addCoins(guildId, userId, amount) {
  await pool.query(`INSERT INTO users (guild_id,user_id,xp,level,coins) VALUES ($1,$2,0,0,$3)
    ON CONFLICT (user_id,guild_id) DO UPDATE SET coins = users.coins + EXCLUDED.coins`, [guildId, userId, amount]);
}
export async function getUserCoins(guildId, userId) {
  const { rows } = await pool.query('SELECT coins FROM users WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rows[0]?.coins || 0;
}
export async function transferCoins(guildId, fromId, toId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const balRes = await client.query('SELECT coins FROM users WHERE guild_id=$1 AND user_id=$2 FOR UPDATE', [guildId, fromId]);
    const bal = balRes.rows[0]?.coins || 0;
    if (bal < amount) { await client.query('ROLLBACK'); return false; }
    await client.query(`UPDATE users SET coins = coins - $3 WHERE guild_id=$1 AND user_id=$2`, [guildId, fromId, amount]);
    await client.query(`INSERT INTO users (guild_id,user_id,xp,level,coins) VALUES ($1,$2,0,0,$3)
      ON CONFLICT (user_id,guild_id) DO UPDATE SET coins = users.coins + EXCLUDED.coins`, [guildId, toId, amount]);
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}
export async function claimDaily(guildId, userId, amount) {
  const { rows } = await pool.query(`UPDATE users SET coins = coins + $3, last_daily_claim=NOW() WHERE guild_id=$1 AND user_id=$2 AND (last_daily_claim IS NULL OR last_daily_claim < NOW() - interval '23 hours') RETURNING coins`, [guildId, userId, amount]);
  return rows[0];
}
export async function leaderboardCoins(guildId, limit=10, offset=0) {
  const { rows } = await pool.query('SELECT user_id, coins FROM users WHERE guild_id=$1 ORDER BY coins DESC OFFSET $2 LIMIT $3', [guildId, offset, limit]);
  return rows;
}

// ------- Pomodoro Individual --------
export async function startPomodoroSession(userId, guildId, focusMinutes, breakMinutes, cycles) {
  const { rows } = await pool.query(`INSERT INTO pomodoro_sessions (user_id,guild_id,focus_minutes,break_minutes,cycles,phase_end)
    VALUES ($1,$2,$3,$4,$5, NOW() + ($3 || ' minutes')::interval) RETURNING *`, [userId, guildId, focusMinutes, breakMinutes, cycles]);
  return rows[0];
}

export async function getActivePomodoro(userId, guildId) {
  const { rows } = await pool.query('SELECT * FROM pomodoro_sessions WHERE user_id=$1 AND guild_id=$2 AND finished_at IS NULL ORDER BY id DESC LIMIT 1', [userId, guildId]);
  return rows[0];
}

export async function updatePomodoroPhase(id, phase, minutes) {
  await pool.query("UPDATE pomodoro_sessions SET phase=$1, phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$3", [phase, String(minutes), id]);
}

export async function advancePomodoroCycle(id, focusMinutes) {
  await pool.query("UPDATE pomodoro_sessions SET current_cycle=current_cycle+1, phase='focus', phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$1", [id, String(focusMinutes)]);
}

export async function finishPomodoro(id) {
  await pool.query("UPDATE pomodoro_sessions SET phase='finished', finished_at=NOW() WHERE id=$1", [id]);
}

export async function addPomodoroStats(userId, guildId, focusMinutes) {
  await pool.query(`INSERT INTO pomodoro_stats (user_id,guild_id,focus_minutes_total,sessions_completed)
    VALUES ($1,$2,$3,1)
    ON CONFLICT (user_id,guild_id) DO UPDATE SET focus_minutes_total = pomodoro_stats.focus_minutes_total + EXCLUDED.focus_minutes_total, sessions_completed = pomodoro_stats.sessions_completed + 1`, [userId, guildId, focusMinutes]);
}

export async function topPomodoroStats(guildId, limit=10) {
  const { rows } = await pool.query('SELECT user_id, focus_minutes_total, sessions_completed FROM pomodoro_stats WHERE guild_id=$1 ORDER BY focus_minutes_total DESC LIMIT $2', [guildId, limit]);
  return rows;
}

export async function fetchDuePomodoroSessions() {
  const { rows } = await pool.query("SELECT * FROM pomodoro_sessions WHERE finished_at IS NULL AND phase_end <= NOW() ORDER BY id ASC LIMIT 25");
  return rows;
}

// ------- Pomodoro Grupal --------
export async function startGroupPomodoro(guildId, channelId, creatorId, focusMinutes, breakMinutes, cycles) {
  const { rows } = await pool.query(`INSERT INTO pomodoro_group_sessions (guild_id,channel_id,creator_id,focus_minutes,break_minutes,cycles,phase_end)
    VALUES ($1,$2,$3,$4,$5,$6, NOW() + ($4 || ' minutes')::interval) RETURNING *`, [guildId, channelId, creatorId, focusMinutes, breakMinutes, cycles]);
  // creador se añade como participante
  await pool.query('INSERT INTO pomodoro_group_participants (session_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [rows[0].id, creatorId]);
  return rows[0];
}

export async function getActiveGroupPomodoro(guildId, channelId) {
  const { rows } = await pool.query('SELECT * FROM pomodoro_group_sessions WHERE guild_id=$1 AND channel_id=$2 AND finished_at IS NULL ORDER BY id DESC LIMIT 1', [guildId, channelId]);
  return rows[0];
}

export async function addGroupParticipant(sessionId, userId) {
  await pool.query('INSERT INTO pomodoro_group_participants (session_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [sessionId, userId]);
}

export async function removeGroupParticipant(sessionId, userId) {
  await pool.query('DELETE FROM pomodoro_group_participants WHERE session_id=$1 AND user_id=$2', [sessionId, userId]);
}

export async function getGroupParticipants(sessionId) {
  const { rows } = await pool.query('SELECT user_id FROM pomodoro_group_participants WHERE session_id=$1', [sessionId]);
  return rows.map(r=>r.user_id);
}

export async function updateGroupPomodoroPhase(id, phase, minutes) {
  await pool.query("UPDATE pomodoro_group_sessions SET phase=$1, phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$3", [phase, String(minutes), id]);
}

export async function advanceGroupPomodoroCycle(id, focusMinutes) {
  await pool.query("UPDATE pomodoro_group_sessions SET current_cycle=current_cycle+1, phase='focus', phase_end=NOW() + ($2 || ' minutes')::interval WHERE id=$1", [id, String(focusMinutes)]);
}

export async function finishGroupPomodoro(id) {
  await pool.query("UPDATE pomodoro_group_sessions SET phase='finished', finished_at=NOW() WHERE id=$1", [id]);
}

export async function fetchDueGroupPomodoroSessions() {
  const { rows } = await pool.query("SELECT * FROM pomodoro_group_sessions WHERE finished_at IS NULL AND phase_end <= NOW() ORDER BY id ASC LIMIT 25");
  return rows;
}

export async function setXPChannelModifier(guildId, channelId, multiplier) {
  await pool.query(`INSERT INTO xp_channel_modifiers (guild_id, channel_id, multiplier) VALUES ($1,$2,$3)
    ON CONFLICT (guild_id, channel_id) DO UPDATE SET multiplier=EXCLUDED.multiplier`, [guildId, channelId, multiplier]);
}

export async function getXPChannelMultiplier(guildId, channelId) {
  const { rows } = await pool.query('SELECT multiplier FROM xp_channel_modifiers WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
  return rows[0]?.multiplier || 1;
}

export async function deleteXPChannelModifier(guildId, channelId) {
  await pool.query('DELETE FROM xp_channel_modifiers WHERE guild_id=$1 AND channel_id=$2', [guildId, channelId]);
}

export async function listXPModifiers(guildId) {
  const { rows } = await pool.query('SELECT channel_id, multiplier FROM xp_channel_modifiers WHERE guild_id=$1 ORDER BY channel_id', [guildId]);
  return rows;
}

export async function setLevelUpMessage(guildId, template) {
  await pool.query(`UPDATE guilds SET levelup_message=$1 WHERE guild_id=$2`, [template, guildId]);
}

// ------- Misiones --------
export async function getOrCreateDailyMissions(userId, guildId) {
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);
  const { rows } = await pool.query("SELECT * FROM missions WHERE user_id=$1 AND guild_id=$2 AND scope='daily' AND expires_at >= NOW()", [userId, guildId]);
  if (rows.length) return rows;
  // crear misiones base
  const templates = [
    { type: 'messages', target: 20 },
    { type: 'focus_minutes', target: 50 }
  ];
  const inserted = [];
  for (const t of templates) {
    const { rows: r2 } = await pool.query("INSERT INTO missions (user_id,guild_id,scope,type,target,expires_at) VALUES ($1,$2,'daily',$3,$4,$5) RETURNING *", [userId, guildId, t.type, t.target, todayEnd.toISOString()]);
    inserted.push(r2[0]);
  }
  return inserted;
}

export async function incrementMission(userId, guildId, type, amount) {
  await pool.query("UPDATE missions SET progress = LEAST(target, progress + $4), completed = (progress + $4) >= target WHERE user_id=$1 AND guild_id=$2 AND type=$3 AND scope='daily' AND expires_at >= NOW()", [userId, guildId, type, amount]);
}

// ------- Actividad --------
export async function updateUserActivity(userId, guildId) {
  await pool.query(`INSERT INTO user_activity (user_id,guild_id,last_active_date,streak_count)
    VALUES ($1,$2,CURRENT_DATE,1)
    ON CONFLICT (user_id,guild_id) DO UPDATE SET streak_count = CASE
      WHEN user_activity.last_active_date = CURRENT_DATE THEN user_activity.streak_count
      WHEN user_activity.last_active_date = CURRENT_DATE - INTERVAL '1 day' THEN user_activity.streak_count + 1
      ELSE 1 END, last_active_date = CURRENT_DATE`, [userId, guildId]);
}

export async function getUserStreak(userId, guildId) {
  const { rows } = await pool.query('SELECT streak_count FROM user_activity WHERE user_id=$1 AND guild_id=$2', [userId, guildId]);
  return rows[0]?.streak_count || 0;
}

// ------- Badges --------
export async function grantBadge(userId, guildId, badgeId) {
  await pool.query('INSERT INTO user_badges (user_id,guild_id, badge_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [userId, guildId, badgeId]);
}

export async function listBadges(userId, guildId) {
  const { rows } = await pool.query('SELECT badge_id, earned_at FROM user_badges WHERE user_id=$1 AND guild_id=$2 ORDER BY earned_at ASC', [userId, guildId]);
  return rows;
}

// ------- Logging --------
export async function logFocusBlock(userId, guildId, minutes, tag) {
  await pool.query('INSERT INTO pomodoro_focus_log (user_id,guild_id,minutes,tag) VALUES ($1,$2,$3,$4)', [userId, guildId, minutes, tag || null]);
  if (tag) {
    await pool.query(`INSERT INTO pomodoro_tag_stats (guild_id, tag, focus_minutes_total) VALUES ($1,$2,$3)
      ON CONFLICT (guild_id, tag) DO UPDATE SET focus_minutes_total = pomodoro_tag_stats.focus_minutes_total + EXCLUDED.focus_minutes_total`, [guildId, tag, minutes]);
  }
}

export async function topTagStats(guildId, limit=10) {
  const { rows } = await pool.query('SELECT tag, focus_minutes_total FROM pomodoro_tag_stats WHERE guild_id=$1 ORDER BY focus_minutes_total DESC LIMIT $2', [guildId, limit]);
  return rows;
}

// Tasks CRUD
export async function addTask(userId, guildId, description) {
  const { rows } = await pool.query('INSERT INTO tasks (user_id,guild_id,description) VALUES ($1,$2,$3) RETURNING *', [userId, guildId, description]);
  return rows[0];
}
export async function listTasks(userId, guildId, includeCompleted=false) {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE user_id=$1 AND guild_id=$2 AND ($3 OR completed=false) ORDER BY id DESC LIMIT 50', [userId, guildId, includeCompleted]);
  return rows;
}
export async function completeTask(userId, guildId, id) {
  const { rowCount } = await pool.query("UPDATE tasks SET completed=true, completed_at=NOW() WHERE id=$1 AND user_id=$2 AND guild_id=$3 AND completed=false", [id, userId, guildId]);
  return rowCount > 0;
}
export async function deleteTask(userId, guildId, id) {
  const { rowCount } = await pool.query('DELETE FROM tasks WHERE id=$1 AND user_id=$2 AND guild_id=$3', [id, userId, guildId]);
  return rowCount > 0;
}

// ------- Moderación --------
export async function logModeration(guildId, userId, moderatorId, action, reason) {
  await pool.query('INSERT INTO moderation_logs (guild_id,user_id,moderator_id,action,reason) VALUES ($1,$2,$3,$4,$5)', [guildId, userId, moderatorId, action, reason || null]);
}

export async function addWarn(guildId, userId, moderatorId, reason) {
  const { rows } = await pool.query('INSERT INTO warns (guild_id,user_id,moderator_id,reason) VALUES ($1,$2,$3,$4) RETURNING *', [guildId, userId, moderatorId, reason || null]);
  return rows[0];
}
export async function listWarns(guildId, userId) {
  const { rows } = await pool.query('SELECT id, reason, created_at FROM warns WHERE guild_id=$1 AND user_id=$2 ORDER BY id DESC LIMIT 20', [guildId, userId]);
  return rows;
}

export async function addMute(guildId, userId, moderatorId, reason, until) {
  const { rows } = await pool.query('INSERT INTO mutes (guild_id,user_id,moderator_id,reason,until) VALUES ($1,$2,$3,$4,$5) RETURNING *', [guildId, userId, moderatorId, reason || null, until]);
  return rows[0];
}
export async function listActiveMutes() {
  const { rows } = await pool.query("SELECT * FROM mutes WHERE active=true AND until <= NOW() ORDER BY until ASC LIMIT 50");
  return rows;
}
export async function deactivateMute(id) {
  await pool.query('UPDATE mutes SET active=false WHERE id=$1', [id]);
}

// ------- Locale --------
export async function setGuildLocale(guildId, locale) {
  await pool.query('UPDATE guilds SET locale=$1 WHERE guild_id=$2', [locale, guildId]);
}
export async function getGuildLocale(guildId) {
  const { rows } = await pool.query('SELECT locale FROM guilds WHERE guild_id=$1', [guildId]);
  return rows[0]?.locale || 'es';
}

// ------- Economía --------
export async function addCoins(guildId, userId, amount) {
  await pool.query(`INSERT INTO users (guild_id,user_id,xp,level,coins) VALUES ($1,$2,0,0,$3)
    ON CONFLICT (user_id,guild_id) DO UPDATE SET coins = users.coins + EXCLUDED.coins`, [guildId, userId, amount]);
}
export async function getUserCoins(guildId, userId) {
  const { rows } = await pool.query('SELECT coins FROM users WHERE guild_id=$1 AND user_id=$2', [guildId, userId]);
  return rows[0]?.coins || 0;
}
export async function transferCoins(guildId, fromId, toId, amount) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const balRes = await client.query('SELECT coins FROM users WHERE guild_id=$1 AND user_id=$2 FOR UPDATE', [guildId, fromId]);
    const bal = balRes.rows[0]?.coins || 0;
    if (bal < amount) { await client.query('ROLLBACK'); return false; }
    await client.query(`UPDATE users SET coins = coins - $3 WHERE guild_id=$1 AND user_id=$2`, [guildId, fromId, amount]);
    await client.query(`INSERT INTO users (guild_id,user_id,xp,level,coins) VALUES ($1,$2,0,0,$3)
      ON CONFLICT (user_id,guild_id) DO UPDATE SET coins = users.coins + EXCLUDED.coins`, [guildId, toId, amount]);
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally { client.release(); }
}
export async function claimDaily(guildId, userId, amount) {
  const { rows } = await pool.query(`UPDATE users SET coins = coins + $3, last_daily_claim=NOW() WHERE guild_id=$1 AND user_id=$2 AND (last_daily_claim IS NULL OR last_daily_claim < NOW() - interval '23 hours') RETURNING coins`, [guildId, userId, amount]);
  return rows[0];
}
export async function leaderboardCoins(guildId, limit=10, offset=0) {
  const { rows } = await pool.query('SELECT user_id, coins FROM users WHERE guild_id=$1 ORDER BY coins DESC OFFSET $2 LIMIT $3', [guildId, offset, limit]);
  return rows;
}

// ------- Badges por progreso --------
export async function ensureProgressBadges(userId, guildId) {
  // rachas largas
  const { rows: streakRows } = await pool.query('SELECT streak_count FROM user_activity WHERE user_id=$1 AND guild_id=$2', [userId, guildId]);
  const streak = streakRows[0]?.streak_count || 0;
  if (streak >= 7) await grantBadge(userId, guildId, 'streak_7');
  if (streak >= 30) await grantBadge(userId, guildId, 'streak_30');
  // foco total
  const { rows: focusRows } = await pool.query('SELECT focus_minutes_total FROM pomodoro_stats WHERE user_id=$1 AND guild_id=$2', [userId, guildId]);
  const focus = focusRows[0]?.focus_minutes_total || 0;
  if (focus >= 500) await grantBadge(userId, guildId, 'focus_500');
  if (focus >= 2000) await grantBadge(userId, guildId, 'focus_2000');
  // economía
  const { rows: coinRows } = await pool.query('SELECT coins FROM users WHERE user_id=$1 AND guild_id=$2', [userId, guildId]);
  const coins = coinRows[0]?.coins || 0;
  if (coins >= 1000) await grantBadge(userId, guildId, 'wealth_1k');
  if (coins >= 10000) await grantBadge(userId, guildId, 'wealth_10k');
}