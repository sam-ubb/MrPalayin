import { Client, GatewayIntentBits, Collection } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initSchema, runMigrations, listActiveMutes, deactivateMute } from './database/index.js';
import { fetchDuePomodoroSessions, updatePomodoroPhase, advancePomodoroCycle, finishPomodoro, addPomodoroStats, fetchDueGroupPomodoroSessions, updateGroupPomodoroPhase, advanceGroupPomodoroCycle, finishGroupPomodoro, getGroupParticipants } from './modules/pomodoro/index.js';
import { obtenerRecordatoriosPendientes, marcarRecordatorioEnviado, limpiarRecordatoriosAntiguos } from './modules/recordatorios/index.js';
import { registerSlashCommands } from './handlers/registerCommands.js';
import { logger } from './utils/logger.js';
import { RateLimiter } from './utils/rateLimiter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!process.env.DISCORD_TOKEN) {
  logger.error('DISCORD_TOKEN no definido en .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

client.commands = new Collection();
client.paginationHandlers = new Map();
client.rateLimiters = {
  command: new RateLimiter({ tokensPerInterval: 5, intervalMs: 60000, burst: 10 }), // 5 por minuto, burst 10
  component: new RateLimiter({ tokensPerInterval: 20, intervalMs: 60000, burst: 30 })
};

// Cargar comandos dinámicamente
async function loadCommands() {
  const commandsDir = path.join(__dirname, 'commands');
  const slashData = [];
  async function traverse(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await traverse(full);
      else if (entry.name.endsWith('.js')) {
        const mod = await import(full + '?update=' + Date.now());
        if (mod.default?.data && mod.default?.execute) {
          client.commands.set(mod.default.data.name, mod.default);
          slashData.push(mod.default.data.toJSON());
        }
      }
    }
  }
  await traverse(commandsDir);
  return slashData;
}

// Cargar eventos
async function loadEvents() {
  const eventsDir = path.join(__dirname, 'events');
  const entries = fs.readdirSync(eventsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.name.endsWith('.js')) continue;
    const full = path.join(eventsDir, entry.name);
    const ev = await import(full + '?update=' + Date.now());
    if (ev.default?.once) client.once(ev.default.name, (...args) => ev.default.execute(...args, client));
    else if (ev.default?.name) client.on(ev.default.name, (...args) => ev.default.execute(...args, client));
  }
}

async function pollReminders() {
  try {
    const due = await obtenerRecordatoriosPendientes();
    for (const r of due) {
      try {
        const user = await client.users.fetch(r.user_id).catch(()=>null);
        if (user) await user.send(`⏰ Recordatorio: ${r.message}`).catch(()=>{});
        await marcarRecordatorioEnviado(r.id);
      } catch (inner) { logger.warn('Fallo al enviar recordatorio', { id: r.id, error: inner.message }); }
    }
    await limpiarRecordatoriosAntiguos();
  } catch (e) {
    logger.error('Error polling reminders', e);
  } finally {
    setTimeout(pollReminders, 30 * 1000);
  }
}

async function pollPomodoro() {
  try {
    const due = await fetchDuePomodoroSessions();
    for (const s of due) {
      if (s.phase === 'focus') {
        await addPomodoroStats(s.user_id, s.guild_id, s.focus_minutes);
        const isLong = s.long_break_minutes && s.cycle_before_long_break && s.current_cycle % s.cycle_before_long_break === 0 && s.current_cycle < s.cycles;
        if (s.current_cycle >= s.cycles) {
          await finishPomodoro(s.id);
          const user = await client.users.fetch(s.user_id).catch(()=>null);
          if (user) user.send('🍅 Sesión Pomodoro completada. ¡Bien hecho!').catch(()=>{});
        } else {
          if (isLong) await updatePomodoroPhase(s.id, 'break', s.long_break_minutes);
          else await updatePomodoroPhase(s.id, 'break', s.break_minutes);
        }
      } else if (s.phase === 'break') {
        if (s.current_cycle + 1 > s.cycles) {
          await finishPomodoro(s.id);
        } else {
          await advancePomodoroCycle(s.id, s.focus_minutes);
        }
      }
    }
    const dueGroup = await fetchDueGroupPomodoroSessions();
    for (const g of dueGroup) {
      const participants = await getGroupParticipants(g.id);
      const channel = await client.channels.fetch(g.channel_id).catch(()=>null);
      if (g.phase === 'focus') {
        for (const uid of participants) await addPomodoroStats(uid, g.guild_id, g.focus_minutes);
        const isLong = g.long_break_minutes && g.cycle_before_long_break && g.current_cycle % g.cycle_before_long_break === 0 && g.current_cycle < g.cycles;
        if (g.current_cycle >= g.cycles) {
          await finishGroupPomodoro(g.id);
          if (channel) channel.send('🍅 Sesión grupal completada. ¡Todos agarraron la pala!');
        } else {
          if (isLong) await updateGroupPomodoroPhase(g.id, 'break', g.long_break_minutes);
          else await updateGroupPomodoroPhase(g.id, 'break', g.break_minutes);
          if (channel) channel.send(isLong ? '⛱️ Descanso largo iniciado.' : '⛱️ Descanso iniciado.');
        }
      } else if (g.phase === 'break') {
        if (g.current_cycle + 1 > g.cycles) {
          await finishGroupPomodoro(g.id);
          if (channel) channel.send('🍅 Sesión grupal finalizada tras el descanso.');
        } else {
          await advanceGroupPomodoroCycle(g.id, g.focus_minutes);
          if (channel) channel.send('🔔 Nuevo bloque de foco iniciado.');
        }
      }
    }
  } catch (e) {
    logger.error('Error polling pomodoro', e);
  } finally {
    setTimeout(pollPomodoro, 30 * 1000);
  }
}

async function pollMutes() {
  try {
    const due = await listActiveMutes();
    for (const m of due) {
      try {
        const guild = await client.guilds.fetch(m.guild_id).catch(()=>null);
        if (!guild) continue;
        const member = await guild.members.fetch(m.user_id).catch(()=>null);
        if (member && member.communicationDisabledUntilTimestamp && member.communicationDisabledUntilTimestamp <= Date.now()) {
          await member.timeout(null).catch(()=>{});
        }
        await deactivateMute(m.id);
      } catch (e) { logger.warn('Fallo al desmutear', { muteId: m.id, error: e.message }); }
    }
  } catch (e) { logger.error('Error polling mutes', e); }
  finally { setTimeout(pollMutes, 60 * 1000); }
}

let lastCleanup = 0;
async function cleanupOldReminders() {
  const DAY = 24*60*60*1000;
  if (Date.now() - lastCleanup < DAY) return; // ejecutar máx 1 vez / día
  lastCleanup = Date.now();
  try {
    const res = await (await import('./database/index.js')).pool.query("DELETE FROM reminders WHERE sent=true AND remind_time < NOW() - interval '30 days'");
    if (res.rowCount) logger.info('Limpieza de recordatorios', { eliminados: res.rowCount });
  } catch (e) { logger.warn('Fallo limpieza recordatorios', e); }
}

(async () => {
  await runMigrations();
  await initSchema();
  const slashData = await loadCommands();
  await loadEvents();
  client.once('ready', async () => {
    await registerSlashCommands(client.user.id, process.env.DISCORD_TOKEN, slashData);
    logger.info('Bot listo', { user: client.user.tag });
  });
  await client.login(process.env.DISCORD_TOKEN);
  pollReminders();
  pollPomodoro();
  pollMutes();
})();
