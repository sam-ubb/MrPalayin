// Servicio Recordatorios (español)
import { createReminder, fetchDueReminders, markReminderSent } from '../../../database/index.js';
import { pool } from '../../../database/index.js';

export async function crearRecordatorio(userId, guildId, mensaje, fechaISO) { return createReminder(userId, guildId, mensaje, fechaISO); }
export { fetchDueReminders as obtenerRecordatoriosPendientes } from '../../../database/index.js';
export { markReminderSent as marcarRecordatorioEnviado } from '../../../database/index.js';
export async function limpiarRecordatoriosAntiguos() {
  const { rowCount } = await pool.query("DELETE FROM reminders WHERE sent=true AND remind_time < NOW() - interval '30 days'");
  return rowCount;
}
