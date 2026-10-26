import { describe, expect, it } from 'vitest';
import {
  validarAvanceFormulario,
  validarNavegacionFormulario,
} from '../prototipo/validacionAvanceFormulario.js';

describe('Avance del formulario de inscripción', () => {
  it('debe impedir avanzar desde fecha y horario cuando no se eligió un turno', () => {
    const mensaje = validarAvanceFormulario({ date: null, time: null }, 1, false);

    expect(mensaje).toBe('Elegí un horario para continuar.');
  });

  it('debe impedir avanzar desde participantes cuando falta un dato obligatorio', () => {
    const mensaje = validarAvanceFormulario(
      {
        participants: [{ name: 'Ana Gómez', dni: '', age: '30' }],
        count: 1,
        email: 'ana@ejemplo.com',
        accepted: true,
      },
      2,
      false,
    );

    expect(mensaje).toBe('Completá los datos obligatorios de cada participante.');
  });

  it('debe permitir avanzar desde participantes cuando los datos obligatorios están completos', () => {
    const mensaje = validarAvanceFormulario(
      {
        participants: [{ name: 'Ana Gómez', dni: '30111222', age: '30', size: 'M' }],
        count: 1,
        email: 'ana@ejemplo.com',
        accepted: true,
      },
      2,
      true,
    );

    expect(mensaje).toBeNull();
  });

  it('debe permitir volver a participantes desde fecha y horario cuando el turno ya fue elegido', () => {
    const mensaje = validarNavegacionFormulario({ date: '2026-10-25', time: '17:00' }, 1, 2, false);

    expect(mensaje).toBeNull();
  });

  it('debe impedir abrir confirmación desde actividad cuando falta elegir un turno', () => {
    const mensaje = validarNavegacionFormulario({ date: null, time: null }, 0, 3, false);

    expect(mensaje).toBe('Elegí un horario para continuar.');
  });
});
