import { CONFIGURACION_PARQUE } from '../prototipo/configuracionParque.js';

const NOMBRES = [
  'Ana Gómez',
  'Bruno Pérez',
  'Carla Díaz',
  'Diego López',
  'Elena Torres',
  'Felipe Castro',
  'Gabriela Ríos',
  'Hugo Fernández',
  'Inés Romero',
  'Julián Sosa',
  'Laura Acosta',
  'Martín Vera',
];

/**
 * Precarga personas ficticias en un turno recién creado para la presentación.
 * Alterna turnos libres, parcialmente ocupados, con un lugar y completos.
 * No envía correos ni reemplaza registros existentes.
 * @param {object} repositorio Repositorio en memoria de esta sesión.
 * @param {object} turno Turno habilitado que se acaba de crear.
 * @param {number} hora Hora local del turno.
 * @returns {void}
 */
export function precargarInscripcionesTurno(repositorio, turno, hora) {
  const indiceActividad = Object.keys(CONFIGURACION_PARQUE.actividades).indexOf(turno.actividad);
  const ocupaciones = [0, 2, turno.capacidad - 1, turno.capacidad];
  const cantidad = ocupaciones[(hora + indiceActividad) % ocupaciones.length];
  if (cantidad === 0) {
    return;
  }
  const requiereTalle = CONFIGURACION_PARQUE.actividades[turno.actividad].requiereTalle;
  const participantes = NOMBRES.slice(0, cantidad).map((nombre, indice) => ({
    nombre,
    dni: String(90000001 + indiceActividad * 100 + indice),
    edad: 25,
    ...(requiereTalle ? { talle: 'M' } : {}),
  }));
  repositorio.guardarInscripcion({
    actividad: turno.actividad,
    inicioTurno: turno.inicioTurno,
    participantes,
    contacto: 'delivered@resend.dev',
    terminos: { actividadId: turno.actividad, aceptados: true },
  });
}
