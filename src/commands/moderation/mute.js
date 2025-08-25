import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { silenciarUsuario } from '../../modules/moderacion/index.js';
import { parseTime } from '../../utils/time.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder().setName('mute').setDescription('Silencia temporalmente a un usuario')
    .addUserOption(o=>o.setName('usuario').setDescription('Usuario').setRequired(true))
    .addStringOption(o=>o.setName('duracion').setDescription('Ej: 10m, 2h').setRequired(true))
    .addStringOption(o=>o.setName('razon').setDescription('Razón'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const cfg = await obtenerConfigGuild(interaction.guild.id); const locale = cfg?.locale || 'es';
    const user = interaction.options.getUser('usuario');
    const durationRaw = interaction.options.getString('duracion');
    const reason = interaction.options.getString('razon') || t(locale,'generic.noReason');
    const ms = parseTime(durationRaw);
    if (!ms) return interaction.reply({ content: t(locale,'mute.invalid'), ephemeral: true });
    const member = await interaction.guild.members.fetch(user.id).catch(()=>null);
    if (!member) return interaction.reply({ content: t(locale,'moderation.ban.notFound'), ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: t(locale,'mute.notModeratable'), ephemeral: true });
    const until = new Date(Date.now() + ms).toISOString();
    await member.timeout(ms, reason).catch(()=>{});
    await silenciarUsuario(interaction.guild.id, user.id, interaction.user.id, reason, until);
    return interaction.reply({ content: t(locale,'mute.ok',{ user: user.tag, duration: durationRaw }), ephemeral: true });
  }
};
