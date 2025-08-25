import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import os from 'os';
import { COLORS } from '../../config/constants.js';

export default {
  data: new SlashCommandBuilder().setName('stats').setDescription('Muestra estadísticas del bot'),
  async execute(interaction) {
    const mem = process.memoryUsage();
    const uptime = process.uptime();
    const guilds = interaction.client.guilds.cache.size;
    const users = interaction.client.users.cache.size;
    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('📈 Stats')
      .addFields(
        { name: 'Uptime', value: `${Math.floor(uptime/3600)}h ${Math.floor(uptime/60)%60}m`, inline: true },
        { name: 'Memoria RSS', value: `${(mem.rss/1024/1024).toFixed(1)} MB`, inline: true },
        { name: 'Heap', value: `${(mem.heapUsed/1024/1024).toFixed(1)}/${(mem.heapTotal/1024/1024).toFixed(1)} MB`, inline: true },
        { name: 'Guilds', value: guilds.toString(), inline: true },
        { name: 'Usuarios cache', value: users.toString(), inline: true },
        { name: 'Ping WS', value: `${interaction.client.ws.ping} ms`, inline: true }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
