// Servicio Misiones (español)
import { getOrCreateDailyMissions, incrementMission } from '../../../database/index.js';

export async function obtenerOMisionesDiarias(userId, guildId) { return getOrCreateDailyMissions(userId, guildId); }
export async function incrementarMision(userId, guildId, tipo, cantidad) { return incrementMission(userId, guildId, tipo, cantidad); }
