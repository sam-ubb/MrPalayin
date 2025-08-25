import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { listarInsignias, metadataInsignias } from '../../modules/insignias/index.js';
import { COLORS } from '../../config/constants.js';
import { guildLocale } from '../../services/i18n.js';

export default {
  data: new SlashCommandBuilder().setName('badges').setDescription('Muestra tus insignias'),
  async execute(interaction) {
    const rows = await listarInsignias(interaction.user.id, interaction.guild.id);
    if (!rows.length) return interaction.reply({ content: 'Aún no tienes badges.', ephemeral: true });
    const locale = guildLocale(interaction.guild.id);
    const ids = rows.map(r=>r.badge_id);
    const meta = await metadataInsignias(ids, locale);
    const map = new Map(meta.map(m=>[m.id, m.nombre]));
    const lines = rows.map(r=>`• ${map.get(r.badge_id) || r.badge_id} (${new Date(r.earned_at).toLocaleDateString()})`);
    const embed = new EmbedBuilder().setColor(COLORS.success).setTitle('🎖️ Tus Badges').setDescription(lines.join('\n'));
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
