import { randomUUID } from 'node:crypto';

/** Almacena inscripciones durante una sesión del proceso. */
export class RepositorioParqueEnMemoria {
  #inscripciones = new Map();
  #codigosResumen = new Map();
  #siguienteId = 1;
  #turnos = new Map();

  /**
   * @param {{generarCodigoResumen?: function(): string}} [opciones] Generador reemplazable del código público.
   */
  constructor({ generarCodigoResumen = randomUUID } = {}) {
    this.generarCodigoResumen = generarCodigoResumen;
  }

  /**
   * Da de alta la configuración de un turno en el almacenamiento local.
   * @param {object} turno Configuración del turno.
   * @returns {void}
   * @throws {Error} Si capacidad o inicio no son válidos.
   */
  agregarTurno(turno) {
    if (
      !Number.isInteger(turno.capacidad) ||
      turno.capacidad < 0 ||
      !Number.isFinite(Date.parse(turno.inicioTurno))
    ) {
      throw new Error('La configuración del turno no es válida');
    }
    const clave = this.#claveTurno(turno.actividad, turno.inicioTurno);
    this.#turnos.set(clave, structuredClone(turno));
  }

  /**
   * Recupera una copia del turno de la actividad y el instante indicados.
   * @param {string} actividad Identificador de actividad.
   * @param {string} inicioTurno Fecha y hora ISO.
   * @returns {object|null} Turno encontrado o ausencia del turno.
   */
  obtenerTurno(actividad, inicioTurno) {
    const turno = this.#turnos.get(this.#claveTurno(actividad, inicioTurno));
    return turno === undefined ? null : structuredClone(turno);
  }

  /**
   * Calcula los lugares libres a partir de las inscripciones guardadas.
   * @param {string} actividad Identificador de actividad.
   * @param {string} inicioTurno Fecha y hora ISO.
   * @returns {number} Lugares disponibles.
   */
  cuposDisponibles(actividad, inicioTurno) {
    const turno = this.obtenerTurno(actividad, inicioTurno);
    if (turno === null) {
      return 0;
    }
    let ocupados = 0;
    for (const inscripcion of this.#inscripciones.values()) {
      if (
        inscripcion.actividad === actividad &&
        Date.parse(inscripcion.inicioTurno) === Date.parse(inicioTurno)
      ) {
        ocupados += inscripcion.participantes.length;
      }
    }
    return turno.capacidad - ocupados;
  }

  #claveTurno(actividad, inicioTurno) {
    return `${actividad}|${Date.parse(inicioTurno)}`;
  }

  /**
   * Conserva una copia de la solicitud con un identificador local.
   * @param {object} solicitud Datos validados por el servicio.
   * @returns {string} Identificador del registro.
   */
  guardarInscripcion(solicitud) {
    const id = String(this.#siguienteId);
    this.#siguienteId += 1;
    this.#inscripciones.set(id, structuredClone(solicitud));
    this.#codigosResumen.set(id, this.generarCodigoResumen());
    return id;
  }

  /**
   * Recupera el código público no predecible asociado a una inscripción.
   * @param {string} id Identificador interno de la inscripción.
   * @returns {string|null} Código de resumen o ausencia del registro.
   */
  obtenerCodigoResumen(id) {
    return this.#codigosResumen.get(id) ?? null;
  }

  /**
   * Recupera una inscripción por el código incluido en el QR.
   * @param {string} codigoResumen Código público de resumen.
   * @returns {object|null} Inscripción encontrada o ausencia del registro.
   */
  obtenerInscripcionPorCodigoResumen(codigoResumen) {
    for (const [id, codigo] of this.#codigosResumen.entries()) {
      if (codigo === codigoResumen) {
        return this.obtenerInscripcion(id);
      }
    }
    return null;
  }

  /**
   * Recupera una copia del registro sin exponer referencias internas.
   * @param {string} id Identificador de la inscripción.
   * @returns {object|null} Inscripción encontrada o ausencia del registro.
   */
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
