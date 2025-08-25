import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { COLORS } from '../../config/constants.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Información del servidor.'),
  async execute(interaction) {
    const cfg = await obtenerConfigGuild(interaction.guild.id); const locale = cfg?.locale || 'es';
    const g = interaction.guild;
    const embed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle(t(locale,'serverinfo.title',{ name: g.name }))
      .addFields(
        { name: t(locale,'serverinfo.members'), value: g.memberCount.toString(), inline: true },
        { name: t(locale,'serverinfo.created'), value: `<t:${Math.floor(g.createdTimestamp/1000)}:R>`, inline: true },
        { name: 'ID', value: g.id, inline: true }
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
