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
  it('debe validar el DNI cuando su valor es un entero entre 1000000 y 99999999', () => {
    expect(servicio.validarDni('7500000')).toBe(true);
    expect(servicio.validarDni('99999999')).toBe(true);
    expect(servicio.validarDni('999999')).toBe(false);
    expect(servicio.validarDni('100000000')).toBe(false);
    expect(servicio.validarDni('abc')).toBe(false);
    expect(servicio.validarDni('7500000.5')).toBe(false);
  });
  it('debe rechazar la inscripción cuando un participante ya tiene otra actividad simultánea', () => {
    // Preparación: Ana ya tiene Safari y aparece segunda en el nuevo grupo.
    const primera = solicitudValida([ANA]);
    const registro = servicio.inscribir(primera);
    const segunda = {
      ...solicitudValida([JUAN, ANA]),
      actividad: 'jardineria',
    };

    // Ejecución y comprobación: rechazo del grupo completo, sin efectos nuevos.
    expect(() => servicio.inscribir(segunda)).toThrow(
      'El participante 2 ya tiene una inscripción en ese horario',
    );
    expect(repositorio.obtenerInscripcion(registro.idInscripcion)).toEqual(primera);
    expect(repositorio.obtenerInscripcion('2')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(1);
  });
  it('debe aceptar la inscripción cuando cambia la persona, el horario o la fecha', () => {
    // Preparación: Ana ya está inscripta a Safari el 14/10 a las 14:00.
    servicio.inscribir(solicitudValida([ANA]));
    const otraPersona = {
      ...solicitudValida([JUAN]),
      actividad: 'jardineria',
    };
    const otroHorario = {
      ...solicitudValida([ANA]),
      actividad: 'jardineria',
      inicioTurno: '2026-10-14T15:00:00-03:00',
    };
    const otraFecha = {
      ...solicitudValida([ANA]),
      actividad: 'jardineria',
      inicioTurno: '2026-10-15T14:00:00-03:00',
    };

    // Ejecución y comprobación: ninguna alternativa tiene simultaneidad.
    expect(() => servicio.inscribir(otraPersona)).not.toThrow();
    expect(() => servicio.inscribir(otroHorario)).not.toThrow();
    expect(() => servicio.inscribir(otraFecha)).not.toThrow();
    expect(emisorCorreo.mensajes()).toHaveLength(4);
  });
  it('debe validar la edad cuando se ingresan enteros de 0 a 120 y datos inválidos', () => {
    expect(servicio.validarEdad(0)).toBe(true);
    expect(servicio.validarEdad(120)).toBe(true);
    expect(servicio.validarEdad(-1)).toBe(false);
    expect(servicio.validarEdad(121)).toBe(false);
    expect(servicio.validarEdad(10.5)).toBe(false);
    expect(servicio.validarEdad('abc')).toBe(false);
    expect(servicio.validarEdad('12')).toBe(false);
    expect(servicio.validarEdad('')).toBe(false);
    expect(servicio.validarEdad(null)).toBe(false);
    expect(servicio.validarEdad(undefined)).toBe(false);
    expect(servicio.validarEdad(NaN)).toBe(false);
    expect(servicio.validarEdad(Infinity)).toBe(false);
  });
  it('debe rechazar la inscripción cuando un participante tiene una edad inválida', () => {
    // Preparación: el error puede estar en el segundo participante.
    const individual = solicitudValida([{ ...ANA, edad: -1 }]);
    const grupal = solicitudValida([ANA, { ...JUAN, edad: 'abc' }]);

    // Ejecución y comprobación: no se registra parcialmente ni se confirma.
    expect(() => servicio.inscribir(individual)).toThrow('La edad del participante 1');
    expect(() => servicio.inscribir(grupal)).toThrow('La edad del participante 2');
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
