import { updateUserActivity, getUserStreak, grantBadge } from '../database/index.js';
import { logger } from '../utils/logger.js';
import { incrementarMision } from '../modules/misiones/index.js';
import { procesarGananciaXP } from '../modules/xp/utilidades/calculoXP.js';

export default {
  name: 'messageCreate',
  async execute(message) {
    try {
      if (message.author.bot || !message.guild) return;
      const resultado = await procesarGananciaXP(message);
      if (!resultado) return; // cooldown activo, no XP
      const coinGain = Math.floor(1 + Math.random() * 2);
      const { addCoins, ensureProgressBadges } = await import('../database/index.js');
      await addCoins(message.guild.id, message.author.id, coinGain);
      await ensureProgressBadges(message.author.id, message.guild.id);
      await incrementarMision(message.author.id, message.guild.id, 'messages', 1);
      await updateUserActivity(message.author.id, message.guild.id);
      const streak = await getUserStreak(message.author.id, message.guild.id);
      if (streak === 3) await grantBadge(message.author.id, message.guild.id, 'streak_3');
    } catch (e) {
      logger.error('Error en messageCreate', { error: e.message, stack: e.stack });
    }
  }
};
