export const DEFAULT_XP_COOLDOWN = parseInt(process.env.XP_COOLDOWN_SECONDS || '60', 10);
export const XP_MIN = parseInt(process.env.XP_MIN || '15', 10);
export const XP_MAX = parseInt(process.env.XP_MAX || '25', 10);
export const LEVEL_FORMULA = xp => Math.floor(0.1 * Math.sqrt(xp)); // simple progressive formula
export const COLORS = {
  primary: 0x5865F2,
  success: 0x57F287,
  danger: 0xED4245,
  warning: 0xFEE75C,
  info: 0x3498db,
};
