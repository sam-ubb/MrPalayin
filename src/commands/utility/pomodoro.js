import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { iniciarSesionPomodoro, obtenerSesionActiva, finalizarSesion, agregarEstadistica, iniciarSesionGrupal, obtenerSesionGrupalActiva, unirParticipante, quitarParticipante, listarParticipantes } from '../../modules/pomodoro/index.js';
import { COLORS } from '../../config/constants.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pomodoro')
    .setDescription('Gestiona sesiones Pomodoro')
    .addSubcommand(sc=>sc.setName('start').setDescription('Inicia sesión individual')
      .addIntegerOption(o=>o.setName('focus').setDescription('Minutos de enfoque').setRequired(true))
      .addIntegerOption(o=>o.setName('break').setDescription('Minutos de descanso').setRequired(true))
      .addIntegerOption(o=>o.setName('cycles').setDescription('Ciclos (default 1)'))
      .addStringOption(o=>o.setName('tag').setDescription('Etiqueta ej: matematicas')))
    .addSubcommand(sc=>sc.setName('status').setDescription('Estado de tu sesión'))
    .addSubcommand(sc=>sc.setName('stop').setDescription('Finaliza tu sesión'))
    .addSubcommand(sc=>sc.setName('group-start').setDescription('Inicia Pomodoro grupal en el canal')
      .addIntegerOption(o=>o.setName('focus').setDescription('Minutos de enfoque').setRequired(true))
      .addIntegerOption(o=>o.setName('break').setDescription('Minutos de descanso').setRequired(true))
      .addIntegerOption(o=>o.setName('cycles').setDescription('Ciclos (default 1)'))
      .addStringOption(o=>o.setName('tag').setDescription('Etiqueta')))
    .addSubcommand(sc=>sc.setName('group-join').setDescription('Únete a sesión grupal activa'))
    .addSubcommand(sc=>sc.setName('group-leave').setDescription('Sal de la sesión grupal'))
    .addSubcommand(sc=>sc.setName('group-status').setDescription('Estado de la sesión grupal'))
    .addSubcommand(sc=>sc.setName('skip').setDescription('Salta a la siguiente fase'))
    .addSubcommand(sc=>sc.setName('group-skip').setDescription('Salta fase en sesión grupal (moderador o creador)')),
  async execute(interaction) {
    const cfg = await obtenerConfigGuild(interaction.guild.id); const locale = cfg?.locale || 'es';
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const focus = interaction.options.getInteger('focus');
      const br = interaction.options.getInteger('break');
      const cycles = interaction.options.getInteger('cycles') || 1;
      const tag = interaction.options.getString('tag');
      if (await obtenerSesionActiva(interaction.user.id, interaction.guild.id)) return interaction.reply({ content: t(locale,'pomodoro.already'), ephemeral: true });
      await iniciarSesionPomodoro(interaction.user.id, interaction.guild.id, focus, br, cycles, tag);
      return interaction.reply({ content: t(locale,'pomodoro.started',{ tag: tag||t(locale,'pomodoro.noTag'), focus, br, cycles }), ephemeral: true });
    }

    if (sub === 'status') {
      const sess = await obtenerSesionActiva(interaction.user.id, interaction.guild.id);
      if (!sess) return interaction.reply({ content: t(locale,'pomodoro.none'), ephemeral: true });
      const msLeft = new Date(sess.phase_end).getTime() - Date.now();
      const mins = Math.max(0, Math.ceil(msLeft/60000));
      return interaction.reply({ content: t(locale,'pomodoro.status',{ phase: sess.phase, cycle: sess.current_cycle, cycles: sess.cycles, mins }), ephemeral: true });
    }

    if (sub === 'stop') {
      const sess = await obtenerSesionActiva(interaction.user.id, interaction.guild.id);
      if (!sess) return interaction.reply({ content: t(locale,'pomodoro.none'), ephemeral: true });
      await finalizarSesion(sess.id);
      return interaction.reply({ content: t(locale,'pomodoro.stopped'), ephemeral: true });
    }

    if (sub === 'group-start') {
      const focus = interaction.options.getInteger('focus');
      const br = interaction.options.getInteger('break');
      const cycles = interaction.options.getInteger('cycles') || 1;
      const tag = interaction.options.getString('tag');
      if (await obtenerSesionGrupalActiva(interaction.guild.id, interaction.channel.id)) return interaction.reply({ content: t(locale,'pomodoro.group.exists'), ephemeral: true });
      await iniciarSesionGrupal(interaction.guild.id, interaction.channel.id, interaction.user.id, focus, br, cycles, tag);
      return interaction.reply({ content: t(locale,'pomodoro.group.started',{ tag: tag||t(locale,'pomodoro.noTag'), focus, br, cycles }) });
    }

    if (sub === 'group-join') {
      const sess = await obtenerSesionGrupalActiva(interaction.guild.id, interaction.channel.id);
      if (!sess) return interaction.reply({ content: t(locale,'pomodoro.group.none'), ephemeral: true });
      await unirParticipante(sess.id, interaction.user.id);
      return interaction.reply({ content: t(locale,'pomodoro.group.joined'), ephemeral: true });
    }

    if (sub === 'group-leave') {
      const sess = await obtenerSesionGrupalActiva(interaction.guild.id, interaction.channel.id);
      if (!sess) return interaction.reply({ content: t(locale,'pomodoro.group.none'), ephemeral: true });
      await quitarParticipante(sess.id, interaction.user.id);
      return interaction.reply({ content: t(locale,'pomodoro.group.left'), ephemeral: true });
    }

    if (sub === 'group-status') {
      const sess = await obtenerSesionGrupalActiva(interaction.guild.id, interaction.channel.id);
      if (!sess) return interaction.reply({ content: t(locale,'pomodoro.group.none'), ephemeral: true });
      const users = await listarParticipantes(sess.id);
      const msLeft = new Date(sess.phase_end).getTime() - Date.now();
      const mins = Math.max(0, Math.ceil(msLeft/60000));
      return interaction.reply({ content: t(locale,'pomodoro.group.status',{ phase: sess.phase, cycle: sess.current_cycle, cycles: sess.cycles, mins, participants: users.length }), ephemeral: true });
    }

    if (sub === 'skip') {
      const sess = await obtenerSesionActiva(interaction.user.id, interaction.guild.id);
      if (!sess) return interaction.reply({ content: t(locale,'pomodoro.none'), ephemeral: true });
      if (sess.phase === 'focus') {
        await finalizarSesion(sess.id);
        await agregarEstadistica(sess.user_id, sess.guild_id, sess.focus_minutes);
        return interaction.reply({ content: t(locale,'pomodoro.skip.focus'), ephemeral: true });
      } else if (sess.phase === 'break') {
        await finalizarSesion(sess.id);
        return interaction.reply({ content: t(locale,'pomodoro.skip.break'), ephemeral: true });
      }
      return interaction.reply({ content: t(locale,'pomodoro.alreadyEnded'), ephemeral: true });
    }

    if (sub === 'group-skip') {
      const sess = await obtenerSesionGrupalActiva(interaction.guild.id, interaction.channel.id);
      if (!sess) return interaction.reply({ content: t(locale,'pomodoro.group.none'), ephemeral: true });
      if (sess.creator_id !== interaction.user.id && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: t(locale,'pomodoro.group.notAllowed'), ephemeral: true });
      }
      if (sess.phase === 'focus') {
        const participants = await listarParticipantes(sess.id);
        for (const uid of participants) await agregarEstadistica(uid, sess.guild_id, sess.focus_minutes);
      }
      await finalizarSesion(sess.id);
      return interaction.reply({ content: t(locale,'pomodoro.group.skip'), ephemeral: true });
    }
  }
};
