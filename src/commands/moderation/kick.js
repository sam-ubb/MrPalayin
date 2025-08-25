import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { expulsarUsuario } from '../../modules/moderacion/index.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder().setName('kick').setDescription('Expulsa a un usuario').addUserOption(o=>o.setName('usuario').setDescription('Usuario a expulsar').setRequired(true)).addStringOption(o=>o.setName('razon').setDescription('Razón')).setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction) {
    const cfg = await obtenerConfigGuild(interaction.guild.id); const locale = cfg?.locale || 'es';
    const user = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('razon') || t(locale,'generic.noReason');
    const member = await interaction.guild.members.fetch(user.id).catch(()=>null);
    if (!member) return interaction.reply({ content: t(locale,'moderation.ban.notFound'), ephemeral: true });
    if (!member.kickable) return interaction.reply({ content: t(locale,'kick.notKickable'), ephemeral: true });
    await expulsarUsuario(interaction.guild, member, interaction.user.id, reason);
    await interaction.reply({ content: t(locale,'kick.ok',{ user: user.tag, reason }), ephemeral: true });
  }
};
