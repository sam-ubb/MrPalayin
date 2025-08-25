import util from 'util';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = process.env.LOG_LEVEL || 'info';
const THRESHOLD = LEVELS[CURRENT_LEVEL] ?? 2;

function log(level, msg, meta) {
  if (LEVELS[level] > THRESHOLD) return;
  const time = new Date().toISOString();
  const base = { time, level, msg };
  if (meta) base.meta = meta instanceof Error ? { error: meta.message, stack: meta.stack } : meta;
  // Output JSON for easy parsing
  process.stdout.write(JSON.stringify(base) + '\n');
}

export const logger = {
  error: (m, meta) => log('error', m, meta),
  warn: (m, meta) => log('warn', m, meta),
  info: (m, meta) => log('info', m, meta),
  debug: (m, meta) => log('debug', m, meta),
};
