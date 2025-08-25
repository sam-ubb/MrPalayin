import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { obtenerLeaderboard } from '../../modules/xp/index.js';
import { COLORS } from '../../config/constants.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder().setName('leaderboard').setDescription('Top de XP del servidor (paginado).'),
  async execute(interaction) {
    await interaction.deferReply();
    const cfg = await obtenerConfigGuild(interaction.guild.id);
    const locale = cfg?.locale || 'es';
    let page = 0; // 0-based
    const pageSize = 10;
    let totalPages = 1;

    const render = async () => {
      const { rows, total } = await obtenerLeaderboard(interaction.guild.id, page * pageSize, pageSize);
      if (!rows.length) return { content: t(locale,'leaderboard.empty') };
      totalPages = Math.max(1, Math.ceil(total / pageSize));
      const lines = await Promise.all(rows.map(async (r, i) => {
        const user = await interaction.client.users.fetch(r.user_id).catch(()=>null);
        return t(locale,'leaderboard.line', { pos: page*pageSize + i + 1, user: user ? user.username : r.user_id, level: r.level, xp: r.xp });
      }));
      const embed = new EmbedBuilder()
        .setColor(COLORS.primary)
        .setTitle(t(locale,'leaderboard.title'))
        .setDescription(lines.join('\n'))
        .setFooter({ text: t(locale,'leaderboard.footer',{ page: page+1, pages: totalPages, total }) });
      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('⬅').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('next').setLabel('➡').setStyle(ButtonStyle.Secondary).setDisabled((page+1) >= totalPages)
      );
      const options = Array.from({ length: totalPages }).slice(0,25).map((_,idx)=>({ label: t(locale,'leaderboard.pageOption',{ page: idx+1 }), value: String(idx), default: idx === page }));
      const select = new StringSelectMenuBuilder().setCustomId('lb-jump').setPlaceholder(t(locale,'leaderboard.jump')).addOptions(options);
      const selectRow = new ActionRowBuilder().addComponents(select);
      return { embeds: [embed], components: [navRow, ...(totalPages>1?[selectRow]:[])] };
    };

    const msg = await interaction.editReply(await render());

    const collector = msg.createMessageComponentCollector({ time: 90_000 });
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) return i.reply({ content: t(locale,'leaderboard.noInteract'), ephemeral: true });
      if (i.isButton()) {
        if (i.customId === 'prev') page--; else if (i.customId === 'next') page++;
        await i.update(await render());
      } else if (i.isStringSelectMenu() && i.customId === 'lb-jump') {
        page = parseInt(i.values[0],10);
        await i.update(await render());
      }
    });
    collector.on('end', async () => { try { await msg.edit({ components: [] }); } catch {} });
  }
};
