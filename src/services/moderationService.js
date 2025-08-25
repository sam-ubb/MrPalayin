// Servicio de moderación
import { logModeration, addWarn, listWarns, addMute } from '../database/index.js';

export async function banUser(guild, member, moderatorId, reason) {
  await member.ban({ reason });
  await logModeration(guild.id, member.id, moderatorId, 'ban', reason);
}

export async function kickUser(guild, member, moderatorId, reason) {
  await member.kick(reason);
  await logModeration(guild.id, member.id, moderatorId, 'kick', reason);
}

export async function clearMessages(guildId, moderatorId, count, channelName) {
  await logModeration(guildId, null, moderatorId, 'clear', `Borrados ${count} mensajes en #${channelName}`);
}

export async function warnUser(guildId, userId, moderatorId, reason) {
  return addWarn(guildId, userId, moderatorId, reason);
}

export async function listUserWarns(guildId, userId) {
  return listWarns(guildId, userId);
}

export async function muteUser(guildId, userId, moderatorId, reason, until) {
  return addMute(guildId, userId, moderatorId, reason, until);
}
