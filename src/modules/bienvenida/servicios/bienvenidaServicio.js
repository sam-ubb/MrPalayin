// Servicio Bienvenida (español)
import { getGuildConfig } from '../../../database/index.js';
import { EmbedBuilder } from 'discord.js';
import { COLORS } from '../../../config/constants.js';

export async function enviarBienvenida(member) {
  const cfg = await getGuildConfig(member.guild.id) || {};
  const channelId = cfg.welcome_channel;
  const channel = channelId ? member.guild.channels.cache.get(channelId) : member.guild.systemChannel;
  if (!channel) return false;
  const welcomeMsg = cfg.welcome_message || `👋 ¡Bienvenido ${member.user.username}!`;
  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle('🎓 ¡Nuevo estudiante!')
    .setDescription(`${welcomeMsg}\n\nMiembros totales: **${member.guild.memberCount}**`)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();
  await channel.send({ content: welcomeMsg, embeds: [embed] });
  return true;
}

export async function enviarDMdeBienvenida(member) {
  if (process.env.WELCOME_DM_ENABLED === 'true') {
    await member.send(`¡Bienvenido a **${member.guild.name}**! Usa /help para empezar.`).catch(()=>{});
  }
}
