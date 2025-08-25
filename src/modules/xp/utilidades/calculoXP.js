// Utilidades de cálculo de XP (extraídas de messageCreate)
import { DEFAULT_XP_COOLDOWN, XP_MIN, XP_MAX } from '../../../config/constants.js';
import { getXPChannelMultiplier } from '../../../database/index.js';
import { addXP, handleLevelUp } from '../../../services/xpService.js';

const cooldownMap = new Map();

export function calcularCooldownDinamico(contenido) {
  const base = DEFAULT_XP_COOLDOWN;
  const len = contenido.trim().length;
  if (len >= 120) return base * 0.5;
  if (len >= 60) return base * 0.7;
  if (len <= 5) return base * 1.5;
  if (len <= 15) return base * 1.2;
  return base;
}

export function ajustarXP(baseXP, contenido) {
  const len = contenido.trim().length;
  if (len <= 5) return Math.floor(baseXP * 0.2);
  if (len <= 15) return Math.floor(baseXP * 0.5);
  if (len >= 160) return Math.min(baseXP + 5, Math.floor(baseXP * 1.3));
  return baseXP;
}

export function puedeGanarXP(guildId, userId) {
  const key = guildId + ':' + userId;
  const last = cooldownMap.get(key) || 0;
  const now = Date.now();
  return { permitido: true, key, last, now };
}

export function registrarUsoCooldown(key, delayMs) {
  cooldownMap.set(key, Date.now());
}

export async function procesarGananciaXP(message) {
  const dynamicCooldown = calcularCooldownDinamico(message.content);
  const key = `${message.guild.id}:${message.author.id}`;
  const last = cooldownMap.get(key) || 0;
  const now = Date.now();
  if (now - last < dynamicCooldown * 1000) return null; // no gana XP
  registrarUsoCooldown(key, dynamicCooldown * 1000);

  const randXP = XP_MIN + Math.floor(Math.random() * (XP_MAX - XP_MIN + 1));
  let xpGain = ajustarXP(randXP, message.content);
  const mult = await getXPChannelMultiplier(message.guild.id, message.channel.id);
  xpGain = Math.max(1, Math.floor(xpGain * mult));
  const progression = await addXP(message.guild.id, message.author.id, xpGain);
  await handleLevelUp(message, progression);
  return { xpGain, progression };
}
