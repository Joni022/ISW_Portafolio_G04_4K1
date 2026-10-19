import { beforeEach, describe, expect, it } from 'vitest';
import { RepositorioParqueEnMemoria } from '../src/repositorioParqueEnMemoria.js';
import { EmisorCorreoSimulado } from '../src/emisorCorreoSimulado.js';
import { ServicioInscripcion } from '../src/servicioInscripcion.js';

describe('Inscripción a actividad', () => {
  let repositorio;
  let servicio;
  let emisorCorreo;

  beforeEach(() => {
    repositorio = new RepositorioParqueEnMemoria();
    emisorCorreo = new EmisorCorreoSimulado();
    servicio = new ServicioInscripcion(repositorio, emisorCorreo);
  });

  it('debe registrar los participantes cuando la solicitud es válida', () => {
    // Preparación.
    const solicitud = {
      actividad: 'safari',
      inicioTurno: '2026-10-14T14:00:00-03:00',
      participantes: [
        { nombre: 'Ana Gómez', dni: '30111222', edad: 30 },
        { nombre: 'Juan Pérez', dni: '28444555', edad: 34 },
      ],
      contacto: 'ana@ejemplo.com',
    };

    // Ejecución.
    const resultado = servicio.inscribir(solicitud);

    // Comprobación.
    expect(resultado.idInscripcion).not.toBeNull();
    expect(repositorio.obtenerInscripcion(resultado.idInscripcion)).toEqual(solicitud);
  });

  it('debe enviar un correo al contacto cuando se registra la inscripción', () => {
    // Preparación.
    const solicitud = {
      actividad: 'safari',
      inicioTurno: '2026-10-14T14:00:00-03:00',
      participantes: [{ nombre: 'Ana Gómez', dni: '30111222', edad: 30 }],
      contacto: 'ana@ejemplo.com',
    };

    // Ejecución.
    servicio.inscribir(solicitud);

    // Comprobación.
    expect(emisorCorreo.mensajes()).toHaveLength(1);
    expect(emisorCorreo.mensajes()[0].destinatario).toBe('ana@ejemplo.com');
  });
});
