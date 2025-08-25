import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { COLORS } from '../../config/constants.js';

export default {
  data: new SlashCommandBuilder().setName('userinfo').setDescription('Muestra info de tu usuario o de otro')
    .addUserOption(o => o.setName('usuario').setDescription('Usuario a inspeccionar')),
  async execute(interaction) {
    const user = interaction.options.getUser('usuario') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(()=>null);
    const roles = member ? member.roles.cache.filter(r=>r.id !== interaction.guild.id).map(r=>r.name).join(', ') || 'Sin roles' : 'N/A';
    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Creado', value: `<t:${Math.floor(user.createdTimestamp/1000)}:R>`, inline: true },
        { name: 'Roles', value: roles, inline: false }
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
