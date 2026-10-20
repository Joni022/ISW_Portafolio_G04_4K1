/** Almacena inscripciones durante una sesión del proceso. */
export class RepositorioParqueEnMemoria {
  #inscripciones = new Map();
  #siguienteId = 1;
  #turnos = new Map();

  /** @param {object} turno Configuración local de un turno. @returns {void} */
  agregarTurno(turno) {
    if (!Number.isInteger(turno.capacidad) || turno.capacidad < 0
        || !Number.isFinite(Date.parse(turno.inicioTurno))) {
      throw new Error('La configuración del turno no es válida');
    }
    const clave = this.#claveTurno(turno.actividad, turno.inicioTurno);
    this.#turnos.set(clave, structuredClone(turno));
  }

  /** @param {string} actividad @param {string} inicioTurno @returns {object|null} */
  obtenerTurno(actividad, inicioTurno) {
    const turno = this.#turnos.get(this.#claveTurno(actividad, inicioTurno));
    return turno === undefined ? null : structuredClone(turno);
  }

  #claveTurno(actividad, inicioTurno) {
    return `${actividad}|${Date.parse(inicioTurno)}`;
  }

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
    const inicioSolicitado = Date.parse(inicioTurno);
    for (const inscripcion of this.#inscripciones.values()) {
      if (Date.parse(inscripcion.inicioTurno) !== inicioSolicitado) {
        continue;
      }
      for (const participante of inscripcion.participantes) {
        if (participante.dni === dni) {
          return true;
        }
      }
    }
    return false;
  }
}
