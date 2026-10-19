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

  /** @param {object} solicitud @returns {{idInscripcion: string}} Resultado. */
  inscribir(solicitud) {
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

  #confirmacionDe(solicitud) {
    return {
      destinatario: 'ana@ejemplo.com',
      actividad: solicitud.actividad,
      inicioTurno: solicitud.inicioTurno,
      participantes: solicitud.participantes,
    };
  }
}
