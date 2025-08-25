// Servicio de XP: encapsula lógica de cálculo y actualización
import { getUser, upsertUserXP, getGuildConfig } from '../database/index.js';
import { LEVEL_FORMULA } from '../config/constants.js';

export async function addXP(guildId, userId, baseXP) {
  const existing = await getUser(guildId, userId);
  const oldXP = existing?.xp || 0;
  const newXP = oldXP + baseXP;
  const newLevel = LEVEL_FORMULA(newXP);
  const oldLevel = existing?.level || 0;
  await upsertUserXP(guildId, userId, baseXP, newLevel, new Date().toISOString());
  return { oldXP, newXP, oldLevel, newLevel };
}

export async function handleLevelUp(message, progression) {
  const { newLevel, oldLevel, newXP } = progression;
  if (newLevel <= oldLevel) return;
  const cfg = await getGuildConfig(message.guild.id);
  const template = cfg?.levelup_message || '🎉 {user} subió a nivel {level}!';
  const levelMsg = template.replace('{user}', message.author.toString()).replace('{level}', String(newLevel)).replace('{xp}', String(newXP));
  await message.channel.send({ content: levelMsg }).catch(()=>{});
  if (cfg?.level_roles) {
    const list = Array.isArray(cfg.level_roles) ? cfg.level_roles : [];
    for (const rr of list) {
      if (rr.level === newLevel) {
        const role = message.guild.roles.cache.get(rr.roleId);
        if (role && message.member.manageable && !message.member.roles.cache.has(role.id)) {
          message.member.roles.add(role).catch(()=>{});
        }
      }
    }
  }
}
