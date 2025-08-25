// Servicio Tareas (español)
import { addTask, listTasks, completeTask, deleteTask } from '../../../database/index.js';
import { pool } from '../../../database/index.js';

export async function crearTarea(userId, guildId, descripcion) { return addTask(userId, guildId, descripcion); }
export async function listarTareas(userId, guildId, incluirCompletadas=false) { return listTasks(userId, guildId, incluirCompletadas); }
export async function completarTarea(userId, guildId, id) { return completeTask(userId, guildId, id); }
export async function eliminarTarea(userId, guildId, id) { return deleteTask(userId, guildId, id); }
export async function editarTarea(userId, guildId, id, descripcion) {
  const { rowCount } = await pool.query('UPDATE tasks SET description=$1 WHERE id=$2 AND user_id=$3 AND guild_id=$4', [descripcion, id, userId, guildId]);
  return rowCount > 0;
}
