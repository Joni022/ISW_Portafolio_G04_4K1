import { describe, expect, it } from 'vitest';
import { eliminarParticipante } from '../prototipo/participantes.js';

describe('Participantes de la inscripción', () => {
  it('debe eliminar un participante intermedio y conservar los demás en su orden', () => {
    const participantes = [
      { nombre: 'Ana Gómez' },
      { nombre: 'Bruno Díaz' },
      { nombre: 'Carla Paz' },
    ];

    const restantes = eliminarParticipante(participantes, 1);

    expect(restantes).toEqual([{ nombre: 'Ana Gómez' }, { nombre: 'Carla Paz' }]);
    expect(participantes).toHaveLength(3);
  });
});
