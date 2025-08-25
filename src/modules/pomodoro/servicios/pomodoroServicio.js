// Servicio Pomodoro (español)
import {
  startPomodoroSession,
  getActivePomodoro,
  finishPomodoro as dbFinishPomodoro,
  addPomodoroStats as dbAddPomodoroStats,
  startGroupPomodoro,
  getActiveGroupPomodoro,
  addGroupParticipant,
  removeGroupParticipant,
  getGroupParticipants,
  updatePomodoroPhase,
  advancePomodoroCycle,
  fetchDuePomodoroSessions,
  fetchDueGroupPomodoroSessions,
  updateGroupPomodoroPhase,
  advanceGroupPomodoroCycle,
  finishGroupPomodoro,
  topPomodoroStats
} from '../../../database/index.js';

// Re-export raw DB functions with Spanish naming / wrappers where needed
export { topPomodoroStats as rankingPomodoro } from '../../../database/index.js';

// Individual
export async function iniciarSesionPomodoro(usuarioId, guildId, focoMin, descansoMin, ciclos, tag) {
  // (tag se ignora en DB actual si la función base no lo acepta todavía)
  return startPomodoroSession(usuarioId, guildId, focoMin, descansoMin, ciclos, tag);
}
export async function obtenerSesionActiva(usuarioId, guildId) { return getActivePomodoro(usuarioId, guildId); }
export async function finalizarSesion(id) { return dbFinishPomodoro(id); }
export async function agregarEstadistica(usuarioId, guildId, focoMin) { return dbAddPomodoroStats(usuarioId, guildId, focoMin); }

// Grupal
export async function iniciarSesionGrupal(guildId, canalId, creadorId, focoMin, descansoMin, ciclos, tag) {
  return startGroupPomodoro(guildId, canalId, creadorId, focoMin, descansoMin, ciclos, tag);
}
export async function obtenerSesionGrupalActiva(guildId, canalId) { return getActiveGroupPomodoro(guildId, canalId); }
export async function unirParticipante(sessionId, userId) { return addGroupParticipant(sessionId, userId); }
export async function quitarParticipante(sessionId, userId) { return removeGroupParticipant(sessionId, userId); }
export async function listarParticipantes(sessionId) { return getGroupParticipants(sessionId); }
export async function finalizarSesionGrupal(id) { return finishGroupPomodoro(id); }

// Polling helpers re-export (mantener nombres para integrarse con index.js por ahora)
export { fetchDuePomodoroSessions, fetchDueGroupPomodoroSessions, updatePomodoroPhase, advancePomodoroCycle, updateGroupPomodoroPhase, advanceGroupPomodoroCycle };

