import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { crearTarea, listarTareas, completarTarea, eliminarTarea, editarTarea } from '../../modules/tareas/index.js';
import { COLORS } from '../../config/constants.js';
import { t } from '../../services/i18n.js';
import { obtenerConfigGuild } from '../../modules/configuracion/index.js';

export default {
  data: new SlashCommandBuilder().setName('task').setDescription('Gestiona tus tareas')
    .addSubcommand(sc=>sc.setName('add').setDescription('Añade tarea').addStringOption(o=>o.setName('descripcion').setDescription('Descripción').setRequired(true)))
    .addSubcommand(sc=>sc.setName('list').setDescription('Lista tareas pendientes'))
    .addSubcommand(sc=>sc.setName('listall').setDescription('Lista todas las tareas (incluye completadas)'))
    .addSubcommand(sc=>sc.setName('done').setDescription('Marca tarea como completada').addIntegerOption(o=>o.setName('id').setDescription('ID tarea').setRequired(true).setAutocomplete(true)))
    .addSubcommand(sc=>sc.setName('delete').setDescription('Elimina tarea').addIntegerOption(o=>o.setName('id').setDescription('ID tarea').setRequired(true).setAutocomplete(true)))
    .addSubcommand(sc=>sc.setName('edit').setDescription('Edita descripción').addIntegerOption(o=>o.setName('id').setDescription('ID tarea').setRequired(true).setAutocomplete(true)).addStringOption(o=>o.setName('descripcion').setDescription('Nueva descripción').setRequired(true))),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== 'id') return interaction.respond([]);
    const rows = await listarTareas(interaction.user.id, interaction.guild.id, true);
    const filtered = rows.filter(r=>!r.completed).slice(0,25);
    return interaction.respond(filtered.map(r=>({ name: `#${r.id} ${r.description.slice(0,50)}`, value: r.id })));    
  },
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;
    const cfg = await obtenerConfigGuild(guildId); const locale = cfg?.locale || 'es';

    if (sub === 'add') {
      const desc = interaction.options.getString('descripcion');
      const tRow = await crearTarea(userId, guildId, desc);
      return interaction.reply({ content: t(locale,'tasks.added',{ id: tRow.id }), ephemeral: true });
    }
    if (sub === 'list' || sub === 'listall') {
      const rows = await listarTareas(userId, guildId, sub === 'listall');
      if (!rows.length) return interaction.reply({ content: t(locale,'tasks.empty'), ephemeral: true });
      const lines = rows.map(r=> t(locale,'tasks.line',{ id: r.id, status: r.completed ? '✅' : '🔸', desc: r.description }));
      const embed = new EmbedBuilder().setColor(COLORS.primary).setTitle(t(locale,'tasks.title')).setDescription(lines.join('\n'));
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    if (sub === 'done') {
      const id = interaction.options.getInteger('id');
      const ok = await completarTarea(userId, guildId, id);
      return interaction.reply({ content: ok ? t(locale,'tasks.done') : t(locale,'tasks.notfoundOrDone'), ephemeral: true });
    }
    if (sub === 'delete') {
      const id = interaction.options.getInteger('id');
      const ok = await eliminarTarea(userId, guildId, id);
      return interaction.reply({ content: ok ? t(locale,'tasks.deleted') : t(locale,'tasks.notfound'), ephemeral: true });
    }
    if (sub === 'edit') {
      const id = interaction.options.getInteger('id');
      const desc = interaction.options.getString('descripcion');
      const ok = await editarTarea(userId, guildId, id, desc);
      return interaction.reply({ content: ok? t(locale,'tasks.edited') : t(locale,'tasks.notfound'), ephemeral: true });
    }
  }
};
