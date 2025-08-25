import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { advertirUsuario, listarAdvertencias } from '../../modules/moderacion/index.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder().setName('warn').setDescription('Gestiona advertencias')
    .addSubcommand(sc=>sc.setName('add').setDescription('Añade warn a usuario').addUserOption(o=>o.setName('usuario').setDescription('Usuario').setRequired(true)).addStringOption(o=>o.setName('razon').setDescription('Razón')))
    .addSubcommand(sc=>sc.setName('list').setDescription('Lista warns de usuario').addUserOption(o=>o.setName('usuario').setDescription('Usuario').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const cfg = await obtenerConfigGuild(interaction.guild.id); const locale = cfg?.locale || 'es';
    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      const user = interaction.options.getUser('usuario');
      const reason = interaction.options.getString('razon') || t(locale,'generic.noReason');
      await advertirUsuario(interaction.guild.id, user.id, interaction.user.id, reason);
      return interaction.reply({ content: t(locale,'warn.added',{ user: user.tag }), ephemeral: true });
    }
    if (sub === 'list') {
      const user = interaction.options.getUser('usuario');
      const warns = await listarAdvertencias(interaction.guild.id, user.id);
      if (!warns.length) return interaction.reply({ content: t(locale,'warn.none'), ephemeral: true });
      const lines = warns.map(w=>`#${w.id} - ${w.reason || t(locale,'generic.noReason')} (${new Date(w.created_at).toLocaleDateString()})`);
      return interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }
  }
};
