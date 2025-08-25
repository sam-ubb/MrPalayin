import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { obtenerUsuarioXP } from '../../modules/xp/index.js';
import { COLORS } from '../../config/constants.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder().setName('level').setDescription('Muestra tu nivel y XP actual.'),
  async execute(interaction) {
    const cfg = await obtenerConfigGuild(interaction.guild.id);
    const locale = cfg?.locale || 'es';
    const user = await obtenerUsuarioXP(interaction.guild.id, interaction.user.id);
    const xp = user?.xp || 0;
    const level = user?.level || 0;
    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle(t(locale,'level.header',{ user: interaction.user.username }))
      .addFields(
        { name: t(locale,'level.field.xp'), value: xp.toString(), inline: true },
        { name: t(locale,'level.field.level'), value: level.toString(), inline: true }
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
