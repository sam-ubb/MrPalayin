import { EmbedBuilder } from 'discord.js';
import { getGuildConfig } from '../database/index.js';
import { COLORS } from '../config/constants.js';
import { enviarBienvenida, enviarDMdeBienvenida } from '../modules/bienvenida/index.js';

export default {
  name: 'guildMemberAdd',
  async execute(member) {
    try {
      await enviarBienvenida(member);
      await enviarDMdeBienvenida(member);
    } catch (e) {
      console.error('Error en guildMemberAdd:', e);
    }
  }
};
