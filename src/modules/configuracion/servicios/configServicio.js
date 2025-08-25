// Servicio de configuración (español)
import { getGuildConfig, setGuildConfig, setXPChannelModifier, deleteXPChannelModifier, listXPModifiers, setLevelUpMessage } from '../../../database/index.js';

export async function fusionarConfiguracion(guildId, parche) {
  const actual = await getGuildConfig(guildId) || { guild_id: guildId, level_roles: [] };
  const fusion = { ...actual, ...parche };
  await setGuildConfig(guildId, fusion);
  return fusion;
}

export const modificarXP = setXPChannelModifier;
export const eliminarMultiplicadorXP = deleteXPChannelModifier;
export const listarMultiplicadoresXP = listXPModifiers;
export const establecerPlantillaLevelUp = setLevelUpMessage;
export { getGuildConfig as obtenerConfigGuild } from '../../../database/index.js';
