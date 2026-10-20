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

  /**
   * Consulta inscripciones de la persona con el mismo inicio de turno.
   * @param {string} dni Identidad declarada del participante.
   * @param {string} inicioTurno Inicio ISO con fecha y zona horaria.
   * @returns {boolean} Indica si la persona ya ocupa ese horario.
   */
  existeInscripcionEnHorario(dni, inicioTurno) {
    for (const inscripcion of this.#inscripciones.values()) {
      for (const participante of inscripcion.participantes) {
        if (participante.dni === dni
          && Date.parse(inscripcion.inicioTurno) === Date.parse(inicioTurno)) {
          return true;
        }
      }
    }
    return false;
  }
}
