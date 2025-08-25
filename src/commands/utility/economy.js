import { SlashCommandBuilder } from 'discord.js';
import { obtenerBalance, transferirMonedas, reclamarDiario, rankingMonedas } from '../../modules/economia/index.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder().setName('economy').setDescription('Economía básica')
    .addSubcommand(sc=>sc.setName('balance').setDescription('Muestra tu balance o de otro').addUserOption(o=>o.setName('usuario').setDescription('Usuario')))
    .addSubcommand(sc=>sc.setName('give').setDescription('Da monedas a alguien').addUserOption(o=>o.setName('usuario').setDescription('Usuario').setRequired(true)).addIntegerOption(o=>o.setName('cantidad').setDescription('Cantidad').setRequired(true)))
    .addSubcommand(sc=>sc.setName('daily').setDescription('Reclama recompensa diaria'))
    .addSubcommand(sc=>sc.setName('leaderboard').setDescription('Top monedas')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const cfg = await obtenerConfigGuild(guildId); const locale = cfg?.locale || 'es';
    if (sub === 'balance') {
      const user = interaction.options.getUser('usuario') || interaction.user;
      const coins = await obtenerBalance(guildId, user.id);
      return interaction.reply({ content: t(locale,'economy.balance',{ user: user.tag, coins }), ephemeral: true });
    }
    if (sub === 'give') {
      const target = interaction.options.getUser('usuario');
      const amount = interaction.options.getInteger('cantidad');
      if (amount <= 0) return interaction.reply({ content: t(locale,'economy.give.invalid'), ephemeral: true });
      const ok = await transferirMonedas(guildId, interaction.user.id, target.id, amount);
      if (!ok) return interaction.reply({ content: t(locale,'economy.give.insufficient'), ephemeral: true });
      return interaction.reply({ content: t(locale,'economy.give.ok',{ amount, target: target.tag }), ephemeral: true });
    }
    if (sub === 'daily') {
      const res = await reclamarDiario(guildId, interaction.user.id, 100);
      if (!res) return interaction.reply({ content: t(locale,'economy.daily.cooldown'), ephemeral: true });
      return interaction.reply({ content: t(locale,'economy.daily.claim',{ amount: 100 }), ephemeral: true });
    }
    if (sub === 'leaderboard') {
      const rows = await rankingMonedas(guildId, 10, 0);
      if (!rows.length) return interaction.reply({ content: t(locale,'economy.leaderboard.empty'), ephemeral: true });
      const lines = rows.map((r,i)=> t(locale,'economy.leaderboard.line',{ pos: i+1, user: `<@${r.user_id}>`, coins: r.coins }));
      return interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }
  }
};
