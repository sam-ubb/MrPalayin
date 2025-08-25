import { registerSlashCommands } from '../handlers/registerCommands.js';

export default {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ Conectado como ${client.user.tag}`);
  }
};
