// Servicio de configuración de guild
import { getGuildConfig, setGuildConfig } from '../database/index.js';

export async function mergeGuildConfig(guildId, patch) {
  const current = await getGuildConfig(guildId) || { guild_id: guildId, level_roles: [] };
  const merged = { ...current, ...patch };
  await setGuildConfig(guildId, merged);
  return merged;
}
