// Servicio Economía (español)
import { getUserCoins, addCoins, transferCoins, claimDaily, leaderboardCoins } from '../../../database/index.js';

export async function obtenerBalance(guildId, userId) { return getUserCoins(guildId, userId); }
export async function darMonedas(guildId, userId, cantidad) { return addCoins(guildId, userId, cantidad); }
export async function transferirMonedas(guildId, deId, aId, cantidad) { return transferCoins(guildId, deId, aId, cantidad); }
export async function reclamarDiario(guildId, userId, cantidad) { return claimDaily(guildId, userId, cantidad); }
export async function rankingMonedas(guildId, limite=10, offset=0) { return leaderboardCoins(guildId, limite, offset); }
