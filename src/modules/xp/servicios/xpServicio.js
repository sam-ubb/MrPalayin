// Servicio XP (español)
import { getUser, getLeaderboard } from '../../../database/index.js';

export async function obtenerUsuarioXP(guildId, userId) {
  return getUser(guildId, userId);
}

export async function obtenerLeaderboard(guildId, offset, limit) {
  return getLeaderboard(guildId, offset, limit);
}
