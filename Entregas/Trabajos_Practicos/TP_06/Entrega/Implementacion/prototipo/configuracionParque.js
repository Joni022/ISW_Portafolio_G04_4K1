/**
 * @typedef {object} ConfiguracionActividad
 * @property {string} nombre Nombre visible.
 * @property {number} capacidad Cantidad de lugares de referencia.
 * @property {number} edadMinima Edad mínima de participación.
 * @property {boolean} requiereTalle Indica si se solicita vestimenta.
 */

/**
 * Configuración pública del parque compartida por dominio y presentación.
 * Todos sus objetos se congelan para impedir cambios desde los consumidores.
 * @type {Readonly<{
 *   zonaHoraria: string, minutosCierreInscripcion: number, horasAperturaInscripcion: number,
 *   horaPrimerTurno: number, horaUltimoTurno: number, duracionMinutos: number,
 *   actividades: Readonly<Record<string, Readonly<ConfiguracionActividad>>>
 * }>}
 */
export const CONFIGURACION_PARQUE = Object.freeze({
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  minutosCierreInscripcion: 15,
  horasAperturaInscripcion: 24,
  horaPrimerTurno: 9,
  horaUltimoTurno: 17,
  duracionMinutos: 60,
  actividades: Object.freeze({
    safari: Object.freeze({
      nombre: 'Safari',
      capacidad: 8,
      edadMinima: 0,
      requiereTalle: false,
    }),
    tirolesa: Object.freeze({
      nombre: 'Tirolesa',
      capacidad: 10,
      edadMinima: 8,
      requiereTalle: true,
    }),
    palestra: Object.freeze({
      nombre: 'Palestra',
      capacidad: 12,
      edadMinima: 12,
      requiereTalle: true,
    }),
    jardineria: Object.freeze({
      nombre: 'Jardinería',
      capacidad: 12,
      edadMinima: 0,
      requiereTalle: false,
    }),
  }),
});
