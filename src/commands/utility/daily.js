import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { obtenerOMisionesDiarias } from '../../modules/misiones/index.js';
import { COLORS } from '../../config/constants.js';

export default {
  data: new SlashCommandBuilder().setName('daily').setDescription('Muestra tus misiones diarias'),
  async execute(interaction) {
    const missions = await obtenerOMisionesDiarias(interaction.user.id, interaction.guild.id);
    const lines = missions.map(m => {
      const pct = Math.min(100, Math.floor((m.progress / m.target) * 100));
      return `• ${m.type === 'messages' ? 'Mensajes' : 'Min foco'}: ${m.progress}/${m.target} (${pct}%) ${m.completed ? '✅' : ''}`;
    });
    const embed = new EmbedBuilder().setColor(COLORS.primary).setTitle('🗓️ Misiones Diarias').setDescription(lines.join('\n')).setFooter({ text: 'Reseteo al final del día.' });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
