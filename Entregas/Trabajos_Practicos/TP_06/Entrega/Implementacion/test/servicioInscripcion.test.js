import { beforeEach, describe, expect, it } from 'vitest';
import { RepositorioParqueEnMemoria } from '../src/repositorioParqueEnMemoria.js';
import { EmisorCorreoSimulado } from '../src/emisorCorreoSimulado.js';
import { ServicioInscripcion } from '../src/servicioInscripcion.js';

const ANA = { nombre: 'Ana Gómez', dni: '30111222', edad: 30 };
const JUAN = { nombre: 'Juan Pérez', dni: '28444555', edad: 34 };

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
    const solicitud = solicitudValida([ANA, JUAN]);

    // Ejecución.
    const resultado = servicio.inscribir(solicitud);

    // Comprobación.
    expect(resultado.idInscripcion).not.toBeNull();
    expect(repositorio.obtenerInscripcion(resultado.idInscripcion)).toEqual(solicitud);
  });

  it('debe enviar un correo al contacto cuando se registra la inscripción', () => {
    // Preparación.
    const solicitud = solicitudValida([ANA]);

    // Ejecución.
    servicio.inscribir(solicitud);

    // Comprobación.
    expect(emisorCorreo.mensajes()).toHaveLength(1);
    expect(emisorCorreo.mensajes()[0].destinatario).toBe('ana@ejemplo.com');
  });
  it('debe resumir actividad, turno y participantes cuando se envía la confirmación', () => {
    // Preparación.
    const solicitud = solicitudValida([ANA, JUAN]);

    // Ejecución.
    servicio.inscribir(solicitud);

    // Comprobación.
    const mensaje = emisorCorreo.mensajes()[0];
    expect(mensaje.actividad).toBe('safari');
    expect(mensaje.inicioTurno).toBe('2026-10-14T14:00:00-03:00');
    expect(mensaje.participantes).toEqual([ANA, JUAN]);
  });
  it('debe enviar un único correo cuando la inscripción es grupal', () => {
    // Preparación.
    const participantes = [
      ANA,
      JUAN,
      { nombre: 'Pedro Sosa', dni: '31222333', edad: 12 },
      { nombre: 'Lucía Ríos', dni: '45333444', edad: 9 },
      { nombre: 'Marta Díaz', dni: '27555666', edad: 61 },
    ];
    const solicitud = solicitudValida(participantes);

    // Ejecución.
    servicio.inscribir(solicitud);

    // Comprobación.
    expect(emisorCorreo.mensajes()).toHaveLength(1);
    expect(emisorCorreo.mensajes()[0].participantes).toEqual(participantes);
  });
  it('debe validar el nombre cuando se ingresan alternativas válidas e inválidas', () => {
    expect(servicio.validarNombre('María José Pérez Gómez')).toBe(true);
    expect(servicio.validarNombre('')).toBe(false);
    expect(servicio.validarNombre(' ')).toBe(false);
    expect(servicio.validarNombre(null)).toBe(false);
    expect(servicio.validarNombre('Ana123')).toBe(false);
    expect(servicio.validarNombre('Ana@')).toBe(false);
  });
  it('debe rechazar la inscripción cuando un participante tiene un nombre inválido', () => {
    // Preparación: inválido al inicio y en otro participante del grupo.
    const individual = solicitudValida([{ nombre: '', dni: '33222333', edad: 25 }]);
    const grupal = solicitudValida([
      ANA,
      { nombre: 'Ana@', dni: '33222333', edad: 25 },
    ]);

    // Ejecución y comprobación: no se registra ni se genera confirmación.
    expect(() => servicio.inscribir(individual)).toThrow(Error);
    expect(() => servicio.inscribir(grupal)).toThrow(Error);
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(0);
  });
});

function solicitudValida(participantes) {
  return {
    actividad: 'safari',
    inicioTurno: '2026-10-14T14:00:00-03:00',
    participantes,
    contacto: 'ana@ejemplo.com',
  };
}
