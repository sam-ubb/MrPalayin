import { SlashCommandBuilder } from 'discord.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('Muestra la latencia del bot.'),
  async execute(interaction) {
    const cfg = await obtenerConfigGuild(interaction.guild.id);
    const locale = cfg?.locale || 'es';
    const sent = await interaction.reply({ content: t(locale,'ping.start'), fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(t(locale,'ping.result',{ latency, ws: interaction.client.ws.ping }));
  }
};
