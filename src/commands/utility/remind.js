import { SlashCommandBuilder } from 'discord.js';
import { parseTime, formatRelative } from '../../utils/time.js';
import { crearRecordatorio } from '../../modules/recordatorios/index.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Crea un recordatorio')
    .addStringOption(o => o.setName('tiempo').setDescription('Ej: 10m, 2h, 1d').setRequired(true))
    .addStringOption(o => o.setName('mensaje').setDescription('Mensaje del recordatorio').setRequired(true)),
  async execute(interaction) {
    const cfg = await obtenerConfigGuild(interaction.guild.id); const locale = cfg?.locale || 'es';
    const timeStr = interaction.options.getString('tiempo');
    const msg = interaction.options.getString('mensaje');
    const ms = parseTime(timeStr);
    if (!ms) return interaction.reply({ content: t(locale,'remind.invalid'), ephemeral: true });
    const remindTime = new Date(Date.now() + ms);
    await crearRecordatorio(interaction.user.id, interaction.guild.id, msg, remindTime.toISOString());
    await interaction.reply({ content: t(locale,'remind.created',{ rel: formatRelative(ms), text: msg }), ephemeral: true });
  }
};
