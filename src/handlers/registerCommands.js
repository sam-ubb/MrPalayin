import { REST, Routes } from 'discord.js';

export async function registerSlashCommands(clientId, token, commandsArray) {
  const rest = new REST({ version: '10' }).setToken(token);
  try {
    console.log('🔄 Registrando slash commands...');
    await rest.put(Routes.applicationCommands(clientId), { body: commandsArray });
    console.log('✅ Slash commands registrados globalmente');
  } catch (err) {
    console.error('❌ Error registrando comandos:', err);
  }
}
