/**
 * Adaptador del reloj real; el servicio puede recibir otro reloj en las pruebas.
 * @type {{ahora: function(): Date}}
 */
export const relojSistema = Object.freeze({
  /** Devuelve el instante actual del sistema. @returns {Date} Instante actual. */
  ahora() {
    return new Date();
  },
});
