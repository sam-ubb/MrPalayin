import { Collection } from 'discord.js';
import logger from '../utils/logger.js';
import { t, guildLocale } from '../services/i18n.js';

export default {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const locale = guildLocale(interaction.guild?.id);
        const keyUser = interaction.user.id;
        if (!client.rateLimiters) client.rateLimiters = {};
        const rl = client.rateLimiters.command;
        if (rl && !rl.take(keyUser)) {
          return interaction.reply({ content: t(locale,'xp.cooldown'), ephemeral: true }).catch(()=>{});
        }
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          logger.warn('Comando no encontrado', { command: interaction.commandName });
          return interaction.reply({ content: t(locale,'cmd.notfound'), ephemeral: true }).catch(()=>{});
        }
        // Rate limit per user simple (in-memory) para prevenir spam de slash
        if (!client.commandCooldowns) client.commandCooldowns = new Collection();
        const now = Date.now();
        const key = `${interaction.user.id}:${interaction.commandName}`;
        const cooldown = 3000; // 3s global simple
        if (client.commandCooldowns.has(key)) {
          const expires = client.commandCooldowns.get(key);
          if (now < expires) {
            return interaction.reply({ content: t(locale,'xp.cooldown'), ephemeral: true }).catch(()=>{});
          }
        }
        client.commandCooldowns.set(key, now + cooldown);
        setTimeout(()=>client.commandCooldowns.delete(key), cooldown);
        await command.execute(interaction, client);
      } else if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (command?.autocomplete) {
          try { await command.autocomplete(interaction, client); } catch(e){ logger.warn('Fallo autocomplete', { e: e.message }); }
        }
      } else if (interaction.isButton() || interaction.isStringSelectMenu()) {
        const keyUser = interaction.user.id;
        const rlComp = client.rateLimiters?.component;
        if (rlComp && !rlComp.take(keyUser)) return interaction.reply({ content: 'Rate limit.', ephemeral: true }).catch(()=>{});
        const customId = interaction.customId;
        // Paginaciones centralizadas
        const handler = client.paginationHandlers?.get(customId.split(':')[0]);
        if (handler) {
          await handler(interaction, client);
        } else {
          logger.debug('No hay handler para componente', { customId });
        }
      }
    } catch (err) {
      logger.error('Error en interacción', { error: err.message, stack: err.stack });
      const locale = guildLocale(interaction.guild?.id);
      const msg = t(locale,'errors.generic');
      if (interaction.deferred || interaction.replied) {
        interaction.followUp({ content: msg, ephemeral: true }).catch(()=>{});
      } else {
        interaction.reply({ content: msg, ephemeral: true }).catch(()=>{});
      }
    }
  }
};
