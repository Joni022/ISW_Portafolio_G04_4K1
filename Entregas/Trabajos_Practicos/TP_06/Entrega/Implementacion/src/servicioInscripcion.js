const CARACTERES_INVALIDOS_NOMBRE = /[^\p{L} ]/u;

/** Coordina el caso de uso de inscripción. */
export class ServicioInscripcion {
  /**
   * @param {object} repositorio Almacenamiento de inscripciones.
   * @param {object} emisorCorreo Bandeja de confirmaciones.
   */
  constructor(repositorio, emisorCorreo) {
    this.repositorio = repositorio;
    this.emisorCorreo = emisorCorreo;
  }

  /**
   * @param {object} solicitud Datos de actividad, turno, participantes y contacto.
   * @returns {{idInscripcion: string}} Identificador del registro.
   * @throws {Error} ErrorValidacion con campo y número de participante.
   */
  inscribir(solicitud) {
    this.#validarNombres(solicitud.participantes);
    this.#validarDisponibilidad(solicitud);

    const idInscripcion = this.repositorio.guardarInscripcion(solicitud);
    this.emisorCorreo.enviar(this.#confirmacionDe(solicitud));
    return { idInscripcion };
  }

  /**
   * Comprueba el formato del nombre sin registrar ni enviar confirmaciones.
   * @param {unknown} nombre Dato recibido.
   * @returns {boolean} Indica si es un nombre válido.
   */
  validarNombre(nombre) {
    return typeof nombre === 'string'
      && nombre.trim().length > 0
      && !CARACTERES_INVALIDOS_NOMBRE.test(nombre);
  }

  #validarNombres(participantes) {
    for (const [indice, participante] of participantes.entries()) {
      if (!this.validarNombre(participante.nombre)) {
        const error = new Error(`El nombre del participante ${indice + 1} no es válido`);
        error.name = 'ErrorValidacion';
        error.campo = 'nombre';
        error.participante = indice + 1;
        throw error;
      }
    }
  }

  #validarDisponibilidad(solicitud) {
    for (const [indice, participante] of solicitud.participantes.entries()) {
      const tieneConflicto = this.repositorio.existeInscripcionEnHorario(
        participante.dni,
        solicitud.inicioTurno,
      );
      if (tieneConflicto) {
        const error = new Error(
          `El participante ${indice + 1} ya tiene una inscripción en ese horario`,
        );
        error.name = 'ErrorValidacion';
        error.campo = 'inicioTurno';
        error.participante = indice + 1;
        throw error;
      }
    }
  }

  #confirmacionDe(solicitud) {
    return {
      destinatario: 'ana@ejemplo.com',
      actividad: solicitud.actividad,
      inicioTurno: solicitud.inicioTurno,
      participantes: solicitud.participantes,
    };
  }
}
