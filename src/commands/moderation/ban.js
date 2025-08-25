import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { banearUsuario } from '../../modules/moderacion/index.js';
import { t, guildLocale } from '../../services/i18n.js';

export default {
  data: new SlashCommandBuilder().setName('ban').setDescription('Banea a un usuario').addUserOption(o=>o.setName('usuario').setDescription('Usuario a banear').setRequired(true)).addStringOption(o=>o.setName('razon').setDescription('Razón')).setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    const locale = guildLocale(interaction.guild.id);
    const user = interaction.options.getUser('usuario');
    const reason = interaction.options.getString('razon') || 'Sin razón';
    const member = await interaction.guild.members.fetch(user.id).catch(()=>null);
    if (!member) return interaction.reply({ content: t(locale, 'moderation.ban.notFound'), ephemeral: true });
    if (!member.bannable) return interaction.reply({ content: t(locale, 'moderation.ban.notBannable'), ephemeral: true });
    await banearUsuario(interaction.guild, member, interaction.user.id, reason);
    await interaction.reply({ content: t(locale, 'moderation.ban.success', { user: user.tag, reason }), ephemeral: true });
  }
};
