/** Bandeja local de confirmaciones; no realiza envíos por red. */
export class EmisorCorreoSimulado {
  #bandeja = [];

  /**
   * Conserva una copia de la confirmación sin realizar envíos por red.
   * @param {object} mensaje Confirmación por conservar.
   * @returns {void}
   */
  enviar(mensaje) {
    this.#bandeja.push(structuredClone(mensaje));
  }

  /**
   * Recupera las confirmaciones sin exponer el estado interno de la bandeja.
   * @returns {object[]} Copia de los mensajes de esta sesión.
   */
  mensajes() {
    return structuredClone(this.#bandeja);
  }
}
