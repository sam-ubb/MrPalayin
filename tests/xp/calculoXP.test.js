import { describe, it, expect } from 'vitest';
import { procesarGananciaXP } from '../../src/modules/xp/utilidades/calculoXP.js';

function fakeMessage(content='hola', guild='g1', user='u1', channel='c1') {
  return { content, guild:{ id: guild }, author:{ id: user, bot:false }, channel:{ id: channel } };
}

describe('XP - procesarGananciaXP', () => {
  it('otorga XP primera vez y respeta cooldown', async () => {
    const r1 = await procesarGananciaXP(fakeMessage('mensaje suficientemente largo para XP'));
    expect(r1).not.toBeNull();
    const r2 = await procesarGananciaXP(fakeMessage('mensaje suficientemente largo para XP'));
    expect(r2).toBeNull();
  });
});
