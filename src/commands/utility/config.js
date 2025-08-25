import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { obtenerConfigGuild, fusionarConfiguracion, modificarXP, eliminarMultiplicadorXP, listarMultiplicadoresXP, establecerPlantillaLevelUp } from '../../modules/configuracion/index.js';
import { t } from '../../services/i18n.js';

// Guardar y fusionar config
async function mergeConfig(guildId, patch) { return fusionarConfiguracion(guildId, patch); }

export default {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configura opciones del bot')
    .setDescriptionLocalizations({ 'en-US':'Configure bot options', 'en-GB':'Configure bot options', 'es-ES':'Configura opciones del bot', 'es-419':'Configura opciones del bot' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sc => sc
      .setName('welcome-channel')
      .setDescription('Define canal de bienvenida')
      .setDescriptionLocalizations({ 'en-US':'Set welcome channel', 'en-GB':'Set welcome channel', 'es-ES':'Define canal de bienvenida', 'es-419':'Define canal de bienvenida' })
      .addChannelOption(o=>o.setName('canal').setDescription('Canal').setDescriptionLocalizations({ 'en-US':'Channel', 'en-GB':'Channel', 'es-ES':'Canal', 'es-419':'Canal' }).setRequired(true)))
    .addSubcommand(sc => sc
      .setName('welcome-message')
      .setDescription('Define mensaje de bienvenida')
      .setDescriptionLocalizations({ 'en-US':'Set welcome message', 'en-GB':'Set welcome message', 'es-ES':'Define mensaje de bienvenida', 'es-419':'Define mensaje de bienvenida' })
      .addStringOption(o=>o.setName('mensaje').setDescription('Mensaje').setDescriptionLocalizations({ 'en-US':'Message', 'en-GB':'Message', 'es-ES':'Mensaje', 'es-419':'Mensaje' }).setRequired(true)))
    .addSubcommand(sc => sc
      .setName('add-level-role')
      .setDescription('Añade rol recompensa por nivel')
      .setDescriptionLocalizations({ 'en-US':'Add reward role for a level', 'en-GB':'Add reward role for a level', 'es-ES':'Añade rol recompensa por nivel', 'es-419':'Añade rol recompensa por nivel' })
      .addIntegerOption(o=>o.setName('nivel').setDescription('Nivel').setDescriptionLocalizations({ 'en-US':'Level', 'en-GB':'Level', 'es-ES':'Nivel', 'es-419':'Nivel' }).setRequired(true))
      .addRoleOption(o=>o.setName('rol').setDescription('Rol').setDescriptionLocalizations({ 'en-US':'Role', 'en-GB':'Role', 'es-ES':'Rol', 'es-419':'Rol' }).setRequired(true)))
    .addSubcommand(sc => sc
      .setName('list-level-roles')
      .setDescription('Lista roles por nivel')
      .setDescriptionLocalizations({ 'en-US':'List reward roles by level', 'en-GB':'List reward roles by level', 'es-ES':'Lista roles por nivel', 'es-419':'Lista roles por nivel' }))
    .addSubcommand(sc => sc
      .setName('remove-level-role')
      .setDescription('Elimina rol por nivel')
      .setDescriptionLocalizations({ 'en-US':'Remove reward role for a level', 'en-GB':'Remove reward role for a level', 'es-ES':'Elimina rol por nivel', 'es-419':'Elimina rol por nivel' })
      .addIntegerOption(o=>o.setName('nivel').setDescription('Nivel').setDescriptionLocalizations({ 'en-US':'Level', 'en-GB':'Level', 'es-ES':'Nivel', 'es-419':'Nivel' }).setRequired(true).setAutocomplete(true)))
    .addSubcommand(sc => sc
      .setName('xp-rate-set')
      .setDescription('Establece multiplicador de XP para canal')
      .setDescriptionLocalizations({ 'en-US':'Set XP multiplier for a channel', 'en-GB':'Set XP multiplier for a channel', 'es-ES':'Establece multiplicador de XP para canal', 'es-419':'Establece multiplicador de XP para canal' })
      .addChannelOption(o=>o.setName('canal').setDescription('Canal').setDescriptionLocalizations({ 'en-US':'Channel', 'en-GB':'Channel', 'es-ES':'Canal', 'es-419':'Canal' }).setRequired(true))
      .addNumberOption(o=>o.setName('multiplicador').setDescription('Ej: 1, 1.5, 2').setDescriptionLocalizations({ 'en-US':'Eg: 1, 1.5, 2', 'en-GB':'Eg: 1, 1.5, 2', 'es-ES':'Ej: 1, 1.5, 2', 'es-419':'Ej: 1, 1.5, 2' }).setRequired(true)))
    .addSubcommand(sc => sc
      .setName('xp-rate-remove')
      .setDescription('Quita multiplicador de canal')
      .setDescriptionLocalizations({ 'en-US':'Remove channel multiplier', 'en-GB':'Remove channel multiplier', 'es-ES':'Quita multiplicador de canal', 'es-419':'Quita multiplicador de canal' })
      .addChannelOption(o=>o.setName('canal').setDescription('Canal').setDescriptionLocalizations({ 'en-US':'Channel', 'en-GB':'Channel', 'es-ES':'Canal', 'es-419':'Canal' }).setRequired(true)))
    .addSubcommand(sc => sc
      .setName('xp-rate-list')
      .setDescription('Lista multiplicadores definidos')
      .setDescriptionLocalizations({ 'en-US':'List defined XP multipliers', 'en-GB':'List defined XP multipliers', 'es-ES':'Lista multiplicadores definidos', 'es-419':'Lista multiplicadores definidos' }))
    .addSubcommand(sc => sc
      .setName('levelup-message-set')
      .setDescription('Define plantilla level-up')
      .setDescriptionLocalizations({ 'en-US':'Set level-up template', 'en-GB':'Set level-up template', 'es-ES':'Define plantilla level-up', 'es-419':'Define plantilla level-up' })
      .addStringOption(o=>o.setName('plantilla').setDescription('Usa {user} {level} {xp}').setDescriptionLocalizations({ 'en-US':'Use {user} {level} {xp}', 'en-GB':'Use {user} {level} {xp}', 'es-ES':'Usa {user} {level} {xp}', 'es-419':'Usa {user} {level} {xp}' }).setRequired(true)))
    .addSubcommand(sc => sc
      .setName('levelup-message-get')
      .setDescription('Muestra plantilla actual')
      .setDescriptionLocalizations({ 'en-US':'Show current level-up template', 'en-GB':'Show current level-up template', 'es-ES':'Muestra plantilla actual', 'es-419':'Muestra plantilla actual' }))
    .addSubcommand(sc => sc
      .setName('locale')
      .setDescription('Define idioma del bot')
      .setDescriptionLocalizations({ 'en-US':'Set bot language', 'en-GB':'Set bot language', 'es-ES':'Define idioma del bot', 'es-419':'Define idioma del bot' })
      .addStringOption(o=>o.setName('lang').setDescription('es | en').setDescriptionLocalizations({ 'en-US':'es | en', 'en-GB':'es | en', 'es-ES':'es | en', 'es-419':'es | en' }).setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const cfgBase = await obtenerConfigGuild(guildId);
    const locale = cfgBase?.locale || 'es';

    if (sub === 'welcome-channel') {
      const channel = interaction.options.getChannel('canal');
      await mergeConfig(guildId, { welcome_channel: channel.id });
      return interaction.reply({ content: t(locale,'config.welcome.setChannel',{ channel }), ephemeral: true });
    }
    if (sub === 'welcome-message') {
      const msg = interaction.options.getString('mensaje');
      await mergeConfig(guildId, { welcome_message: msg });
      return interaction.reply({ content: t(locale,'config.welcome.setMessage'), ephemeral: true });
    }
    if (sub === 'add-level-role') {
      const level = interaction.options.getInteger('nivel');
      const role = interaction.options.getRole('rol');
      const cfg = await obtenerConfigGuild(guildId) || { level_roles: [] };
      const list = Array.isArray(cfg.level_roles) ? cfg.level_roles : [];
      if (list.find(r => r.level === level)) return interaction.reply({ content: t(locale,'config.levelrole.exists'), ephemeral: true });
      list.push({ level, roleId: role.id });
      await mergeConfig(guildId, { level_roles: list });
      return interaction.reply({ content: t(locale,'config.levelrole.added',{ role: role.name, level }), ephemeral: true });
    }
    if (sub === 'list-level-roles') {
      const cfg = await obtenerConfigGuild(guildId) || { level_roles: [] };
      const list = Array.isArray(cfg.level_roles) ? cfg.level_roles : [];
      if (!list.length) return interaction.reply({ content: t(locale,'config.levelrole.none'), ephemeral: true });
      const lines = list.sort((a,b)=>a.level-b.level).map(r=>t(locale,'config.levelrole.line',{ level: r.level, role: `<@&${r.roleId}>` }));
      return interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }
    if (sub === 'remove-level-role') {
      const level = interaction.options.getInteger('nivel');
      const cfg = await obtenerConfigGuild(guildId) || { level_roles: [] };
      let list = Array.isArray(cfg.level_roles) ? cfg.level_roles : [];
      const before = list.length;
      list = list.filter(r => r.level !== level);
      if (list.length === before) return interaction.reply({ content: t(locale,'config.levelrole.removed.missing'), ephemeral: true });
      await mergeConfig(guildId, { level_roles: list });
      return interaction.reply({ content: t(locale,'config.levelrole.removed.ok',{ level }), ephemeral: true });
    }
    if (sub === 'xp-rate-set') {
      const channel = interaction.options.getChannel('canal');
      const mult = interaction.options.getNumber('multiplicador');
      if (mult <= 0 || mult > 10) return interaction.reply({ content: t(locale,'config.xp.mult.invalid'), ephemeral: true });
      await modificarXP(guildId, channel.id, mult);
      return interaction.reply({ content: t(locale,'config.xp.mult.set',{ mult, channel }), ephemeral: true });
    }
    if (sub === 'xp-rate-remove') {
      const channel = interaction.options.getChannel('canal');
      await eliminarMultiplicadorXP(guildId, channel.id);
      return interaction.reply({ content: t(locale,'config.xp.mult.removed',{ channel }), ephemeral: true });
    }
    if (sub === 'xp-rate-list') {
      const rows = await listarMultiplicadoresXP(guildId);
      if (!rows.length) return interaction.reply({ content: t(locale,'config.xp.mult.none'), ephemeral: true });
      const lines = rows.map(r=>`<#${r.channel_id}> x${r.multiplier}`);
      return interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }
    if (sub === 'levelup-message-set') {
      const tpl = interaction.options.getString('plantilla');
      if (!tpl.includes('{user}') || !tpl.includes('{level}')) return interaction.reply({ content: t(locale,'config.levelup.tpl.invalid'), ephemeral: true });
      await establecerPlantillaLevelUp(guildId, tpl);
      return interaction.reply({ content: t(locale,'config.levelup.tpl.updated'), ephemeral: true });
    }
    if (sub === 'levelup-message-get') {
      const cfg = await obtenerConfigGuild(guildId);
      return interaction.reply({ content: cfg?.levelup_message || t(locale,'config.levelup.tpl.none'), ephemeral: true });
    }
    if (sub === 'locale') {
      const lang = interaction.options.getString('lang');
      if (!['es','en'].includes(lang)) return interaction.reply({ content: t(locale,'config.locale.unsupported'), ephemeral: true });
      await mergeConfig(guildId, { locale: lang });
      return interaction.reply({ content: t(lang,'config.locale.set',{ lang }), ephemeral: true });
    }
  },
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'nivel') return interaction.respond([]);
    const guildId = interaction.guild.id;
    const cfg = await obtenerConfigGuild(guildId) || { level_roles: [] };
    const list = Array.isArray(cfg.level_roles) ? cfg.level_roles : [];
    const locale = cfg?.locale || 'es';
    const opts = list.slice(0,25).map(r=>({ name: t(locale,'config.autocomplete.level',{ level: r.level }), value: r.level }));
    return interaction.respond(opts);
  }
};
