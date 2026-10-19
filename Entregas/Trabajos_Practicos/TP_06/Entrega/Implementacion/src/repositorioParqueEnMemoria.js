/** Almacena inscripciones durante una sesión del proceso. */
export class RepositorioParqueEnMemoria {
  #inscripciones = new Map();
  #siguienteId = 1;

  /** @param {object} solicitud @returns {string} Identificador del registro. */
  guardarInscripcion(solicitud) {
    const id = String(this.#siguienteId);
    this.#siguienteId += 1;
    this.#inscripciones.set(id, structuredClone(solicitud));
    return id;
  }

  /** @param {string} id @returns {object|null} Copia de la inscripción encontrada. */
  obtenerInscripcion(id) {
    const solicitud = this.#inscripciones.get(id);
    return solicitud === undefined ? null : structuredClone(solicitud);
  }
}
