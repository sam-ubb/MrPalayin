import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGuildLocale } from '../database/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cache = new Map();
const defaultLocale = 'es';

function loadLocale(locale) {
  if (cache.has(locale)) return cache.get(locale);
  const file = path.join(__dirname, '..', 'locales', `${locale}.json`);
  if (!fs.existsSync(file)) return loadLocale(defaultLocale);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  cache.set(locale, data);
  return data;
}

export function t(locale, key, vars={}) {
  const data = loadLocale(locale);
  let str = data[key] || key;
  for (const [k,v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`{${k}}`, 'g'), String(v));
  }
  return str;
}

// Determinar locale de guild (placeholder; futuro: campo en tabla guilds)
export function guildLocale(guildId) { return 'es'; }
