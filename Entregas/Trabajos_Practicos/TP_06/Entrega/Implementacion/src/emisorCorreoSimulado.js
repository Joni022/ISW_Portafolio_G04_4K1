/** Bandeja local de confirmaciones; no realiza envíos por red. */
export class EmisorCorreoSimulado {
  #bandeja = [];

  /** @param {object} mensaje Confirmación por conservar. @returns {void} */
  enviar(mensaje) {
    this.#bandeja.push(structuredClone(mensaje));
  }

  /** @returns {object[]} Copia de los mensajes de esta sesión. */
  mensajes() {
    return structuredClone(this.#bandeja);
  }
}
