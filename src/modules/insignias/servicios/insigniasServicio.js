// Servicio Insignias (español)
import { grantBadge, listBadges } from '../../../database/index.js';
import { pool } from '../../../database/index.js';

export async function otorgarInsignia(userId, guildId, badgeId) { return grantBadge(userId, guildId, badgeId); }
export async function listarInsignias(userId, guildId) { return listBadges(userId, guildId); }
export async function metadataInsignias(ids, locale) {
  const { rows } = await pool.query('SELECT * FROM badge_meta WHERE id = ANY($1)', [ids]);
  return rows.map(r=>({ id: r.id, nombre: locale==='en'?r.name_en:r.name_es, criterio: r.criteria }));
}
