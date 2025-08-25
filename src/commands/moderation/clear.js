import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { registrarClear } from '../../modules/moderacion/index.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder().setName('clear').setDescription('Borra mensajes').addIntegerOption(o=>o.setName('cantidad').setDescription('Cantidad de mensajes (1-100)').setRequired(true)).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const cfg = await obtenerConfigGuild(interaction.guild.id); const locale = cfg?.locale || 'es';
    const amount = interaction.options.getInteger('cantidad');
    if (amount < 1 || amount > 100) return interaction.reply({ content: t(locale,'clear.invalid'), ephemeral: true });
    const channel = interaction.channel;
    const messages = await channel.bulkDelete(amount, true).catch(()=>null);
    if (!messages) return interaction.reply({ content: t(locale,'clear.error'), ephemeral: true });
    await registrarClear(interaction.guild.id, interaction.user.id, messages.size, channel.name);
    await interaction.reply({ content: t(locale,'clear.ok',{ count: messages.size }), ephemeral: true });
  }
};
