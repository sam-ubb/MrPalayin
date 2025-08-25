import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { COLORS } from '../../config/constants.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder().setName('help').setDescription('Lista de comandos disponibles.'),
  async execute(interaction) {
    const cfg = await obtenerConfigGuild(interaction.guild.id); const locale = cfg?.locale || 'es';
    const embed = new EmbedBuilder()
      .setColor(COLORS.primary)
      .setTitle(t(locale,'help.title'))
      .setDescription(t(locale,'help.description'))
      .addFields(
        { name: t(locale,'help.section.utility'), value: '`/ping`, `/help`, `/serverinfo`, `/userinfo`, `/stats`' },
        { name: t(locale,'help.section.progress'), value: '`/level`, `/leaderboard`, `/pomodoro-top`, `/daily`, `/badges`' },
        { name: t(locale,'help.section.pomodoro'), value: '`/pomodoro ...`' },
        { name: t(locale,'help.section.tasks'), value: '`/task add|list|listall|done|delete`' },
        { name: t(locale,'help.section.reminders'), value: '`/remind tiempo mensaje`' },
        { name: t(locale,'help.section.moderation'), value: '`/clear`, `/kick`, `/ban`' },
        { name: t(locale,'help.section.config'), value: '`/config ...`' }
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
