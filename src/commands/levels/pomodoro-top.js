import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import { rankingPomodoro } from '../../modules/pomodoro/index.js';
import { COLORS } from '../../config/constants.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder().setName('pomodoro-top').setDescription('Ranking de minutos de enfoque (quién agarró más la pala)').addIntegerOption(o=>o.setName('limite').setDescription('Cantidad a mostrar (default 10, máx 50)')),
  async execute(interaction) {
    await interaction.deferReply();
    const cfg = await obtenerConfigGuild(interaction.guild.id); const locale = cfg?.locale || 'es';
    const limit = Math.min(interaction.options.getInteger('limite') || 10, 50);
    const pageSize = 10;
    let page = 0;

    const all = await rankingPomodoro(interaction.guild.id, limit);
    if (!all.length) return interaction.editReply({ content: t(locale,'pomodoro.top.empty') });

    const totalPages = Math.max(1, Math.ceil(all.length / pageSize));

    const render = () => {
      const slice = all.slice(page * pageSize, page * pageSize + pageSize);
      const lines = slice.map((r,i)=> t(locale,'pomodoro.top.line',{ pos: page*pageSize + i + 1, user: `<@${r.user_id}>`, minutes: r.focus_minutes_total, sessions: r.sessions_completed }));
      const embed = new EmbedBuilder().setColor(COLORS.success).setTitle(t(locale,'pomodoro.top.title')).setDescription(lines.join('\n')).setFooter({ text: t(locale,'generic.pageFooter',{ page: page+1, pages: totalPages }) });
      const options = Array.from({ length: totalPages }).map((_,idx)=>({ label: t(locale,'generic.pageOption',{ page: idx+1 }), value: String(idx), default: idx === page }));
      const menu = new StringSelectMenuBuilder().setCustomId('pomodoro-top-pages').setPlaceholder(t(locale,'generic.changePage')).addOptions(options);
      const row = new ActionRowBuilder().addComponents(menu);
      return { embeds: [embed], components: totalPages > 1 ? [row] : [] };
    };

    const msg = await interaction.editReply(render());
    if (totalPages === 1) return;

    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60_000 });
    collector.on('collect', async sel => {
      if (sel.user.id !== interaction.user.id) return sel.reply({ content: t(locale,'generic.noInteract'), ephemeral: true });
      page = parseInt(sel.values[0],10);
      await sel.update(render());
    });
    collector.on('end', async () => { try { await msg.edit({ components: [] }); } catch {} });
  }
};
