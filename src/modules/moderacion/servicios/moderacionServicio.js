// Servicio Moderación (español)
import { logModeration, addWarn, listWarns, addMute } from '../../../database/index.js';

export async function banearUsuario(guild, member, moderadorId, razon) {
  await member.ban({ reason: razon });
  await logModeration(guild.id, member.id, moderadorId, 'ban', razon);
}
export async function expulsarUsuario(guild, member, moderadorId, razon) {
  await member.kick(razon);
  await logModeration(guild.id, member.id, moderadorId, 'kick', razon);
}
export async function registrarClear(guildId, moderadorId, cantidad, canalNombre) {
  await logModeration(guildId, null, moderadorId, 'clear', `Borrados ${cantidad} mensajes en #${canalNombre}`);
}
export async function advertirUsuario(guildId, userId, moderadorId, razon) { return addWarn(guildId, userId, moderadorId, razon); }
export async function listarAdvertencias(guildId, userId) { return listWarns(guildId, userId); }
export async function silenciarUsuario(guildId, userId, moderadorId, razon, hasta) { return addMute(guildId, userId, moderadorId, razon, hasta); }
