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
  let ahora;

  beforeEach(() => {
    repositorio = new RepositorioParqueEnMemoria();
    // Catálogo local aislado por test: solo existen los turnos dados de alta.
    for (const [actividad, capacidad] of [
      ['safari', 8], ['jardineria', 12], ['palestra', 12], ['tirolesa', 10],
    ]) {
      for (const inicioTurno of [
        '2026-10-14T14:00:00-03:00',
        '2026-10-14T15:00:00-03:00',
        '2026-10-15T14:00:00-03:00',
      ]) {
        repositorio.agregarTurno({ actividad, inicioTurno, capacidad, habilitado: true });
      }
    }
    emisorCorreo = new EmisorCorreoSimulado();
    ahora = new Date('2026-10-14T10:00:00-03:00');
    servicio = new ServicioInscripcion(repositorio, emisorCorreo, {
      reloj: { ahora: () => new Date(ahora) },
    });
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
      terminos: { actividadId: 'jardineria', aceptados: true },
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
      terminos: { actividadId: 'jardineria', aceptados: true },
    };
    const otroHorario = {
      ...solicitudValida([ANA]),
      actividad: 'jardineria',
      terminos: { actividadId: 'jardineria', aceptados: true },
      inicioTurno: '2026-10-14T15:00:00-03:00',
    };
    const otraFecha = {
      ...solicitudValida([ANA]),
      actividad: 'jardineria',
      terminos: { actividadId: 'jardineria', aceptados: true },
      inicioTurno: '2026-10-15T14:00:00-03:00',
    };

    // Ejecución y comprobación: ninguna alternativa tiene simultaneidad.
    expect(() => servicio.inscribir(otraPersona)).not.toThrow();
    expect(() => servicio.inscribir(otroHorario)).not.toThrow();
    ahora = new Date('2026-10-14T14:00:00-03:00');
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
  it('debe rechazar la inscripción cuando un participante tiene un DNI inválido', () => {
    // Preparación: cada solicitud altera solamente el DNI.
    const individual = solicitudValida([{ ...ANA, dni: '999999' }]);
    const grupal = solicitudValida([ANA, { ...JUAN, dni: '1234abc' }]);

    // Ejecución y comprobación.
    expect(() => servicio.inscribir(individual)).toThrow('El DNI del participante 1');
    expect(() => servicio.inscribir(grupal)).toThrow('El DNI del participante 2');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(0);
  });
  it('debe rechazar la inscripción cuando faltan participantes o su estructura es inválida', () => {
    // Preparación y comprobación del límite público, sin conversiones implícitas.
    expect(() => servicio.inscribir(solicitudValida([]))).toThrow('al menos un participante');
    expect(() => servicio.inscribir(solicitudValida(null))).toThrow('al menos un participante');
    expect(() => servicio.inscribir(solicitudValida([ANA, null]))).toThrow('participante 2');
    expect(() => servicio.inscribir(null)).toThrow('al menos un participante');
    expect(() => servicio.inscribir()).toThrow('al menos un participante');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(0);
  });
  it('debe rechazar la inscripción cuando la actividad no existe', () => {
    const solicitud = { ...solicitudValida([ANA]), actividad: 'desconocida' };

    expect(() => servicio.inscribir(solicitud)).toThrow('La actividad no existe');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(0);
  });
  it('debe aplicar la edad mínima cuando se solicita Palestra', () => {
    const menor = {
      ...solicitudValida([ANA, { ...JUAN, edad: 11, talle: 'M' }]),
      actividad: 'palestra',
      terminos: { actividadId: 'palestra', aceptados: true },
    };
    const limite = {
      ...solicitudValida([{ ...JUAN, edad: 12, talle: 'M' }]),
      actividad: 'palestra',
      terminos: { actividadId: 'palestra', aceptados: true },
    };
    menor.participantes[0] = { ...ANA, talle: 'S' };

    expect(() => servicio.inscribir(menor)).toThrow('La edad mínima para palestra es 12');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(0);
    expect(() => servicio.inscribir(limite)).not.toThrow();
  });
  it('debe aplicar la edad mínima cuando se solicita Tirolesa', () => {
    const menor = {
      ...solicitudValida([{ ...ANA, edad: 7, talle: 'XS' }]),
      actividad: 'tirolesa',
      terminos: { actividadId: 'tirolesa', aceptados: true },
    };
    const limite = {
      ...solicitudValida([{ ...ANA, edad: 8, talle: 'XS' }]),
      actividad: 'tirolesa',
      terminos: { actividadId: 'tirolesa', aceptados: true },
    };

    expect(() => servicio.inscribir(menor)).toThrow('La edad mínima para tirolesa es 8');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(0);
    expect(() => servicio.inscribir(limite)).not.toThrow();
  });
  it('debe aceptar todas las edades válidas cuando la actividad es Safari o Jardinería', () => {
    const safari = solicitudValida([{ ...ANA, edad: 0 }, { ...JUAN, edad: 120 }]);
    const jardineria = {
      ...solicitudValida([{ ...ANA, edad: 0 }]),
      actividad: 'jardineria',
      terminos: { actividadId: 'jardineria', aceptados: true },
      inicioTurno: '2026-10-14T15:00:00-03:00',
    };

    expect(() => servicio.inscribir(safari)).not.toThrow();
    expect(() => servicio.inscribir(jardineria)).not.toThrow();
    expect(emisorCorreo.mensajes()).toHaveLength(2);
  });
  it('debe rechazar la inscripción cuando no se aceptan los términos de la actividad', () => {
    const safari = solicitudValida([ANA]);
    safari.terminos.aceptados = false;
    const palestra = solicitudValida([{ ...ANA, talle: 'M' }], 'palestra');
    delete palestra.terminos;
    const tirolesa = solicitudValida([{ ...ANA, talle: 'M' }], 'tirolesa');
    tirolesa.terminos.aceptados = 'true';
    const jardineria = solicitudValida([ANA], 'jardineria');
    jardineria.terminos.aceptados = false;

    expect(() => servicio.inscribir(safari)).toThrow('Debés aceptar los términos');
    expect(() => servicio.inscribir(palestra)).toThrow('Debés aceptar los términos');
    expect(() => servicio.inscribir(tirolesa)).toThrow('Debés aceptar los términos');
    expect(() => servicio.inscribir(jardineria)).toThrow('Debés aceptar los términos');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(0);
  });
  it('debe rechazar la inscripción cuando los términos aceptados son de otra actividad', () => {
    const solicitud = solicitudValida([ANA]);
    solicitud.terminos.actividadId = 'jardineria';

    expect(() => servicio.inscribir(solicitud)).toThrow('Debés aceptar los términos');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(0);
  });
  it('debe aceptar Safari cuando se aceptan sus términos y condiciones', () => {
    const solicitud = solicitudValida([ANA]);

    const resultado = servicio.inscribir(solicitud);

    expect(repositorio.obtenerInscripcion(resultado.idInscripcion)).toEqual(solicitud);
    expect(emisorCorreo.mensajes()).toHaveLength(1);
  });
  it('debe rechazar la inscripción cuando falta el talle en Palestra o Tirolesa', () => {
    const palestra = solicitudValida([ANA], 'palestra');
    const tirolesa = solicitudValida([{ ...ANA, talle: 'M' }, JUAN], 'tirolesa');

    expect(() => servicio.inscribir(palestra)).toThrow('talle válido para el participante 1');
    expect(() => servicio.inscribir(tirolesa)).toThrow('talle válido para el participante 2');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(0);
  });
  it('debe rechazar la inscripción cuando el talle indicado no pertenece a XS–XXL', () => {
    const solicitud = solicitudValida([{ ...ANA, talle: 'XXXL' }], 'palestra');

    expect(() => servicio.inscribir(solicitud)).toThrow('talle válido');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(0);
  });
  it('debe aceptar la inscripción cuando Safari o Jardinería no indican talle', () => {
    const safari = solicitudValida([ANA]);
    const jardineria = solicitudValida([JUAN], 'jardineria');

    expect(() => servicio.inscribir(safari)).not.toThrow();
    expect(() => servicio.inscribir(jardineria)).not.toThrow();
    expect(emisorCorreo.mensajes()).toHaveLength(2);
  });
  it('debe aceptar la inscripción cuando Palestra o Tirolesa reciben talles válidos', () => {
    const participantes = [
      { ...ANA, talle: 'XS' },
      { ...JUAN, talle: 'S' },
      { nombre: 'Pedro Sosa', dni: '31222333', edad: 22, talle: 'M' },
      { nombre: 'Lucía Ríos', dni: '45333444', edad: 19, talle: 'L' },
      { nombre: 'Marta Díaz', dni: '27555666', edad: 61, talle: 'XL' },
      { nombre: 'José Vera', dni: '31555666', edad: 26, talle: 'XXL' },
    ];
    const palestra = solicitudValida(participantes, 'palestra');
    const tirolesa = solicitudValida(participantes, 'tirolesa');
    tirolesa.inicioTurno = '2026-10-14T15:00:00-03:00';

    expect(() => servicio.inscribir(palestra)).not.toThrow();
    expect(() => servicio.inscribir(tirolesa)).not.toThrow();
    expect(emisorCorreo.mensajes()).toHaveLength(2);
  });
  it('debe rechazar la inscripción cuando el turno no existe o no está habilitado', () => {
    const inexistente = solicitudValida([ANA]);
    inexistente.inicioTurno = '2026-10-14T16:00:00-03:00';
    const deshabilitado = solicitudValida([ANA]);
    repositorio.agregarTurno({
      actividad: 'safari', inicioTurno: deshabilitado.inicioTurno,
      capacidad: 8, habilitado: false,
    });

    expect(() => servicio.inscribir(inexistente)).toThrow('El turno no existe');
    expect(() => servicio.inscribir(deshabilitado)).toThrow('no está habilitado');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(0);
  });
  it('debe rechazar el grupo completo cuando los cupos disponibles son insuficientes', () => {
    const primera = solicitudValida([ANA]);
    repositorio.agregarTurno({
      actividad: 'safari', inicioTurno: primera.inicioTurno, capacidad: 2, habilitado: true,
    });
    const registro = servicio.inscribir(primera);
    const grupo = solicitudValida([
      JUAN, { nombre: 'Pedro Sosa', dni: '31222333', edad: 22 },
    ]);

    expect(() => servicio.inscribir(grupo)).toThrow('No hay cupos suficientes');
    expect(repositorio.obtenerInscripcion(registro.idInscripcion)).toEqual(primera);
    expect(repositorio.obtenerInscripcion('2')).toBeNull();
    expect(repositorio.cuposDisponibles('safari', primera.inicioTurno)).toBe(1);
    expect(emisorCorreo.mensajes()).toHaveLength(1);
  });
  it('debe descontar exactamente los participantes cuando se registra el grupo', () => {
    const solicitud = solicitudValida([ANA, JUAN]);
    const disponibles = repositorio.cuposDisponibles('safari', solicitud.inicioTurno);

    const resultado = servicio.inscribir(solicitud);

    expect(disponibles).toBe(8);
    expect(repositorio.cuposDisponibles('safari', solicitud.inicioTurno)).toBe(6);
    expect(repositorio.obtenerInscripcion(resultado.idInscripcion).participantes).toEqual([ANA, JUAN]);
    expect(repositorio.cuposDisponibles('jardineria', solicitud.inicioTurno)).toBe(12);
    expect(repositorio.cuposDisponibles('safari', '2026-10-14T15:00:00-03:00')).toBe(8);
  });
  it('debe aceptar el grupo cuando la cantidad coincide con los cupos disponibles', () => {
    const solicitud = solicitudValida([ANA, JUAN]);
    repositorio.agregarTurno({
      actividad: 'safari', inicioTurno: solicitud.inicioTurno, capacidad: 2, habilitado: true,
    });

    const resultado = servicio.inscribir(solicitud);

    expect(repositorio.obtenerInscripcion(resultado.idInscripcion)).toEqual(solicitud);
    expect(repositorio.cuposDisponibles('safari', solicitud.inicioTurno)).toBe(0);
    expect(emisorCorreo.mensajes()).toHaveLength(1);
  });
  it('debe rechazar la inscripción cuando el parque cierra por lunes, Navidad o Año Nuevo', () => {
    const lunes = solicitudValida([ANA]);
    lunes.inicioTurno = '2026-10-19T14:00:00-03:00';
    const navidad = solicitudValida([ANA]);
    navidad.inicioTurno = '2026-12-25T14:00:00-03:00';
    const anioNuevo = solicitudValida([ANA]);
    anioNuevo.inicioTurno = '2027-01-01T14:00:00-03:00';
    repositorio.agregarTurno({
      actividad: 'safari', inicioTurno: lunes.inicioTurno, capacidad: 8, habilitado: true,
    });
    repositorio.agregarTurno({
      actividad: 'safari', inicioTurno: navidad.inicioTurno, capacidad: 8, habilitado: true,
    });
    repositorio.agregarTurno({
      actividad: 'safari', inicioTurno: anioNuevo.inicioTurno, capacidad: 8, habilitado: true,
    });

    expect(() => servicio.inscribir(lunes)).toThrow('El parque está cerrado');
    expect(() => servicio.inscribir(navidad)).toThrow('El parque está cerrado');
    expect(() => servicio.inscribir(anioNuevo)).toThrow('El parque está cerrado');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(0);
    expect(repositorio.cuposDisponibles('safari', lunes.inicioTurno)).toBe(8);
  });
  it('debe rechazar el turno cuando inicia fuera de las horas enteras de 09 a 17', () => {
    const temprano = solicitudValida([ANA]);
    temprano.inicioTurno = '2026-10-14T08:00:00-03:00';
    const tarde = solicitudValida([ANA]);
    tarde.inicioTurno = '2026-10-14T18:00:00-03:00';
    const intermedio = solicitudValida([ANA]);
    intermedio.inicioTurno = '2026-10-14T14:30:00-03:00';
    repositorio.agregarTurno({
      actividad: 'safari', inicioTurno: temprano.inicioTurno, capacidad: 8, habilitado: true,
    });
    repositorio.agregarTurno({
      actividad: 'safari', inicioTurno: tarde.inicioTurno, capacidad: 8, habilitado: true,
    });
    repositorio.agregarTurno({
      actividad: 'safari', inicioTurno: intermedio.inicioTurno, capacidad: 8, habilitado: true,
    });

    expect(() => servicio.inscribir(temprano)).toThrow('entre las 09 y las 17');
    expect(() => servicio.inscribir(tarde)).toThrow('entre las 09 y las 17');
    expect(() => servicio.inscribir(intermedio)).toThrow('hora entera');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(emisorCorreo.mensajes()).toHaveLength(0);
  });
  it('debe aceptar la inscripción cuando faltan exactamente quince minutos para el turno', () => {
    ahora = new Date('2026-10-14T13:45:00-03:00');
    const solicitud = solicitudValida([ANA]);

    const resultado = servicio.inscribir(solicitud);

    expect(repositorio.obtenerInscripcion(resultado.idInscripcion)).toEqual(solicitud);
    expect(emisorCorreo.mensajes()).toHaveLength(1);
  });
  it('debe rechazar la inscripción cuando faltan menos de quince minutos para el turno', () => {
    ahora = new Date('2026-10-14T13:45:00.001-03:00');
    const solicitud = solicitudValida([ANA]);

    expect(() => servicio.inscribir(solicitud)).toThrow('fuera de la ventana');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(repositorio.cuposDisponibles('safari', solicitud.inicioTurno)).toBe(8);
    expect(emisorCorreo.mensajes()).toHaveLength(0);
  });
  it('debe aceptar la inscripción cuando faltan exactamente veinticuatro horas para el turno', () => {
    ahora = new Date('2026-10-14T14:00:00-03:00');
    const solicitud = solicitudValida([ANA]);
    solicitud.inicioTurno = '2026-10-15T14:00:00-03:00';

    const resultado = servicio.inscribir(solicitud);

    expect(repositorio.obtenerInscripcion(resultado.idInscripcion)).toEqual(solicitud);
    expect(emisorCorreo.mensajes()).toHaveLength(1);
  });
  it('debe rechazar la inscripción cuando faltan más de veinticuatro horas para el turno', () => {
    ahora = new Date('2026-10-14T13:59:59.999-03:00');
    const solicitud = solicitudValida([ANA]);
    solicitud.inicioTurno = '2026-10-15T14:00:00-03:00';

    expect(() => servicio.inscribir(solicitud)).toThrow('fuera de la ventana');
    expect(repositorio.obtenerInscripcion('1')).toBeNull();
    expect(repositorio.cuposDisponibles('safari', solicitud.inicioTurno)).toBe(8);
    expect(emisorCorreo.mensajes()).toHaveLength(0);
  });
  it('debe enviar cada confirmación al contacto cuando las solicitudes informan correos distintos', () => {
    const primera = solicitudValida([ANA]);
    primera.contacto = 'responsable.uno@ejemplo.com';
    const segunda = solicitudValida([JUAN]);
    segunda.contacto = 'responsable.dos@ejemplo.com';

    servicio.inscribir(primera);
    servicio.inscribir(segunda);

    expect(emisorCorreo.mensajes()).toHaveLength(2);
    expect(emisorCorreo.mensajes()[0].destinatario).toBe(primera.contacto);
    expect(emisorCorreo.mensajes()[1].destinatario).toBe(segunda.contacto);
  });
});

function solicitudValida(participantes, actividad = 'safari') {
  return {
    actividad,
    terminos: { actividadId: actividad, aceptados: true },
    inicioTurno: '2026-10-14T14:00:00-03:00',
    participantes,
    contacto: 'ana@ejemplo.com',
  };
}
